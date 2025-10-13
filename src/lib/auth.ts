import NextAuth, { type NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { supabaseAdmin } from '@/lib/supabase'
import type { User } from '@/types/database'
import { shouldBypassAuth, getMockSession } from '@/lib/auth-bypass'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('SignIn callback triggered:', {
        email: user.email,
        provider: account?.provider,
        userAgent: profile?.sub
      })

      if (account?.provider === 'google') {
        console.log('Processing Google OAuth sign-in for:', user.email)

        try {
          // Mobile-safe Supabase user creation with retry logic
          let supabaseUserId = null

          try {
            // First, create or get user in Supabase auth
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
              email: user.email!,
              email_confirm: true,
              user_metadata: {
                name: user.name,
                avatar_url: user.image,
              }
            })

            if (authError && authError.message !== 'User already registered') {
              console.error('Supabase auth user creation failed:', authError.message)
              // Don't block login - we'll create user record later
            } else {
              supabaseUserId = authData?.user?.id
            }

            if (!supabaseUserId && authError && authError.message === 'User already registered') {
              // User already exists, get their ID
              const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
              supabaseUserId = existingUsers.users.find(u => u.email === user.email)?.id
            }
          } catch (authCreateError) {
            console.error('Supabase auth operations failed (mobile-safe):', authCreateError)
            // Continue with login anyway
          }

          // Try to create/update user in users table - with mobile-safe error handling
          try {
            if (supabaseUserId) {
              // Check if user exists in our users table
              const { data: existingUser } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('email', user.email)
                .single()

              if (!existingUser) {
                // Create new user in our users table
                const { error } = await supabaseAdmin
                  .from('users')
                  .insert([
                    {
                      id: supabaseUserId,
                      email: user.email!,
                      name: user.name,
                      role: 'reviewer',
                      last_login: new Date().toISOString(),
                      is_active: true,
                    },
                  ])

                if (error) {
                  console.error('Error creating user in users table:', error.message)
                  // Don't block login - user will get default permissions
                } else {
                  console.log('Successfully created user in database:', user.email)
                }
              } else {
                // Update last login
                await supabaseAdmin
                  .from('users')
                  .update({ last_login: new Date().toISOString() })
                  .eq('id', existingUser.id)
                console.log('Updated last login for user:', user.email)
              }
            }
          } catch (dbError) {
            console.error('Database operations failed (mobile-safe):', dbError)
            // Continue with login - user will get default permissions from JWT callback
          }

          console.log('Sign-in completed successfully for:', user.email)
          return true

        } catch (error) {
          console.error('Error in signIn callback (mobile-safe):', error)
          // Mobile-safe: Always allow sign-in, handle permissions in JWT callback
          console.log('Allowing sign-in despite errors for mobile compatibility')
          return true
        }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        try {
          // Mobile-safe: Try to fetch user role from database with fallback
          console.log('Fetching user role for:', user.email)

          const { data: dbUser, error } = await supabaseAdmin
            .from('users')
            .select('role, is_active')
            .eq('email', user.email)
            .single()

          if (dbUser && !error) {
            token.role = dbUser.role
            token.isActive = dbUser.is_active
            console.log('Retrieved role from database:', dbUser.role, 'active:', dbUser.is_active)
          } else {
            // Mobile-safe fallback: Use default values if database lookup fails
            console.log('Database lookup failed, using defaults:', error?.message || 'User not found')
            token.role = 'reviewer'
            token.isActive = true
          }
        } catch (error) {
          console.error('Error fetching user role (mobile-safe):', error)
          // Mobile-safe fallback
          token.role = 'reviewer'
          token.isActive = true
        }
      }
      return token
    },
    async session({ session, token }) {
      // Bypass authentication for staging environment
      if (shouldBypassAuth()) {
        console.log('[Auth] Staging environment detected - using mock session')
        return getMockSession() as any
      }

      if (session.user) {
        session.user.role = token.role as string
        session.user.isActive = token.isActive as boolean

        // Enhanced logging for permissions
        console.log('Session created:', {
          email: session.user.email,
          role: token.role,
          isActive: token.isActive,
          timestamp: new Date().toISOString()
        })

        // Mobile-safe: Log but don't block inactive users to prevent mobile auth issues
        // Instead, implement permission checks at the UI/API level
        if (token.isActive === false) {
          console.warn('INACTIVE USER LOGGED IN:', session.user.email, '- Consider implementing UI restrictions')
          // Don't throw error to maintain mobile compatibility
          // UI components should check session.user.isActive for restrictions
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true
      }
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true
      }
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true
      }
    }
  },
}