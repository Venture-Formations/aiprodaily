import { NextResponse } from 'next/server'
import type { ApiHandlerContext } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'
import { callOpenAI } from '@/lib/openai'
import { AI_PROMPTS } from '@/lib/openai/prompt-loaders'
import { getRoadWorkWithPerplexity } from '@/lib/perplexity'
import { GoogleVisionService } from '@/lib/google-vision'
import { GmailService } from '@/lib/gmail-service'
import { getCurrentTopArticle } from '@/lib/subject-line-generator'
import { ImageAnnotatorClient } from '@google-cloud/vision'
import { GoogleAuth } from 'google-auth-library'
import { start } from 'workflow/api'
import { processRSSWorkflow } from '@/lib/workflows/process-rss-workflow'
import Parser from 'rss-parser'

const rssParser = new Parser({
  customFields: {
    item: ['media:content', 'enclosure']
  }
})

type DebugHandler = (context: ApiHandlerContext) => Promise<NextResponse>

export const handlers: Record<string, { GET?: DebugHandler; POST?: DebugHandler; maxDuration?: number }> = {
  // ─── test-mailerlite-campaign ───
  'test-mailerlite-campaign': {
    POST: async ({ logger }) => {
      try {
        console.log('Testing MailerLite issue creation with scheduling...')

        // Get the latest issue
        const { data: issue, error } = await supabaseAdmin
          .from('publication_issues')
          .select(`
            *,
            articles:articles(
              *,
              rss_post:rss_posts(
                *,
                rss_feed:rss_feeds(*)
              )
            )
          `)
          .eq('date', '2025-09-24')
          .single()

        if (error || !issue) {
          return NextResponse.json({
            success: false,
            error: 'No issue found for testing'
          }, { status: 404 })
        }

        // Create a test MailerLite issue with the fixed scheduling
        const mailerLiteService = new MailerLiteService()
        const result = await mailerLiteService.createReviewissue(issue)

        return NextResponse.json({
          success: true,
          message: 'Test MailerLite issue created with scheduling',
          issueId: issue.id,
          mailerliteissueId: result.issueId,
          result
        })

      } catch (error) {
        console.error('Test issue creation error:', error)
        return NextResponse.json({
          success: false,
          error: 'Failed to create test issue',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── test-mailerlite-group ───
  'test-mailerlite-group': {
    GET: async ({ logger }) => {
      try {
        // Get the review group ID from settings
        const { data: setting } = await supabaseAdmin
          .from('app_settings')
          .select('value')
          .eq('key', 'email_reviewGroupId')
          .single()

        const reviewGroupId = setting?.value

        if (!reviewGroupId) {
          return NextResponse.json({
            success: false,
            error: 'No review group ID configured'
          }, { status: 400 })
        }

        // Test the MailerLite API with this group ID
        const apiKey = process.env.MAILERLITE_API_KEY

        if (!apiKey) {
          return NextResponse.json({
            success: false,
            error: 'MailerLite API key not configured'
          }, { status: 500 })
        }

        console.log('Testing MailerLite group ID:', reviewGroupId)

        // Try to get the group details
        const response = await fetch(`https://connect.mailerlite.com/api/groups/${reviewGroupId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        })

        const data = await response.json()

        if (!response.ok) {
          return NextResponse.json({
            success: false,
            groupId: reviewGroupId,
            statusCode: response.status,
            error: 'Group ID is invalid or does not exist in MailerLite',
            mailerliteError: data,
            suggestion: 'Please check your MailerLite account and get the correct Group ID'
          }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          groupId: reviewGroupId,
          groupDetails: data,
          message: 'Group ID is valid!'
        })

      } catch (error) {
        console.error('Error:', error)
        return NextResponse.json({
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── test-mailerlite-review ───
  'test-mailerlite-review': {
    GET: async ({ logger }) => {
      try {
        console.log('Testing MailerLite review issue creation...')

        // Get the latest issue
        const { data: issue, error: issueError } = await supabaseAdmin
          .from('publication_issues')
          .select(`
            *,
            articles:articles!inner(
              *,
              rss_post:rss_posts!inner(
                *,
                post_rating:post_ratings!inner(*),
                rss_feed:rss_feeds!inner(*)
              )
            ),
            manual_articles:manual_articles(*),
            issue_events:issue_events(
              *,
              event:events(*)
            )
          `)
          .eq('articles.is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (issueError || !issue) {
          return NextResponse.json({
            success: false,
            error: 'No issue found',
            details: issueError?.message
          }, { status: 404 })
        }

        console.log(`Testing MailerLite integration for issue ${issue.id} (${issue.date})`)

        // Test MailerLite API connection
        const mailerLiteService = new MailerLiteService()

        try {
          console.log('Testing MailerLite review issue creation...')
          const result = await mailerLiteService.createReviewissue(issue)

          return NextResponse.json({
            success: true,
            message: 'MailerLite review issue created successfully',
            issueId: issue.id,
            issueDate: issue.date,
            mailerliteissueId: result.issueId,
            subjectLine: issue.subject_line,
            result: result
          })

        } catch (mailerLiteError) {
          console.error('MailerLite API error:', mailerLiteError)

          return NextResponse.json({
            success: false,
            error: 'MailerLite API failed',
            details: mailerLiteError instanceof Error ? mailerLiteError.message : 'Unknown MailerLite error',
            issueId: issue.id,
            issueDate: issue.date,
            hasSubjectLine: !!issue.subject_line,
            activeArticlesCount: issue.articles?.length || 0
          }, { status: 500 })
        }

      } catch (error) {
        console.error('Debug test failed:', error)

        return NextResponse.json({
          success: false,
          error: 'Debug test failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── test-mailerlite-schedule ───
  'test-mailerlite-schedule': {
    GET: async ({ logger }) => {
      try {
        console.log('Testing MailerLite schedule generation...')

        // Test the same logic as getReviewDeliveryTime
        const { data: setting } = await supabaseAdmin
          .from('app_settings')
          .select('value')
          .eq('key', 'email_scheduledSendTime')
          .single()

        const scheduledTime = setting?.value || '21:00'
        console.log('Scheduled time from settings:', scheduledTime)

        // Parse the time (format: "HH:mm")
        const [hours, minutes] = scheduledTime.split(':').map(Number)

        // Test with today's date
        const today = new Date().toISOString().split('T')[0]
        const deliveryDate = new Date(today)
        deliveryDate.setHours(hours, minutes, 0, 0)

        // Current method (potentially incorrect)
        const centralTimeString = deliveryDate.toLocaleString("en-US", {timeZone: "America/Chicago"})
        const centralDate = new Date(centralTimeString)
        const utcTime = new Date(deliveryDate.getTime() + (deliveryDate.getTimezoneOffset() * 60 * 1000))

        // Alternative method (more reliable)
        const correctUtcTime = new Date(today + 'T' + scheduledTime + ':00.000-05:00')

        // Test what MailerLite expects
        const mailerliteFormat1 = utcTime.toISOString()
        const mailerliteFormat2 = correctUtcTime.toISOString()
        const mailerliteFormat3 = deliveryDate.toISOString() // Local time as ISO

        // Test Unix timestamp (some APIs prefer this)
        const unixTimestamp = Math.floor(correctUtcTime.getTime() / 1000)

        return NextResponse.json({
          success: true,
          debug: {
            scheduledTime,
            today,
            hours,
            minutes,
            centralTimeString,
            currentMethod: mailerliteFormat1,
            alternativeMethod: mailerliteFormat2,
            localTimeISO: mailerliteFormat3,
            unixTimestamp,
            testissueData: {
              name: `Test Schedule Debug`,
              type: 'regular',
              emails: [{
                subject: 'Test Schedule',
                from_name: 'St. Cloud Scoop',
                from: 'scoop@stcscoop.com',
                content: '<p>Test content</p>',
              }],
              groups: [process.env.MAILERLITE_REVIEW_GROUP_ID],
              delivery_schedule: {
                type: 'scheduled',
                delivery: mailerliteFormat2 // Use the more reliable format
              }
            }
          }
        })

      } catch (error) {
        console.error('Schedule test error:', error)
        return NextResponse.json({
          success: false,
          error: 'Failed to test schedule generation',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── test-mailerlite-schedule-format ───
  'test-mailerlite-schedule-format': {
    GET: async ({ logger }) => {
      try {
        console.log('Testing MailerLite schedule format...')

        // Get current settings
        const { data: setting } = await supabaseAdmin
          .from('app_settings')
          .select('value')
          .eq('key', 'email_scheduledSendTime')
          .single()

        const scheduledTime = setting?.value || '13:20'
        const testDate = '2025-09-24' // Tomorrow

        // Test our current method
        const centralTimeString = `${testDate}T${scheduledTime}:00.000-05:00`
        const utcTime = new Date(centralTimeString)
        const isoString = utcTime.toISOString()

        // Test alternative formats that MailerLite might expect
        const unixTimestamp = Math.floor(utcTime.getTime() / 1000)
        const unixTimestampMs = utcTime.getTime()

        // Test future time (tomorrow same time)
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(13, 20, 0, 0)
        const futureIso = tomorrow.toISOString()
        const futureUnix = Math.floor(tomorrow.getTime() / 1000)

        // Show what would be sent to MailerLite
        const testissueData = {
          name: `Test Schedule Debug`,
          type: 'regular',
          emails: [{
            subject: 'Test Schedule Format',
            from_name: 'St. Cloud Scoop',
            from: 'scoop@stcscoop.com',
            content: '<p>Test scheduling content</p>',
          }],
          groups: [process.env.MAILERLITE_REVIEW_GROUP_ID],
          delivery_schedule: {
            type: 'scheduled',
            delivery: isoString
          }
        }

        return NextResponse.json({
          success: true,
          debug: {
            settings: {
              scheduledTime,
              testDate
            },
            timeFormats: {
              centralTimeString,
              isoString,
              unixTimestamp,
              unixTimestampMs,
              futureIso,
              futureUnix
            },
            currentTime: {
              now: new Date().toISOString(),
              nowUnix: Math.floor(Date.now() / 1000)
            },
            mailerlitePayload: testissueData,
            possibleIssues: [
              'MailerLite might reject past timestamps',
              'MailerLite might expect Unix timestamp instead of ISO string',
              'MailerLite might expect different field format',
              'MailerLite might require specific timezone handling'
            ]
          }
        })

      } catch (error) {
        console.error('Schedule format test error:', error)
        return NextResponse.json({
          success: false,
          error: 'Failed to test schedule format',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── test-manual-app-selection ───
  'test-manual-app-selection': {
    GET: async ({ logger }) => {
      const logs: string[] = []

      try {
        logs.push('=== MANUAL APP SELECTION TEST ===')

        // Step 1: Get the most recent issue
        logs.push('Step 1: Fetching most recent issue...')
        const { data: issue, error: issueError } = await supabaseAdmin
          .from('publication_issues')
          .select('id, date, created_at, status')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (issueError) {
          logs.push(`ERROR: Failed to fetch issue: ${issueError.message}`)
          return NextResponse.json({ success: false, error: issueError.message, logs })
        }

        logs.push(`Found issue: ${issue.id}`)
        logs.push(`issue date: ${issue.date}`)
        logs.push(`issue status: ${issue.status}`)
        logs.push(`Created at: ${issue.created_at}`)

        // Step 2: Get the active newsletter
        logs.push('\nStep 2: Fetching active newsletter...')
        const { data: newsletter, error: newsletterError } = await supabaseAdmin
          .from('publications')
          .select('id, name, slug, is_active')
          .eq('is_active', true)
          .limit(1)
          .single()

        if (newsletterError) {
          logs.push(`ERROR: Failed to fetch newsletter: ${newsletterError.message}`)
          return NextResponse.json({ success: false, error: newsletterError.message, logs })
        }

        logs.push(`Found newsletter: ${newsletter.name}`)
        logs.push(`Newsletter ID: ${newsletter.id}`)
        logs.push(`Newsletter slug: ${newsletter.slug}`)

        // Step 3: Check if apps already selected for this issue
        logs.push('\nStep 3: Checking existing app selections...')
        const { data: existingSelections, error: selectionsError } = await supabaseAdmin
          .from('issue_ai_app_selections')
          .select('id, app_id, selection_order')
          .eq('issue_id', issue.id)

        if (selectionsError) {
          logs.push(`ERROR: Failed to check existing selections: ${selectionsError.message}`)
        } else {
          logs.push(`Existing selections: ${existingSelections?.length || 0}`)
          if (existingSelections && existingSelections.length > 0) {
            logs.push('issue already has app selections - skipping')
            return NextResponse.json({
              success: true,
              message: 'issue already has apps selected',
              existing_count: existingSelections.length,
              logs
            })
          }
        }

        // Step 4: Get available apps for this newsletter
        logs.push('\nStep 4: Fetching available AI apps...')
        const { data: apps, error: appsError } = await supabaseAdmin
          .from('ai_applications')
          .select('id, app_name, category, publication_id, is_active')
          .eq('publication_id', newsletter.id)
          .eq('is_active', true)

        if (appsError) {
          logs.push(`ERROR: Failed to fetch apps: ${appsError.message}`)
          return NextResponse.json({ success: false, error: appsError.message, logs })
        }

        logs.push(`Found ${apps?.length || 0} active apps for newsletter`)

        if (!apps || apps.length === 0) {
          logs.push('ERROR: No active apps available for selection!')
          return NextResponse.json({
            success: false,
            error: 'No apps available',
            logs
          })
        }

        // Step 5: Try importing AppSelector
        logs.push('\nStep 5: Importing AppSelector module...')
        try {
          const { AppSelector } = await import('@/lib/app-selector')
          logs.push('AppSelector imported successfully')

          // Step 6: Call selectAppsForCampaign
          logs.push(`\nStep 6: Calling AppSelector.selectAppsForissue(${issue.id}, ${newsletter.id})...`)

          const selectedApps = await AppSelector.selectAppsForissue(issue.id, newsletter.id)

          logs.push(`Selection completed! Selected ${selectedApps.length} apps`)
          selectedApps.forEach((app, index) => {
            logs.push(`  ${index + 1}. ${app.app_name} (${app.category})`)
          })

          // Step 7: Verify selections were saved
          logs.push('\nStep 7: Verifying selections were saved to database...')
          const { data: verifySelections } = await supabaseAdmin
            .from('issue_ai_app_selections')
            .select('id, app_id, selection_order')
            .eq('issue_id', issue.id)

          logs.push(`Verified: ${verifySelections?.length || 0} selections saved to database`)

          return NextResponse.json({
            success: true,
            issue_id: issue.id,
            publication_id: newsletter.id,
            selected_count: selectedApps.length,
            verified_count: verifySelections?.length || 0,
            logs
          })

        } catch (importError) {
          logs.push(`ERROR importing or calling AppSelector: ${importError instanceof Error ? importError.message : 'Unknown error'}`)
          logs.push(`Stack trace: ${importError instanceof Error ? importError.stack : 'No stack trace'}`)
          return NextResponse.json({ success: false, error: 'AppSelector error', logs }, { status: 500 })
        }

      } catch (error) {
        logs.push(`FATAL ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`)
        logs.push(`Stack trace: ${error instanceof Error ? error.stack : 'No stack trace'}`)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          logs
        }, { status: 500 })
      }
    }
  },

  // ─── test-mobile-auth ───
  'test-mobile-auth': {
    GET: async ({ request, logger }) => {
      try {
        const userAgent = request.headers.get('user-agent') || 'Unknown'
        const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent)

        // Check cookies
        const cookieHeader = request.headers.get('cookie')
        const hasSessionCookie = cookieHeader && cookieHeader.includes('next-auth')

        return NextResponse.json({
          device: {
            userAgent,
            isMobile,
            platform: isMobile ? 'Mobile' : 'Desktop'
          },
          session: {
            hasCookies: !!cookieHeader,
            hasSessionCookie,
            cookieCount: cookieHeader ? cookieHeader.split(';').length : 0,
            cookies: cookieHeader ? cookieHeader.split(';').map(c => c.trim().split('=')[0]) : []
          },
          instructions: {
            step1: 'Visit /auth/signin on mobile',
            step2: 'Complete Google OAuth flow',
            step3: 'Come back to this endpoint to see if cookies were set',
            step4: 'Then try /api/debug/auth-status again'
          },
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        return NextResponse.json({
          error: 'Test failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── test-multi-criteria ───
  'test-multi-criteria': {
    GET: async ({ logger }) => {
      try {
        console.log('Testing multi-criteria evaluation system...')

        // Fetch criteria configuration
        const { data: criteriaConfig, error: configError } = await supabaseAdmin
          .from('app_settings')
          .select('key, value')
          .or('key.eq.criteria_enabled_count,key.like.criteria_%_name,key.like.criteria_%_weight')

        if (configError) {
          return NextResponse.json({
            success: false,
            error: 'Failed to fetch criteria configuration',
            details: configError
          }, { status: 500 })
        }

        console.log('Criteria config from database:', criteriaConfig)

        // Parse criteria configuration
        const enabledCountSetting = criteriaConfig?.find(s => s.key === 'criteria_enabled_count')
        const enabledCount = enabledCountSetting?.value ? parseInt(enabledCountSetting.value) : 3

        console.log(`Enabled count: ${enabledCount}`)

        // Collect enabled criteria with their weights
        const criteria: Array<{ number: number; name: string; weight: number }> = []
        for (let i = 1; i <= enabledCount; i++) {
          const nameSetting = criteriaConfig?.find(s => s.key === `criteria_${i}_name`)
          const weightSetting = criteriaConfig?.find(s => s.key === `criteria_${i}_weight`)

          criteria.push({
            number: i,
            name: nameSetting?.value || `Criteria ${i}`,
            weight: weightSetting?.value ? parseFloat(weightSetting.value) : 1.0
          })
        }

        console.log('Parsed criteria:', criteria)

        // Test post data
        const testPost = {
          title: 'St. Cloud State University Announces New Scholarship Program',
          description: 'SCSU launches $500K scholarship initiative to support local students pursuing STEM degrees.',
          content: 'St. Cloud State University announced today a major new scholarship program aimed at increasing access to higher education for local students. The initiative, funded by a partnership between the university and several local businesses, will provide $500,000 in scholarship funding over the next five years.'
        }

        console.log('Test post:', testPost)

        // Test each criterion evaluation
        const results: any[] = []

        for (const criterion of criteria) {
          try {
            console.log(`\n=== Testing Criterion ${criterion.number}: ${criterion.name} (weight: ${criterion.weight}) ===`)

            // Get the evaluator function
            const evaluatorKey = `criteria${criterion.number}Evaluator` as keyof typeof AI_PROMPTS
            console.log(`Looking for evaluator: ${evaluatorKey}`)

            const evaluator = AI_PROMPTS[evaluatorKey]
            console.log(`Evaluator type: ${typeof evaluator}`)

            if (typeof evaluator !== 'function') {
              results.push({
                criterion: criterion.number,
                name: criterion.name,
                error: 'Evaluator not found or not a function',
                evaluatorType: typeof evaluator
              })
              continue
            }

            // Call the evaluator
            const evaluatorFn = evaluator as (post: { title: string; description: string; content?: string }) => Promise<string>
            console.log('Calling evaluator function...')

            const prompt = await evaluatorFn(testPost)
            console.log(`Prompt generated (length: ${prompt.length})`)
            console.log('Prompt preview:', prompt.substring(0, 200))

            // Call OpenAI
            console.log('Calling OpenAI...')
            const aiResult = await callOpenAI(prompt)
            console.log('AI Result:', aiResult)

            // Parse the result
            let score: number
            let reason: string

            if (aiResult.raw && typeof aiResult.raw === 'string') {
              try {
                const parsed = JSON.parse(aiResult.raw)
                score = parsed.score
                reason = parsed.reason || ''
              } catch (parseError) {
                console.error(`Failed to parse criterion ${criterion.number} response:`, aiResult.raw)
                results.push({
                  criterion: criterion.number,
                  name: criterion.name,
                  error: 'Failed to parse AI response',
                  rawResponse: aiResult.raw
                })
                continue
              }
            } else if (typeof aiResult.score === 'number') {
              score = aiResult.score
              reason = aiResult.reason || ''
            } else {
              results.push({
                criterion: criterion.number,
                name: criterion.name,
                error: 'Invalid AI response format',
                aiResult
              })
              continue
            }

            console.log(`Score: ${score}, Reason: ${reason}`)

            results.push({
              criterion: criterion.number,
              name: criterion.name,
              weight: criterion.weight,
              score,
              reason,
              success: true
            })

          } catch (error) {
            console.error(`Error testing criterion ${criterion.number}:`, error)
            results.push({
              criterion: criterion.number,
              name: criterion.name,
              error: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
            })
          }
        }

        // Calculate weighted total
        let totalWeightedScore = 0
        let totalWeight = 0

        results.filter(r => r.success).forEach(r => {
          totalWeightedScore += r.score * r.weight
          totalWeight += r.weight
        })

        const maxPossibleScore = totalWeight * 10
        const normalizedScore = totalWeight > 0 ? (totalWeightedScore / maxPossibleScore) * 100 : 0

        return NextResponse.json({
          success: true,
          testPost,
          enabledCount,
          criteria,
          results,
          summary: {
            totalWeightedScore,
            maxPossibleScore,
            normalizedScore: normalizedScore.toFixed(2),
            successfulEvaluations: results.filter(r => r.success).length,
            failedEvaluations: results.filter(r => !r.success).length
          }
        })

      } catch (error) {
        console.error('Test multi-criteria error:', error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 })
      }
    }
  },

  // ─── test-newsletter-writer ───
  'test-newsletter-writer': {
    GET: async ({ logger }) => {
      try {
        const testPost = {
          title: "St. Cloud State University ranked in U.S. News & World Report",
          description: "SCSU has been recognized for academic excellence in the latest rankings",
          content: "St. Cloud State University continues to demonstrate its commitment to quality education and student success. The latest U.S. News & World Report rankings highlight the university's dedication to providing affordable, high-quality education to students from diverse backgrounds."
        }

        console.log('Testing newsletterWriter prompt generation...')

        const prompt = await AI_PROMPTS.newsletterWriter(testPost)

        console.log('Generated prompt length:', prompt.length)
        console.log('Prompt preview:', prompt.substring(0, 500))
        console.log('Contains test title?', prompt.includes(testPost.title))

        console.log('Calling OpenAI...')
        const result = await callOpenAI(prompt, 500, 0.7)

        console.log('AI Response type:', typeof result)
        console.log('AI Response preview:', typeof result === 'string' ? result.substring(0, 500) : JSON.stringify(result).substring(0, 500))

        return NextResponse.json({
          success: true,
          prompt_length: prompt.length,
          prompt_preview: prompt.substring(0, 500),
          contains_title: prompt.includes(testPost.title),
          ai_response_type: typeof result,
          ai_response_preview: typeof result === 'string' ? result.substring(0, 500) : JSON.stringify(result).substring(0, 500),
          ai_response_length: typeof result === 'string' ? result.length : JSON.stringify(result).length
        })

      } catch (error) {
        console.error('Newsletter writer test error:', error)
        return NextResponse.json({
          error: 'Failed to test newsletter writer',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 })
      }
    }
  },

  // ─── test-perplexity ───
  'test-perplexity': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const secret = searchParams.get('secret')
      const targetDate = searchParams.get('targetDate') || new Date().toISOString().split('T')[0]

      // Only allow with test secret
      if (secret !== 'test-perplexity-road-work') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      try {
        console.log('Testing Perplexity road work generation...')
        console.log('Target date:', targetDate)

        const startTime = Date.now()
        const roadWorkItems = await getRoadWorkWithPerplexity(targetDate)
        const duration = Date.now() - startTime

        console.log(`Perplexity returned ${roadWorkItems.length} items in ${duration}ms`)

        return NextResponse.json({
          success: true,
          targetDate,
          duration: `${duration}ms`,
          itemCount: roadWorkItems.length,
          items: roadWorkItems,
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        console.error('Perplexity test failed:', error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 })
      }
    }
  },

  // ─── test-promotion ───
  'test-promotion': {
    GET: async ({ request, logger }) => {
      const searchParams = request.nextUrl.searchParams
      const existingEventId = searchParams.get('existing_event_id')

      if (!existingEventId) {
        return NextResponse.json({
          error: 'Please provide existing_event_id parameter',
          example: '/api/debug/test-promotion?existing_event_id=YOUR_EVENT_ID'
        }, { status: 400 })
      }

      try {
        // Check if event exists
        const { data: existingEvent, error: fetchError } = await supabaseAdmin
          .from('events')
          .select('*')
          .eq('id', existingEventId)
          .single()

        if (fetchError || !existingEvent) {
          return NextResponse.json({
            error: 'Event not found',
            event_id: existingEventId
          }, { status: 404 })
        }

        console.log(`[Test Promotion] Found existing event: ${existingEvent.title}`)

        // Simulate the webhook promotion logic
        console.log(`[Test Promotion] Marking original event ${existingEventId} as inactive`)

        const { error: deactivateError } = await supabaseAdmin
          .from('events')
          .update({ active: false })
          .eq('id', existingEventId)

        if (deactivateError) {
          console.error('[Test Promotion] Error deactivating:', deactivateError)
          return NextResponse.json({
            error: 'Failed to deactivate original event',
            details: deactivateError
          }, { status: 500 })
        }

        // Create promoted version
        const { data: promotedEvent, error: insertError } = await supabaseAdmin
          .from('events')
          .insert({
            external_id: `promoted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: existingEvent.title,
            description: existingEvent.description,
            start_date: existingEvent.start_date,
            end_date: existingEvent.end_date,
            venue: existingEvent.venue,
            address: existingEvent.address,
            url: existingEvent.url,
            image_url: existingEvent.image_url,
            submitter_name: 'Test User',
            submitter_email: 'test@example.com',
            submission_status: 'approved',
            paid_placement: true, // Promoted as paid placement
            featured: false,
            active: true,
            payment_status: 'completed',
            payment_intent_id: 'test_promotion',
            payment_amount: 5.00,
            raw_data: { promoted_from: existingEventId },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) {
          console.error('[Test Promotion] Error creating promoted event:', insertError)
          return NextResponse.json({
            error: 'Failed to create promoted event',
            details: insertError
          }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: 'Successfully promoted event',
          original_event: {
            id: existingEvent.id,
            title: existingEvent.title,
            active: false,
            was_active: existingEvent.active
          },
          promoted_event: {
            id: promotedEvent.id,
            title: promotedEvent.title,
            active: true,
            paid_placement: true
          }
        })

      } catch (error) {
        console.error('[Test Promotion] Error:', error)
        return NextResponse.json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── test-raw-vision ───
  'test-raw-vision': {
    POST: async ({ request, logger }) => {
      try {
        const { imageUrl } = await request.json()

        if (!imageUrl) {
          return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })
        }

        console.log('=== RAW Vision API Test ===')
        console.log('Image URL:', imageUrl)

        const visionService = new GoogleVisionService()

        // Call the Vision API directly and return the raw response
        const results = await visionService.reverseImageSearch(imageUrl)

        return NextResponse.json({
          success: true,
          imageUrl,
          message: 'Check Vercel function logs to see raw Vision API response',
          processedResults: results,
          resultCount: results.length
        })

      } catch (error) {
        console.error('Raw Vision test error:', error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        })
      }
    }
  },

  // ─── test-refund ───
  'test-refund': {
    GET: async ({ request, logger }) => {
      try {
        const testMode = request.nextUrl.searchParams.get('mode') || 'dry-run'
        const checkoutSessionId = request.nextUrl.searchParams.get('session_id')
        const partialAmount = request.nextUrl.searchParams.get('amount') // Optional: specific amount to refund in dollars

        if (!checkoutSessionId) {
          return NextResponse.json({
            error: 'Missing session_id parameter',
            usage: 'Add ?session_id=YOUR_STRIPE_SESSION_ID&mode=dry-run (or mode=live)&amount=5.00 (optional)'
          }, { status: 400 })
        }

        const stripeSecretKey = process.env.STRIPE_SECRET_KEY

        if (!stripeSecretKey) {
          return NextResponse.json({
            error: 'STRIPE_SECRET_KEY not configured'
          }, { status: 500 })
        }

        const results: any = {
          mode: testMode,
          checkoutSessionId,
          steps: []
        }

        // Step 1: Fetch checkout session
        results.steps.push({ step: 1, action: 'Fetching checkout session from Stripe...' })

        const sessionResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${checkoutSessionId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
          }
        })

        if (!sessionResponse.ok) {
          const errorText = await sessionResponse.text()
          return NextResponse.json({
            error: 'Failed to fetch checkout session',
            details: errorText,
            results
          }, { status: 500 })
        }

        const checkoutSession = await sessionResponse.json()
        results.checkoutSession = {
          id: checkoutSession.id,
          payment_status: checkoutSession.payment_status,
          amount_total: checkoutSession.amount_total / 100,
          customer_email: checkoutSession.customer_details?.email,
          payment_intent: checkoutSession.payment_intent
        }

        results.steps.push({
          step: 2,
          action: 'Checkout session retrieved',
          data: results.checkoutSession
        })

        // Step 2: Get payment intent
        const paymentIntentId = checkoutSession.payment_intent

        if (!paymentIntentId) {
          return NextResponse.json({
            error: 'No payment_intent found in checkout session',
            results
          }, { status: 400 })
        }

        results.steps.push({
          step: 3,
          action: 'Payment Intent ID found',
          paymentIntentId
        })

        // Determine refund amount (partial or full)
        const refundAmountCents = partialAmount
          ? Math.round(parseFloat(partialAmount) * 100)
          : checkoutSession.amount_total

        const refundAmountDollars = refundAmountCents / 100

        results.refundType = partialAmount
          ? `Partial refund of $${refundAmountDollars}`
          : `Full refund of $${refundAmountDollars}`

        // Step 3: Check if this is a dry-run or live test
        if (testMode === 'dry-run') {
          results.steps.push({
            step: 4,
            action: 'DRY RUN MODE - Would create refund with the following parameters',
            refundRequest: {
              payment_intent: paymentIntentId,
              reason: 'requested_by_customer',
              amount: refundAmountCents,
              amountDisplay: `$${refundAmountDollars}`,
              isPartial: !!partialAmount,
              metadata: {
                event_id: 'test-event-id',
                rejection_reason: 'Test refund via debug endpoint'
              }
            }
          })

          return NextResponse.json({
            success: true,
            message: 'Dry run completed successfully - no actual refund created',
            results,
            nextSteps: [
              'To create a real refund, use: ?session_id=YOUR_SESSION_ID&mode=live',
              'For partial refund: add &amount=5.00 (or any amount)',
              'WARNING: mode=live will actually process a refund in Stripe!'
            ]
          })
        }

        // Step 4: Create actual refund (LIVE mode)
        results.steps.push({
          step: 4,
          action: `LIVE MODE - Creating ${partialAmount ? 'PARTIAL' : 'FULL'} refund in Stripe...`,
          amount: `$${refundAmountDollars}`
        })

        const refundParams: any = {
          'payment_intent': paymentIntentId,
          'reason': 'requested_by_customer',
          'metadata[event_id]': 'test-event',
          'metadata[rejection_reason]': 'Test refund via debug endpoint',
          'metadata[test_mode]': 'true'
        }

        // Add amount for partial refund
        if (partialAmount) {
          refundParams['amount'] = refundAmountCents.toString()
        }

        const refundResponse = await fetch('https://api.stripe.com/v1/refunds', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(refundParams)
        })

        if (!refundResponse.ok) {
          const errorText = await refundResponse.text()
          results.steps.push({
            step: 5,
            action: 'Refund failed',
            error: errorText
          })

          return NextResponse.json({
            success: false,
            error: 'Failed to create refund',
            details: errorText,
            results
          }, { status: 500 })
        }

        const refund = await refundResponse.json()
        results.refund = {
          id: refund.id,
          amount: refund.amount / 100,
          status: refund.status,
          created: new Date(refund.created * 1000).toISOString()
        }

        results.steps.push({
          step: 5,
          action: 'Refund created successfully',
          refund: results.refund
        })

        return NextResponse.json({
          success: true,
          message: 'Refund test completed successfully',
          results,
          warning: 'This was a LIVE refund - it has been processed in Stripe!'
        })

      } catch (error) {
        console.error('Refund test error:', error)
        return NextResponse.json({
          success: false,
          error: 'Refund test failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── test-rejection-email ───
  'test-rejection-email': {
    GET: async ({ request, logger }) => {
      try {
        const gmail = new GmailService()

        // Get reason from query parameter or use default
        const reason = request.nextUrl.searchParams.get('reason') ||
          'The event details provided did not meet our submission guidelines. Please ensure all required information is accurate and complete.'

        // Test data for "Super Cool Featured Event"
        const testEvent = {
          title: 'Super Cool Featured Event',
          description: 'This is a test event submission to verify rejection email notifications are working correctly.',
          start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
          submitter_email: request.nextUrl.searchParams.get('email') || 'test@example.com',
          submitter_name: 'Test User'
        }

        console.log('Sending test rejection email to:', testEvent.submitter_email)
        console.log('With reason:', reason)

        const result = await gmail.sendEventRejectionEmail(testEvent, reason)

        if (result.success) {
          return NextResponse.json({
            success: true,
            message: 'Test rejection email sent successfully!',
            messageId: result.messageId,
            sentTo: testEvent.submitter_email,
            reason: reason
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Failed to send email',
            details: result.error
          }, { status: 500 })
        }

      } catch (error) {
        console.error('Test rejection email error:', error)
        return NextResponse.json({
          success: false,
          error: 'Failed to send test rejection email',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── test-reorder ───
  'test-reorder': {
    GET: async ({ request, logger }) => {
      try {
        const { searchParams } = new URL(request.url)
        const issueId = searchParams.get('issue_id')

        if (!issueId) {
          return NextResponse.json({ error: 'issueId parameter required' }, { status: 400 })
        }

        console.log(`Testing reorder logic for issue: ${issueId}`)

        // Get current issue and articles
        const { data: issue, error: issueError } = await supabaseAdmin
          .from('publication_issues')
          .select(`
            id,
            subject_line,
            articles:articles(
              id,
              headline,
              is_active,
              skipped,
              rank,
              rss_post:rss_posts(
                post_rating:post_ratings(total_score)
              )
            )
          `)
          .eq('id', issueId)
          .single()

        if (issueError || !issue) {
          return NextResponse.json({
            error: 'issue not found',
            details: issueError?.message
          }, { status: 404 })
        }

        console.log('Raw issue data:', JSON.stringify(issue, null, 2))

        // Test getCurrentTopArticle function
        const { article: currentTopArticle, error: topArticleError } = await getCurrentTopArticle(issueId)

        if (topArticleError) {
          console.error('Error getting current top article:', topArticleError)
        }

        console.log('Current top article from function:', currentTopArticle)

        // Manual filtering logic to debug
        const activeArticles = issue.articles
          .filter((article: any) => {
            console.log(`Checking article: ${article.headline}`)
            console.log(`  is_active: ${article.is_active}`)
            console.log(`  skipped: ${article.skipped}`)
            console.log(`  rank: ${article.rank}`)

            if (!article.is_active) {
              console.log(`  -> EXCLUDED: not active`)
              return false
            }

            if (article.hasOwnProperty('skipped') && article.skipped) {
              console.log(`  -> EXCLUDED: skipped`)
              return false
            }

            console.log(`  -> INCLUDED`)
            return true
          })
          .sort((a: any, b: any) => {
            const rankA = a.rank || 999
            const rankB = b.rank || 999
            console.log(`Sorting: ${a.headline} (rank ${rankA}) vs ${b.headline} (rank ${rankB})`)
            return rankA - rankB
          })

        console.log('Filtered and sorted active articles:', activeArticles.map((a: any) => ({
          id: a.id,
          headline: a.headline,
          rank: a.rank,
          is_active: a.is_active,
          skipped: a.skipped
        })))

        return NextResponse.json({
          success: true,
          issue_id: issueId,
          current_subject_line: issue.subject_line,
          total_articles: issue.articles.length,
          active_articles_count: activeArticles.length,
          current_top_article: currentTopArticle,
          top_article_error: topArticleError,
          active_articles: activeArticles.map((a: any) => ({
            id: a.id,
            headline: a.headline,
            rank: a.rank,
            is_active: a.is_active,
            skipped: a.skipped
          })),
          all_articles: issue.articles.map((a: any) => ({
            id: a.id,
            headline: a.headline,
            rank: a.rank,
            is_active: a.is_active,
            skipped: a.skipped
          }))
        })

      } catch (error) {
        console.error('Debug test failed:', error)
        return NextResponse.json({
          error: 'Debug test failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── test-rss-feeds ───
  'test-rss-feeds': {
    GET: async ({ logger }) => {
      try {
        console.log('Testing all RSS feeds...')

        // Get all active RSS feeds
        const { data: feeds, error: feedsError } = await supabaseAdmin
          .from('rss_feeds')
          .select('*')
          .eq('active', true)
          .order('name')

        if (feedsError) {
          return NextResponse.json({
            error: 'Failed to fetch feeds',
            details: feedsError
          }, { status: 500 })
        }

        if (!feeds || feeds.length === 0) {
          return NextResponse.json({
            message: 'No active RSS feeds found',
            feeds: []
          })
        }

        const results = []

        for (const feed of feeds) {
          console.log(`Testing feed: ${feed.name} (${feed.url})`)

          const feedResult: any = {
            id: feed.id,
            name: feed.name,
            url: feed.url,
            use_for_primary_section: feed.use_for_primary_section,
            use_for_secondary_section: feed.use_for_secondary_section,
            status: 'unknown',
            error: null,
            items_count: 0
          }

          try {
            const rssFeed = await rssParser.parseURL(feed.url)
            feedResult.status = 'success'
            feedResult.items_count = rssFeed.items?.length || 0
            feedResult.feed_title = rssFeed.title
            console.log(`Success: ${feed.name} - ${feedResult.items_count} items`)
          } catch (error) {
            feedResult.status = 'failed'
            feedResult.error = error instanceof Error ? error.message : String(error)
            console.error(`Failed: ${feed.name} - ${feedResult.error}`)

            // Check for specific HTTP errors
            if (feedResult.error.includes('405')) {
              feedResult.error_type = 'HTTP 405 - Method Not Allowed'
              feedResult.suggestion = 'This feed URL does not accept the HTTP method used. The feed may be misconfigured or the URL may be incorrect.'
            } else if (feedResult.error.includes('404')) {
              feedResult.error_type = 'HTTP 404 - Not Found'
              feedResult.suggestion = 'The feed URL does not exist. Check if the URL is correct.'
            } else if (feedResult.error.includes('timeout')) {
              feedResult.error_type = 'Timeout'
              feedResult.suggestion = 'The feed took too long to respond. The server may be slow or down.'
            } else {
              feedResult.error_type = 'Unknown'
              feedResult.suggestion = 'Check the feed URL and try accessing it in a browser.'
            }
          }

          results.push(feedResult)
        }

        const successCount = results.filter(r => r.status === 'success').length
        const failedCount = results.filter(r => r.status === 'failed').length

        return NextResponse.json({
          summary: {
            total_feeds: feeds.length,
            successful: successCount,
            failed: failedCount
          },
          feeds: results,
          failed_feeds: results.filter(r => r.status === 'failed')
        })

      } catch (error: any) {
        console.error('Error testing RSS feeds:', error)
        return NextResponse.json({
          error: 'Failed to test RSS feeds',
          details: error.message
        }, { status: 500 })
      }
    }
  },

  // ─── test-status-update ───
  'test-status-update': {
    GET: async ({ request, session, logger }) => {
      const { searchParams } = new URL(request.url)
      const issueId = searchParams.get('issue_id')

      if (!issueId) {
        return NextResponse.json({ error: 'issueId parameter required' }, { status: 400 })
      }

      logger.info({ issueId }, 'Status update debug')

      // Check if issue exists
      const { data: issue, error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .select('*')
        .eq('id', issueId)
        .single()

      if (issueError) {
        return NextResponse.json({
          error: 'issue lookup failed',
          details: issueError.message,
          code: issueError.code
        }, { status: 500 })
      }

      if (!issue) {
        return NextResponse.json({ error: 'issue not found' }, { status: 404 })
      }

      // Test the update operation
      const { error: updateError } = await supabaseAdmin
        .from('publication_issues')
        .update({
          status: 'changes_made',
          last_action: 'changes_made',
          last_action_at: new Date().toISOString(),
          last_action_by: session.user?.email || 'unknown'
        })
        .eq('id', issueId)

      if (updateError) {
        return NextResponse.json({
          error: 'Update failed',
          details: updateError.message,
          code: updateError.code,
          hint: updateError.hint || 'none'
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Status update test completed successfully',
        issue: {
          id: issueId,
          current_status: issue.status,
          updated_status: 'changes_made'
        }
      })
    }
  },

  // ─── test-subject ───
  'test-subject': {
    GET: async ({ logger }) => {
      try {
        console.log('=== TESTING SUBJECT LINE GENERATION ===')

        // Test with sample articles
        const testArticles = [
          {
            headline: "St. Cloud City Council Approves New Downtown Development Project",
            content: "The St. Cloud City Council unanimously approved a major downtown development project that will bring new businesses and housing to the area. The project is expected to create over 200 jobs and bring millions in investment to the local economy."
          },
          {
            headline: "Local School District Announces New STEM Program",
            content: "St. Cloud Area School District is launching a comprehensive STEM education program this fall. The initiative will provide students with hands-on experience in science, technology, engineering, and mathematics."
          }
        ]

        console.log('Test articles:', testArticles)

        // Generate subject line using AI (using first article as top article)
        const prompt = await AI_PROMPTS.subjectLineGenerator(testArticles[0])
        console.log('AI Prompt:', prompt)

        const result = await callOpenAI(prompt)
        console.log('AI Result:', result)

        if (!result.subject_line) {
          throw new Error('Invalid subject line response from AI')
        }

        return NextResponse.json({
          success: true,
          subject_line: result.subject_line,
          character_count: result.character_count,
          test_articles: testArticles,
          ai_prompt: prompt,
          full_result: result
        })

      } catch (error) {
        console.error('Subject line test failed:', error)
        return NextResponse.json({
          success: false,
          error: 'Subject line test failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── test-subject-generation ───
  'test-subject-generation': {
    POST: async ({ request, logger }) => {
      try {
        console.log('=== TESTING SUBJECT LINE GENERATION ===')

        // Get issue ID from request or use latest
        const body = await request.json().catch(() => ({}))
        let issueId = body.issueId

        if (!issueId) {
          const { data: issue, error } = await supabaseAdmin
            .from('publication_issues')
            .select('id')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (error || !issue) {
            return NextResponse.json({
              success: false,
              error: 'No issue found'
            }, { status: 404 })
          }

          issueId = issue.id
        }

        console.log('Testing subject line generation for issue:', issueId)

        // Get the issue with its articles for subject line generation
        const { data: issueWithArticles, error: issueError } = await supabaseAdmin
          .from('publication_issues')
          .select(`
            id,
            date,
            status,
            subject_line,
            articles:articles(
              headline,
              content,
              is_active,
              rss_post:rss_posts(
                post_rating:post_ratings(total_score)
              )
            )
          `)
          .eq('id', issueId)
          .single()

        if (issueError || !issueWithArticles) {
          console.error('Failed to fetch issue for subject generation:', issueError)
          return NextResponse.json({
            success: false,
            error: `issue not found: ${issueError?.message}`
          }, { status: 404 })
        }

        console.log('issue found:', {
          id: issueWithArticles.id,
          currentSubject: issueWithArticles.subject_line,
          totalArticles: issueWithArticles.articles?.length || 0
        })

        // Get active articles sorted by AI score
        const activeArticles = issueWithArticles.articles
          ?.filter((article: any) => article.is_active)
          ?.sort((a: any, b: any) => {
            const scoreA = a.rss_post?.post_rating?.[0]?.total_score || 0
            const scoreB = b.rss_post?.post_rating?.[0]?.total_score || 0
            return scoreB - scoreA
          }) || []

        console.log('Active articles found:', activeArticles.length)

        if (activeArticles.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No active articles found for subject line generation',
            issueData: {
              totalArticles: issueWithArticles.articles?.length || 0,
              activeArticles: 0
            }
          })
        }

        // Use the highest scored article for subject line generation
        const topArticle = activeArticles[0] as any
        console.log('Top article:', {
          headline: topArticle.headline,
          score: topArticle.rss_post?.post_rating?.[0]?.total_score || 0,
          hasRssPost: !!topArticle.rss_post,
          hasRating: !!topArticle.rss_post?.post_rating?.[0]
        })

        // Generate subject line using AI
        const timestamp = new Date().toISOString()
        const subjectPrompt = await AI_PROMPTS.subjectLineGenerator(topArticle) + `\n\nTimestamp: ${timestamp}`

        console.log('Generating AI subject line...')
        console.log('Prompt preview:', subjectPrompt.substring(0, 200) + '...')

        const aiResponse = await callOpenAI(subjectPrompt, 100, 0.8)

        console.log('AI Response type:', typeof aiResponse)
        console.log('AI Response:', aiResponse)

        // The AI now returns plain text, not JSON
        let generatedSubject = ''

        if (typeof aiResponse === 'string') {
          generatedSubject = aiResponse
          console.log('Using string response directly')
        } else if (typeof aiResponse === 'object' && aiResponse && 'raw' in aiResponse) {
          generatedSubject = (aiResponse as any).raw
          console.log('Using raw property from object response')
        } else if (typeof aiResponse === 'object') {
          // Fallback: convert to string
          generatedSubject = JSON.stringify(aiResponse)
          console.log('Converting object to string as fallback')
        } else {
          console.log('Unknown response type:', typeof aiResponse, aiResponse)
          return NextResponse.json({
            success: false,
            error: 'Invalid AI response type',
            responseType: typeof aiResponse,
            response: aiResponse
          }, { status: 500 })
        }

        console.log('Final generated subject:', generatedSubject)

        if (generatedSubject && generatedSubject.trim()) {
          generatedSubject = generatedSubject.trim()
          console.log('Generated subject line:', generatedSubject)

          // Update issue with generated subject line
          const { error: updateError } = await supabaseAdmin
            .from('publication_issues')
            .update({
              subject_line: generatedSubject,
              updated_at: new Date().toISOString()
            })
            .eq('id', issueId)

          if (updateError) {
            console.error('Failed to update issue with subject line:', updateError)
            return NextResponse.json({
              success: false,
              error: 'Failed to update issue with subject line',
              details: updateError.message,
              generatedSubject
            }, { status: 500 })
          }

          return NextResponse.json({
            success: true,
            message: 'Subject line generated and updated successfully',
            issueId,
            generatedSubject,
            topArticle: {
              headline: topArticle.headline,
              score: topArticle.rss_post?.post_rating?.[0]?.total_score || 0
            },
            activeArticlesCount: activeArticles.length,
            timestamp: new Date().toISOString()
          })

        } else {
          console.error('AI failed to generate subject line - empty response')
          return NextResponse.json({
            success: false,
            error: 'AI returned empty subject line',
            promptUsed: subjectPrompt.substring(0, 500) + '...',
            topArticle: {
              headline: topArticle.headline,
              score: topArticle.rss_post?.post_rating?.[0]?.total_score || 0
            }
          }, { status: 500 })
        }

      } catch (error) {
        console.error('Subject line generation test failed:', error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }, { status: 500 })
      }
    }
  },

  // ─── test-upload-flow ───
  'test-upload-flow': {
    GET: async ({ request, logger }) => {
      try {
        console.log('Testing complete upload flow...')

        // Step 1: Test upload URL generation
        const uploadRequest = {
          filename: 'test-debug.jpg',
          content_type: 'image/jpeg',
          size: 1000
        }

        const uploadUrlResponse = await fetch(`${request.nextUrl.origin}/api/images/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(uploadRequest)
        })

        if (!uploadUrlResponse.ok) {
          const error = await uploadUrlResponse.text()
          return NextResponse.json({
            step: 'upload_url_generation',
            error: 'Failed to generate upload URL',
            details: error,
            status: uploadUrlResponse.status
          }, { status: 500 })
        }

        const uploadData = await uploadUrlResponse.json()
        console.log('Upload URL generated:', uploadData)

        // Step 2: Test if we can reach the signed URL
        try {
          const urlTest = await fetch(uploadData.upload_url, {
            method: 'HEAD'
          })
          console.log('Signed URL test:', urlTest.status, urlTest.statusText)
        } catch (urlError) {
          console.error('Signed URL test failed:', urlError)
        }

        // Step 3: Check if image record was created in database
        const { data: imageRecord, error: dbError } = await supabaseAdmin
          .from('images')
          .select('*')
          .eq('id', uploadData.image_id)
          .single()

        if (dbError) {
          return NextResponse.json({
            step: 'database_record_check',
            error: 'Image record not found in database',
            details: dbError,
            uploadData
          }, { status: 500 })
        }

        // Step 4: Test storage bucket access
        const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets()
        const imagesBucket = buckets?.find(b => b.name === 'images')

        // Step 5: Test if we can list files in the bucket
        let bucketContents = null
        try {
          const { data: files, error: listError } = await supabaseAdmin.storage
            .from('images')
            .list('original', { limit: 5 })

          bucketContents = { files: files?.length || 0, error: listError }
        } catch (listError) {
          bucketContents = { error: listError }
        }

        return NextResponse.json({
          success: true,
          steps: {
            upload_url_generation: {
              success: true,
              data: uploadData
            },
            database_record: {
              success: true,
              record: imageRecord
            },
            storage_bucket: {
              exists: !!imagesBucket,
              bucket_info: imagesBucket,
              contents: bucketContents
            }
          },
          test_upload_url: uploadData.upload_url,
          next_steps: [
            '1. Try uploading a small file to the signed URL',
            '2. Check if the file appears in Supabase storage',
            '3. Test the AI analysis endpoint',
            '4. Verify the complete upload component flow'
          ]
        })

      } catch (error) {
        console.error('Upload flow test error:', error)
        return NextResponse.json({
          error: 'Upload flow test failed',
          details: error instanceof Error ? error.message : error
        }, { status: 500 })
      }
    }
  },

  // ─── test-upload-url ───
  'test-upload-url': {
    GET: async ({ logger }) => {
      try {
        console.log('Testing upload URL generation...')

        // Test upload URL generation
        const testObjectKey = 'original/test-debug.jpg'

        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('images')
          .createSignedUploadUrl(testObjectKey, {
            upsert: true
          })

        if (uploadError) {
          console.error('Upload URL generation error:', uploadError)
          return NextResponse.json({
            error: 'Failed to generate upload URL',
            details: uploadError
          }, { status: 500 })
        }

        console.log('Upload URL generated:', uploadData)

        return NextResponse.json({
          success: true,
          upload_url: uploadData.signedUrl,
          token: uploadData.token,
          object_key: testObjectKey,
          message: 'Upload URL generated successfully'
        })

      } catch (error) {
        console.error('Upload URL test error:', error)
        return NextResponse.json({
          error: 'Upload URL test failed',
          details: error instanceof Error ? error.message : error
        }, { status: 500 })
      }
    }
  },

  // ─── test-vision-basic ───
  'test-vision-basic': {
    GET: async ({ logger }) => {
      try {
        console.log('=== Basic Vision API Test ===')

        // Test if credentials work
        let credentials = undefined
        if (process.env.GOOGLE_CLOUD_TYPE && process.env.GOOGLE_CLOUD_PRIVATE_KEY) {
          console.log('Using individual environment variables')
          credentials = {
            type: process.env.GOOGLE_CLOUD_TYPE,
            project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
            private_key_id: process.env.GOOGLE_CLOUD_PRIVATE_KEY_ID,
            private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY,
            client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
            client_id: process.env.GOOGLE_CLOUD_CLIENT_ID
          }
        } else {
          return NextResponse.json({
            success: false,
            message: 'No individual environment variables found'
          })
        }

        console.log('Credentials configured:', !!credentials)
        console.log('Project ID:', process.env.GOOGLE_CLOUD_PROJECT_ID)

        // Initialize Vision client
        const auth = new GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
          credentials: credentials,
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        })

        const visionClient = new ImageAnnotatorClient({
          auth: auth,
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        })

        console.log('Vision client initialized')

        // Test with a simple web detection call
        const testImageUrl = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400'
        console.log('Testing web detection with:', testImageUrl)

        const [result] = await visionClient.annotateImage({
          image: { source: { imageUri: testImageUrl } },
          features: [
            { type: 'WEB_DETECTION', maxResults: 10 }
          ]
        })

        console.log('Vision API call completed')
        console.log('Web detection result:', JSON.stringify(result.webDetection, null, 2))

        const webDetection = result.webDetection
        const pagesWithMatches = webDetection?.pagesWithMatchingImages || []
        const webEntities = webDetection?.webEntities || []
        const visuallySimilar = webDetection?.visuallySimilarImages || []

        return NextResponse.json({
          success: true,
          message: 'Vision API working',
          testImage: testImageUrl,
          results: {
            pagesWithMatchingImages: pagesWithMatches.length,
            webEntities: webEntities.length,
            visuallySimilarImages: visuallySimilar.length,
            samplePage: pagesWithMatches[0] || null,
            sampleEntity: webEntities[0] || null,
            sampleSimilar: visuallySimilar[0] || null
          },
          rawWebDetection: webDetection
        })

      } catch (error) {
        console.error('Basic Vision test error:', error)
        return NextResponse.json({
          success: false,
          message: 'Vision API test failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        })
      }
    }
  },

  // ─── test-vision-detailed ───
  'test-vision-detailed': {
    GET: async ({ request, logger }) => {
      try {
        const { searchParams } = new URL(request.url)
        const imageUrl = searchParams.get('imageUrl') || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400'

        console.log('=== Detailed Google Vision Test ===')
        console.log('Testing image URL:', imageUrl)

        const visionService = new GoogleVisionService()
        const config = visionService.getConfig()

        console.log('Vision service configuration:', JSON.stringify(config, null, 2))

        if (!config.isConfigured) {
          return NextResponse.json({
            success: false,
            message: 'Google Vision API not configured',
            config
          })
        }

        console.log('Starting reverse image search...')
        const startTime = Date.now()

        try {
          const results = await visionService.reverseImageSearch(imageUrl)
          const endTime = Date.now()

          console.log(`Search completed in ${endTime - startTime}ms`)
          console.log(`Found ${results.length} results`)

          // Log detailed results
          results.forEach((result, index) => {
            console.log(`Result ${index + 1}:`, JSON.stringify(result, null, 2))
          })

          return NextResponse.json({
            success: true,
            message: 'Google Vision search completed',
            searchDetails: {
              imageUrl,
              searchTime: `${endTime - startTime}ms`,
              totalResults: results.length
            },
            results: results,
            config: {
              isConfigured: config.isConfigured,
              projectId: config.projectId,
              hasCredentials: config.hasCredentials
            }
          })

        } catch (searchError) {
          console.error('Vision search error:', searchError)

          return NextResponse.json({
            success: false,
            message: 'Vision search failed',
            error: searchError instanceof Error ? searchError.message : 'Unknown search error',
            stack: searchError instanceof Error ? searchError.stack : undefined,
            config
          })
        }

      } catch (error) {
        console.error('Detailed Vision test error:', error)
        return NextResponse.json({
          success: false,
          message: 'Vision test failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    },
    POST: async ({ request, logger }) => {
      try {
        const { imageUrl } = await request.json()

        if (!imageUrl) {
          return NextResponse.json({
            success: false,
            message: 'imageUrl required'
          }, { status: 400 })
        }

        // Same logic as GET but with POST body
        const visionService = new GoogleVisionService()
        const results = await visionService.reverseImageSearch(imageUrl)

        return NextResponse.json({
          success: true,
          imageUrl,
          results,
          totalResults: results.length
        })

      } catch (error) {
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  },

  // ─── test-vision-simple ───
  'test-vision-simple': {
    GET: async ({ logger }) => {
      try {
        console.log('=== Simple Google Vision Test ===')

        // Test simple initialization
        const visionService = new GoogleVisionService()
        const config = visionService.getConfig()

        console.log('Vision service configuration:', config)

        // Test simple image analysis
        if (config.isConfigured) {
          try {
            console.log('Testing Vision API with sample image...')
            // Use a simple, public image for testing
            const testImageUrl = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400'

            const results = await visionService.reverseImageSearch(testImageUrl)

            return NextResponse.json({
              success: true,
              message: 'Google Vision API is working!',
              config: config,
              testResults: {
                imageUrl: testImageUrl,
                resultsFound: results.length,
                sampleResult: results[0] || null
              }
            })
          } catch (error) {
            return NextResponse.json({
              success: false,
              message: 'Google Vision API initialization succeeded but search failed',
              config: config,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        } else {
          return NextResponse.json({
            success: false,
            message: 'Google Vision API not properly configured',
            config: config,
            issues: {
              hasCredentials: config.hasCredentials,
              hasProjectId: !!config.projectId
            }
          })
        }

      } catch (error) {
        console.error('Simple Vision test error:', error)
        return NextResponse.json({
          success: false,
          message: 'Vision API test failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  },

  // ─── trigger-workflow-test ───
  'trigger-workflow-test': {
    GET: async ({ request, logger }) => {
      try {
        const searchParams = new URL(request.url).searchParams
        const secret = searchParams.get('secret')
        const newsletterId = searchParams.get('publication_id')

        // Auth check
        if (secret !== process.env.CRON_SECRET) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!newsletterId) {
          return NextResponse.json({
            error: 'publication_id query parameter is required'
          }, { status: 400 })
        }

        console.log(`[Debug] Manually triggering workflow for newsletter: ${newsletterId}`)

        // Start the workflow
        await start(processRSSWorkflow, [{
          trigger: 'manual',
          publication_id: newsletterId
        }])

        return NextResponse.json({
          success: true,
          message: 'Workflow started successfully',
          publication_id: newsletterId,
          trigger: 'manual',
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        console.error('[Debug] Workflow trigger failed:', error)
        return NextResponse.json({
          error: 'Workflow trigger failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    },
    maxDuration: 60
  },
}
