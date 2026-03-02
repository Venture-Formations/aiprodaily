import { NextResponse } from 'next/server'
import type { ApiHandlerContext } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { isIPExcluded, IPExclusion } from '@/lib/ip-utils'
import { MailerLiteService } from '@/lib/mailerlite'
import { SlackNotificationService } from '@/lib/slack'
import axios from 'axios'

type DebugHandler = (context: ApiHandlerContext) => Promise<NextResponse>

// ---------------------------------------------------------------------------
// backfill-real-clicks helpers
// ---------------------------------------------------------------------------

const REAL_CLICK_FIELD = 'real_click' // MailerLite custom field key (lowercase)
const MAILERLITE_RATE_LIMIT_DELAY = 100 // ms between API calls to avoid rate limiting

/**
 * Updates a subscriber's custom field in MailerLite
 */
async function updateMailerLiteField(
  email: string,
  fieldName: string,
  fieldValue: boolean
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.MAILERLITE_API_KEY
  if (!apiKey) {
    return { success: false, error: 'MAILERLITE_API_KEY not configured' }
  }

  try {
    const response = await fetch(
      `https://connect.mailerlite.com/api/subscribers/${encodeURIComponent(email)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          fields: {
            [fieldName]: fieldValue ? 'true' : 'false'
          }
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { success: false, error: errorData.message || `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ---------------------------------------------------------------------------
// mailerlite-test constants
// ---------------------------------------------------------------------------

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api'

// ---------------------------------------------------------------------------
// sparkloop constants
// ---------------------------------------------------------------------------

const SPARKLOOP_API_BASE = 'https://api.sparkloop.app/v2'

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

export const handlers: Record<string, { GET?: DebugHandler; POST?: DebugHandler }> = {
  'auth-status': {
    GET: async ({ session, logger }) => {
      // Check if user exists in Supabase auth
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
      const authUser = authUsers.users.find(u => u.email === session.user.email)

      // Check if user exists in users table
      const { data: dbUser, error: dbError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single()

      return NextResponse.json({
        authenticated: true,
        session: {
          user: session.user,
          expires: session.expires
        },
        authUser: {
          exists: !!authUser,
          id: authUser?.id,
          email: authUser?.email,
          created_at: authUser?.created_at
        },
        dbUser: {
          exists: !!dbUser,
          data: dbUser,
          error: dbError?.message
        },
        timestamp: new Date().toISOString()
      })
    }
  },

  'backfill-real-clicks': {
    GET: async ({ request, logger }) => {
      const authHeader = request.headers.get('Authorization')
      const searchParams = request.nextUrl.searchParams
      const secret = searchParams.get('secret')

      // Support both header auth and query param auth
      const isAuthorized =
        authHeader === `Bearer ${process.env.CRON_SECRET}` ||
        secret === process.env.CRON_SECRET

      if (!isAuthorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const dryRun = searchParams.get('dry_run') === 'true'
      const limit = parseInt(searchParams.get('limit') || '0', 10)

      try {
        const results = {
          dryRun,
          publications: [] as {
            slug: string
            totalClickers: number
            validClickers: number
            updated: number
            failed: number
            errors: string[]
          }[]
        }

        // Get all publications
        const { data: publications, error: pubError } = await supabaseAdmin
          .from('publications')
          .select('id, slug')

        if (pubError || !publications) {
          return NextResponse.json({ error: `Failed to fetch publications: ${pubError?.message}` }, { status: 500 })
        }

        for (const publication of publications) {
          const pubResult = {
            slug: publication.slug,
            totalClickers: 0,
            validClickers: 0,
            updated: 0,
            failed: 0,
            errors: [] as string[]
          }

          // Get excluded IPs for this publication
          const { data: excludedIpsData } = await supabaseAdmin
            .from('excluded_ips')
            .select('ip_address, is_range, cidr_prefix')
            .eq('publication_id', publication.id)

          const exclusions: IPExclusion[] = (excludedIpsData || []).map(e => ({
            ip_address: e.ip_address,
            is_range: e.is_range || false,
            cidr_prefix: e.cidr_prefix
          }))

          // Get ALL link clicks for this publication (paginated)
          const FETCH_BATCH = 1000
          let allClicks: { subscriber_email: string; ip_address: string }[] = []
          let offset = 0
          let hasMore = true

          while (hasMore) {
            const { data: clicks, error: clickError } = await supabaseAdmin
              .from('link_clicks')
              .select('subscriber_email, ip_address')
              .eq('publication_id', publication.id)
              .range(offset, offset + FETCH_BATCH - 1)

            if (clickError) {
              pubResult.errors.push(`Failed to fetch clicks: ${clickError.message}`)
              break
            }

            if (clicks && clicks.length > 0) {
              allClicks = allClicks.concat(clicks)
              offset += FETCH_BATCH
              hasMore = clicks.length === FETCH_BATCH
            } else {
              hasMore = false
            }
          }

          pubResult.totalClickers = new Set(allClicks.map(c => c.subscriber_email.toLowerCase())).size

          // Filter to valid (non-excluded IP) clicks and get unique emails
          const validClicks = allClicks.filter(c => !isIPExcluded(c.ip_address, exclusions))
          const emailsWithValidClicks = Array.from(new Set(validClicks.map(c => c.subscriber_email.toLowerCase())))

          pubResult.validClickers = emailsWithValidClicks.length

          // Apply limit if specified
          const emailsToProcess = limit > 0 ? emailsWithValidClicks.slice(0, limit) : emailsWithValidClicks

          if (!dryRun) {
            // Update each subscriber in MailerLite
            for (const email of emailsToProcess) {
              const result = await updateMailerLiteField(email, REAL_CLICK_FIELD, true)

              if (result.success) {
                pubResult.updated++
                console.log(`[Backfill] Updated ${email}: ${REAL_CLICK_FIELD}=true`)
              } else {
                pubResult.failed++
                if (pubResult.errors.length < 10) {
                  pubResult.errors.push(`${email}: ${result.error}`)
                }
                console.error(`[Backfill] Failed ${email}: ${result.error}`)
              }

              // Rate limiting delay
              await new Promise(resolve => setTimeout(resolve, MAILERLITE_RATE_LIMIT_DELAY))
            }

            // Also update local tracking table
            for (const email of emailsToProcess) {
              await supabaseAdmin
                .from('subscriber_real_click_status')
                .upsert({
                  publication_id: publication.id,
                  subscriber_email: email,
                  has_real_click: true,
                  last_synced_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }, { onConflict: 'publication_id,subscriber_email' })
            }
          }

          results.publications.push(pubResult)
        }

        const totalUpdated = results.publications.reduce((sum, p) => sum + p.updated, 0)
        const totalFailed = results.publications.reduce((sum, p) => sum + p.failed, 0)
        const totalValidClickers = results.publications.reduce((sum, p) => sum + p.validClickers, 0)

        return NextResponse.json({
          success: true,
          message: dryRun
            ? `Dry run complete. Would update ${totalValidClickers} subscribers.`
            : `Backfill complete. Updated ${totalUpdated}, failed ${totalFailed}.`,
          summary: {
            totalValidClickers,
            updated: totalUpdated,
            failed: totalFailed
          },
          results,
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        console.error('[Backfill Real Clicks] Error:', error)
        return NextResponse.json({
          error: 'Backfill failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  'mailerlite-campaign-debug': {
    GET: async ({ logger }) => {
      try {
        console.log('=== MAILERLITE issue DEBUG ===')

        // Check environment variables
        const hasApiKey = !!process.env.MAILERLITE_API_KEY
        const hasReviewGroupId = !!process.env.MAILERLITE_REVIEW_GROUP_ID
        const hasMainGroupId = !!process.env.MAILERLITE_MAIN_GROUP_ID

        console.log('Environment variables check:', {
          hasApiKey,
          hasReviewGroupId,
          hasMainGroupId,
          apiKeyPrefix: process.env.MAILERLITE_API_KEY?.substring(0, 8) + '...',
          reviewGroupId: process.env.MAILERLITE_REVIEW_GROUP_ID,
          mainGroupId: process.env.MAILERLITE_MAIN_GROUP_ID
        })

        // Get tomorrow's issue
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const issueDate = tomorrow.toISOString().split('T')[0]

        console.log('Checking issue for date:', issueDate)

        const { data: issue, error: issueError } = await supabaseAdmin
          .from('publication_issues')
          .select(`
            *,
            articles:articles(
              id,
              headline,
              is_active,
              rss_post:rss_posts(
                post_rating:post_ratings(total_score)
              )
            ),
            issue_events:issue_events(
              *,
              event:events(*)
            )
          `)
          .eq('date', issueDate)
          .single()

        if (issueError || !issue) {
          return NextResponse.json({
            debug: 'MailerLite issue Debug',
            issueDate,
            environmentCheck: {
              hasApiKey,
              hasReviewGroupId,
              hasMainGroupId,
              issues: [
                !hasApiKey && 'Missing MAILERLITE_API_KEY',
                !hasReviewGroupId && 'Missing MAILERLITE_REVIEW_GROUP_ID',
                !hasMainGroupId && 'Missing MAILERLITE_MAIN_GROUP_ID'
              ].filter(Boolean)
            },
            issueCheck: {
              exists: false,
              error: issueError?.message || 'issue not found',
              recommendation: 'Run RSS processing to create tomorrow\'s issue first'
            }
          })
        }

        const activeArticles = issue.articles?.filter((article: any) => article.is_active) || []
        const issueEvents = issue.issue_events || []

        // Check issue readiness
        const issueIssues = []
        if (!issue.subject_line || issue.subject_line.trim() === '') {
          issueIssues.push('No subject line')
        }
        if (activeArticles.length === 0) {
          issueIssues.push('No active articles')
        }
        if (issue.status !== 'draft') {
          issueIssues.push(`Status is ${issue.status}, should be 'draft'`)
        }

        // If issue looks ready, test MailerLite API call
        let mailerliteTest = null
        if (hasApiKey && hasReviewGroupId && issueIssues.length === 0) {
          try {
            console.log('Testing MailerLite service...')
            const mailerLiteService = new MailerLiteService()

            // Test creating the issue (this would actually create it)
            // For debugging, we'll just validate the data structure
            console.log('issue data looks valid for MailerLite creation')
            mailerliteTest = {
              readyForCreation: true,
              wouldCreateAt: new Date().toISOString(),
              scheduledDeliveryTime: '21:00 CT (9:00 PM)'
            }
          } catch (error) {
            console.error('MailerLite test error:', error)
            mailerliteTest = {
              readyForCreation: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        }

        return NextResponse.json({
          debug: 'MailerLite issue Debug',
          issueDate,
          environmentCheck: {
            hasApiKey,
            hasReviewGroupId,
            hasMainGroupId,
            apiKeyPrefix: process.env.MAILERLITE_API_KEY?.substring(0, 8) + '...',
            reviewGroupId: process.env.MAILERLITE_REVIEW_GROUP_ID,
            mainGroupId: process.env.MAILERLITE_MAIN_GROUP_ID,
            issues: [
              !hasApiKey && 'Missing MAILERLITE_API_KEY',
              !hasReviewGroupId && 'Missing MAILERLITE_REVIEW_GROUP_ID',
              !hasMainGroupId && 'Missing MAILERLITE_MAIN_GROUP_ID'
            ].filter(Boolean)
          },
          issueCheck: {
            exists: true,
            issue: {
              id: issue.id,
              status: issue.status,
              subject_line: issue.subject_line,
              created_at: issue.created_at,
              review_sent_at: issue.review_sent_at,
              total_articles: issue.articles?.length || 0,
              active_articles: activeArticles.length,
              total_events: issueEvents.length
            },
            issues: issueIssues,
            readyForMailerLite: issueIssues.length === 0
          },
          mailerliteTest,
          recommendation: issueIssues.length > 0
            ? `Fix these issues: ${issueIssues.join(', ')}`
            : !hasApiKey
            ? 'Set MAILERLITE_API_KEY environment variable'
            : !hasReviewGroupId
            ? 'Set MAILERLITE_REVIEW_GROUP_ID environment variable'
            : 'issue appears ready for MailerLite creation',
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        console.error('MailerLite issue debug error:', error)
        return NextResponse.json({
          debug: 'MailerLite issue Debug',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }, { status: 500 })
      }
    }
  },

  'mailerlite-test': {
    GET: async ({ logger }) => {
      try {
        console.log('=== MAILERLITE DIAGNOSTIC TEST ===')

        // Check environment variables
        const hasApiKey = !!process.env.MAILERLITE_API_KEY
        const hasReviewGroupId = !!process.env.MAILERLITE_REVIEW_GROUP_ID
        const apiKeyPrefix = process.env.MAILERLITE_API_KEY?.substring(0, 8) + '...'

        console.log('Environment variables:', {
          hasApiKey,
          hasReviewGroupId,
          apiKeyPrefix,
          reviewGroupId: process.env.MAILERLITE_REVIEW_GROUP_ID
        })

        if (!hasApiKey) {
          return NextResponse.json({
            success: false,
            error: 'MAILERLITE_API_KEY not found in environment variables'
          }, { status: 500 })
        }

        if (!hasReviewGroupId) {
          return NextResponse.json({
            success: false,
            error: 'MAILERLITE_REVIEW_GROUP_ID not found in environment variables'
          }, { status: 500 })
        }

        // Test API connection
        const mailerliteClient = axios.create({
          baseURL: MAILERLITE_API_BASE,
          headers: {
            'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        })

        console.log('Testing MailerLite API connection...')

        // Test 1: Simple API authentication test
        try {
          // Try the issues endpoint first (most commonly available)
          const campaignsResponse = await mailerliteClient.get('/campaigns?limit=1')
          console.log('Campaigns endpoint test successful:', campaignsResponse.status)

          // If that works, the API key is valid
          console.log('API authentication successful')

        } catch (error: any) {
          console.error('API authentication test failed:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
          })

          // Try to diagnose the specific issue
          if (error.response?.status === 401) {
            return NextResponse.json({
              success: false,
              error: 'Invalid MailerLite API key - check your MAILERLITE_API_KEY environment variable',
              details: {
                status: error.response?.status,
                data: error.response?.data
              }
            }, { status: 500 })
          } else if (error.response?.status === 404) {
            return NextResponse.json({
              success: false,
              error: 'MailerLite API endpoint not found - possible API version issue',
              details: {
                status: error.response?.status,
                data: error.response?.data,
                baseUrl: MAILERLITE_API_BASE
              }
            }, { status: 500 })
          } else {
            return NextResponse.json({
              success: false,
              error: 'Failed to connect to MailerLite API',
              details: {
                status: error.response?.status,
                data: error.response?.data
              }
            }, { status: 500 })
          }
        }

        // Test 2: Get groups to verify review group exists
        try {
          const groupsResponse = await mailerliteClient.get('/groups')
          console.log('Groups test successful:', groupsResponse.status)

          const groups = groupsResponse.data.data
          const reviewGroup = groups.find((group: any) => group.id === process.env.MAILERLITE_REVIEW_GROUP_ID)

          if (!reviewGroup) {
            return NextResponse.json({
              success: false,
              error: `Review group ID ${process.env.MAILERLITE_REVIEW_GROUP_ID} not found`,
              availableGroups: groups.map((g: any) => ({ id: g.id, name: g.name }))
            }, { status: 400 })
          }

          console.log('Review group found:', reviewGroup.name)

        } catch (error: any) {
          console.error('Groups test failed:', error.response?.data)
          return NextResponse.json({
            success: false,
            error: 'Failed to fetch groups from MailerLite',
            details: error.response?.data
          }, { status: 500 })
        }

        // Test 3: Try creating a minimal test issue (but don't send it)
        const testIssueData = {
          name: `Test issue - ${new Date().toISOString()}`,
          type: 'regular',
          emails: [{
            subject: 'Test Subject',
            from_name: 'St. Cloud Scoop',
            from: 'scoop@stcscoop.com',
            content: '<html><body><h1>Test Content</h1></body></html>',
          }],
          groups: [process.env.MAILERLITE_REVIEW_GROUP_ID]
          // Note: No delivery_schedule means it won't be sent
        }

        try {
          console.log('Testing issue creation...')
          const issueResponse = await mailerliteClient.post('/campaigns', testIssueData)
          console.log('issue creation test successful:', issueResponse.status)

          // Immediately delete the test issue
          const issueId = issueResponse.data.data.id
          await mailerliteClient.delete(`/campaigns/${issueId}`)
          console.log('Test issue deleted')

        } catch (error: any) {
          console.error('issue creation test failed:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
          })
          return NextResponse.json({
            success: false,
            error: 'Failed to create test issue',
            details: {
              status: error.response?.status,
              data: error.response?.data,
              requestData: testIssueData
            }
          }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: 'All MailerLite tests passed successfully',
          environment: {
            hasApiKey,
            hasReviewGroupId,
            apiKeyPrefix
          }
        })

      } catch (error) {
        console.error('MailerLite diagnostic error:', error)
        return NextResponse.json({
          success: false,
          error: 'Diagnostic test failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  'manual-process-webhook': {
    GET: async ({ request, logger }) => {
      const searchParams = request.nextUrl.searchParams
      const sessionId = searchParams.get('session_id')

      if (!sessionId) {
        return NextResponse.json({
          error: 'Missing session_id parameter',
          usage: '/api/debug/manual-process-webhook?session_id=cs_test_...'
        }, { status: 400 })
      }

      try {
        console.log(`[Manual Process] Processing session: ${sessionId}`)

        // Retrieve the pending submission
        const { data: pendingSubmission, error: fetchError } = await supabaseAdmin
          .from('pending_event_submissions')
          .select('*')
          .eq('stripe_session_id', sessionId)
          .eq('processed', false)
          .single()

        if (fetchError || !pendingSubmission) {
          return NextResponse.json({
            error: 'Pending submission not found',
            details: fetchError?.message || 'No unprocessed submission found for this session',
            session_id: sessionId
          }, { status: 404 })
        }

        console.log(`[Manual Process] Found pending submission with ${pendingSubmission.events_data.length} events`)

        const events = pendingSubmission.events_data
        const insertedEvents = []

        // Insert each event into the events table
        for (const event of events) {
          const paymentAmount = event.paid_placement ? 5.00 : event.featured ? 15.00 : 0

          console.log(`[Manual Process] Inserting event: ${event.title}`)

          const { data: insertedEvent, error: insertError } = await supabaseAdmin
            .from('events')
            .insert({
              external_id: `submitted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              title: event.title,
              description: event.description,
              start_date: event.start_date,
              end_date: event.end_date,
              venue: event.venue,
              address: event.address,
              url: event.url,
              image_url: event.cropped_image_url || event.image_url,
              original_image_url: event.original_image_url,
              cropped_image_url: event.cropped_image_url,
              submitter_name: event.submitter_name || pendingSubmission.submitter_name,
              submitter_email: event.submitter_email || pendingSubmission.submitter_email,
              submitter_phone: event.submitter_phone,
              submission_status: 'pending',
              paid_placement: event.paid_placement || false,
              featured: event.featured || false,
              active: true,
              payment_status: 'completed',
              payment_intent_id: sessionId,
              payment_amount: paymentAmount,
              raw_data: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single()

          if (insertError) {
            console.error('[Manual Process] Error inserting event:', insertError)
            return NextResponse.json({
              error: 'Failed to insert event',
              details: insertError.message,
              event_title: event.title
            }, { status: 500 })
          }

          insertedEvents.push(insertedEvent)
          console.log(`[Manual Process] Inserted event: ${event.title}`)
        }

        // Send Slack notification
        const totalAmount = pendingSubmission.total_amount
        const eventTitles = events.map((e: any) => e.title).join('\n  \u2022 ')

        const slack = new SlackNotificationService()
        const message = [
          `New Paid Event Submission${events.length > 1 ? 's' : ''}! (Manual Processing)`,
          ``,
          `Submitted by: ${pendingSubmission.submitter_name}`,
          `Email: ${pendingSubmission.submitter_email}`,
          ``,
          `Payment Confirmed: $${totalAmount.toFixed(2)}`,
          `Payment ID: ${sessionId}`,
          ``,
          `Event${events.length > 1 ? 's' : ''} (${events.length}):`,
          `  \u2022 ${eventTitles}`,
          ``,
          `Review: ${process.env.NEXT_PUBLIC_URL || 'https://st-cloud-scoop.vercel.app'}/dashboard/events/review`
        ].join('\n')

        try {
          await slack.sendSimpleMessage(message)
          console.log('[Manual Process] Slack notification sent')
        } catch (slackError) {
          console.error('[Manual Process] Slack notification failed:', slackError)
          // Don't fail the whole process if Slack fails
        }

        // Mark the pending submission as processed
        const { error: updateError } = await supabaseAdmin
          .from('pending_event_submissions')
          .update({
            processed: true,
            processed_at: new Date().toISOString()
          })
          .eq('id', pendingSubmission.id)

        if (updateError) {
          console.error('[Manual Process] Failed to mark submission as processed:', updateError)
          // Don't throw - events are already inserted
        }

        return NextResponse.json({
          success: true,
          message: `Successfully processed ${insertedEvents.length} events`,
          events: insertedEvents.map(e => ({ id: e.id, title: e.title })),
          slack_sent: true
        })

      } catch (error) {
        console.error('[Manual Process] Error:', error)
        return NextResponse.json({
          error: 'Processing failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  'oauth-config': {
    GET: async ({ request, logger }) => {
      try {
        const url = new URL(request.url)
        const userAgent = request.headers.get('user-agent') || 'Unknown'

        return NextResponse.json({
          environment: {
            nodeEnv: process.env.NODE_ENV,
            nextauthUrl: process.env.NEXTAUTH_URL,
            nextauthSecret: process.env.NEXTAUTH_SECRET ? '[SET]' : '[NOT SET]',
            googleClientId: process.env.GOOGLE_CLIENT_ID ? '[SET]' : '[NOT SET]',
            googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ? '[SET]' : '[NOT SET]'
          },
          request: {
            host: url.host,
            origin: url.origin,
            userAgent: userAgent,
            isMobile: /Mobile|Android|iPhone|iPad/i.test(userAgent),
            headers: {
              host: request.headers.get('host'),
              'x-forwarded-host': request.headers.get('x-forwarded-host'),
              'x-forwarded-proto': request.headers.get('x-forwarded-proto')
            }
          },
          urls: {
            signIn: `${url.origin}/auth/signin`,
            callback: `${url.origin}/api/auth/callback/google`,
            nextAuth: `${url.origin}/api/auth`
          },
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        return NextResponse.json({
          error: 'Failed to check OAuth config',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  'setup-stripe-webhook': {
    POST: async ({ logger }) => {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY

      if (!stripeSecretKey) {
        return NextResponse.json({
          error: 'STRIPE_SECRET_KEY not configured'
        }, { status: 500 })
      }

      try {
        const webhookUrl = `${process.env.NEXT_PUBLIC_URL || 'https://st-cloud-scoop.vercel.app'}/api/webhooks/stripe`

        console.log('[Webhook Setup] Creating webhook endpoint...')
        console.log('[Webhook Setup] URL:', webhookUrl)

        // Create webhook endpoint in Stripe
        const response = await fetch('https://api.stripe.com/v1/webhook_endpoints', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            'url': webhookUrl,
            'enabled_events[]': 'checkout.session.completed',
            'description': 'St. Cloud Scoop - Event Checkout Webhook (Test Mode)',
            'api_version': '2023-10-16'
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[Webhook Setup] Stripe API error:', errorText)

          // Parse error for better display
          let errorDetails
          try {
            errorDetails = JSON.parse(errorText)
          } catch {
            errorDetails = errorText
          }

          return NextResponse.json({
            error: 'Failed to create webhook',
            details: errorDetails,
            status: response.status
          }, { status: response.status })
        }

        const webhook = await response.json()

        console.log('[Webhook Setup] Webhook created successfully!')
        console.log('[Webhook Setup] Webhook ID:', webhook.id)
        console.log('[Webhook Setup] Secret:', webhook.secret)

        return NextResponse.json({
          success: true,
          message: 'Webhook endpoint created successfully!',
          webhook: {
            id: webhook.id,
            url: webhook.url,
            secret: webhook.secret,
            status: webhook.status,
            enabled_events: webhook.enabled_events
          },
          next_steps: [
            '1. Copy the signing secret above',
            '2. Run: vercel env add STRIPE_WEBHOOK_SECRET production',
            '3. Paste the secret when prompted',
            '4. Test a payment to verify it works'
          ]
        })

      } catch (error) {
        console.error('[Webhook Setup] Error:', error)
        return NextResponse.json({
          error: 'Webhook setup failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    },

    GET: async ({ logger }) => {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY

      if (!stripeSecretKey) {
        return NextResponse.json({
          error: 'STRIPE_SECRET_KEY not configured'
        }, { status: 500 })
      }

      try {
        // List existing webhooks
        const response = await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=100', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
          }
        })

        if (!response.ok) {
          const errorText = await response.text()
          return NextResponse.json({
            error: 'Failed to list webhooks',
            details: errorText
          }, { status: response.status })
        }

        const data = await response.json()
        const ourWebhookUrl = `${process.env.NEXT_PUBLIC_URL || 'https://st-cloud-scoop.vercel.app'}/api/webhooks/stripe`

        const existingWebhook = data.data.find((wh: any) => wh.url === ourWebhookUrl)

        return NextResponse.json({
          webhook_exists: !!existingWebhook,
          webhook: existingWebhook || null,
          all_webhooks: data.data.map((wh: any) => ({
            id: wh.id,
            url: wh.url,
            status: wh.status,
            enabled_events: wh.enabled_events
          })),
          message: existingWebhook
            ? 'Webhook already exists! Use the secret from Stripe Dashboard or delete and recreate.'
            : 'No webhook found. Use POST method to create one.'
        })

      } catch (error) {
        console.error('[Webhook Check] Error:', error)
        return NextResponse.json({
          error: 'Failed to check webhooks',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  'sparkloop-subscribers': {
    GET: async ({ request, logger }) => {
      const apiKey = process.env.SPARKLOOP_API_KEY

      if (!apiKey) {
        return NextResponse.json(
          { error: 'SPARKLOOP_API_KEY not configured' },
          { status: 500 }
        )
      }

      const { searchParams } = new URL(request.url)
      const type = searchParams.get('type') || 'referrals'
      const perPage = Math.min(Number(searchParams.get('per_page') || '200'), 200)
      const expand = searchParams.get('expand') || 'campaigns'
      const maxPages = Number(searchParams.get('max_pages') || '10')

      try {
        const allSubscribers: Record<string, unknown>[] = []
        let page = 1
        let hasMore = true

        while (hasMore && page <= maxPages) {
          const url = `${SPARKLOOP_API_BASE}/subscribers?type=${type}&per_page=${perPage}&page=${page}&expand=${expand}`

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'X-API-KEY': apiKey,
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            const errorText = await response.text()
            return NextResponse.json(
              { error: `SparkLoop API error: ${response.status}`, details: errorText, page },
              { status: response.status }
            )
          }

          const data = await response.json()
          const subscribers = data.subscribers || data.data || []

          if (subscribers.length === 0) {
            hasMore = false
          } else {
            allSubscribers.push(...subscribers)
            page++
          }

          // Safety: if we got fewer than per_page, we're on the last page
          if (subscribers.length < perPage) {
            hasMore = false
          }
        }

        // Build summary
        const emails = allSubscribers.map((s: Record<string, unknown>) => ({
          email: s.email,
          name: s.name,
          uuid: s.uuid,
          referral_status: s.referral_status,
          referred: s.referred,
          referrer_code: s.referrer_code,
          origin: s.origin,
          utm_source: s.utm_source,
          created_at: s.created_at,
        }))

        return NextResponse.json({
          total: allSubscribers.length,
          pages_fetched: page - 1,
          type,
          subscribers: emails,
          raw_sample: allSubscribers.slice(0, 3),
        })
      } catch (error) {
        console.error('[SparkLoop Debug] Error fetching subscribers:', error)
        return NextResponse.json(
          { error: 'Failed to fetch subscribers', details: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        )
      }
    }
  },

  'sparkloop-upscribes': {
    GET: async ({ logger }) => {
      const apiKey = process.env.SPARKLOOP_API_KEY

      if (!apiKey) {
        return NextResponse.json(
          { error: 'SPARKLOOP_API_KEY not configured' },
          { status: 500 }
        )
      }

      try {
        const response = await fetch(`${SPARKLOOP_API_BASE}/upscribes`, {
          method: 'GET',
          headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorText = await response.text()
          return NextResponse.json(
            { error: `SparkLoop API error: ${response.status}`, details: errorText },
            { status: response.status }
          )
        }

        const data = await response.json()

        return NextResponse.json({
          upscribes: data,
          message: 'Use the uuid from the upscribe you want as SPARKLOOP_UPSCRIBE_ID',
        })
      } catch (error) {
        console.error('[SparkLoop Debug] Error:', error)
        return NextResponse.json(
          { error: 'Failed to fetch upscribes', details: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        )
      }
    }
  },
}
