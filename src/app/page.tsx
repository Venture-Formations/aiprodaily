import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function RootPage() {
  // Use server-side session check to avoid client-side redirect loops
  const session = await getServerSession(authOptions)

  if (session) {
    // Authenticated users go to dashboard (newsletter selector)
    redirect('/dashboard')
  } else {
    // Unauthenticated users go to sign in
    redirect('/auth/signin')
  }

  // This will never render because redirect() happens first
  return null
}
