import { NextResponse } from 'next/server'
import type { ApiHandlerContext } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { SupabaseImageStorage } from '@/lib/supabase-image-storage'

type DebugHandler = (context: ApiHandlerContext) => Promise<NextResponse>

export const handlers: Record<string, { GET?: DebugHandler; POST?: DebugHandler }> = {
  'image-upload': {
    GET: async ({ logger }) => {
      try {
        console.log('=== SUPABASE IMAGE UPLOAD DEBUG ===')

        const storage = new SupabaseImageStorage()

        const testImageUrl = 'https://picsum.photos/800/600'

        console.log('Testing image upload with sample URL...')
        const uploadResult = await storage.uploadImage(testImageUrl, 'Test Debug Upload')
        console.log('Upload result:', uploadResult)

        return NextResponse.json({
          debug: 'Supabase Image Upload Test',
          upload: {
            testUrl: testImageUrl,
            result: uploadResult,
          },
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        console.error('Debug endpoint error:', error)
        return NextResponse.json({
          error: error instanceof Error ? error.message : 'Unknown error',
          debug: 'Failed to run debug test'
        }, { status: 500 })
      }
    }
  },

  'images': {
    GET: async ({ logger }) => {
      try {
        console.log('Debug endpoint called, checking database...')
        console.log('Environment check:')
        console.log('- SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing')
        console.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing')
        console.log('- SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing')

        // Check if supabaseAdmin is working
        const { data: testQuery, error: testError } = await supabaseAdmin
          .from('publication_issues')
          .select('count(*)')

        console.log('Test query result:', testQuery, 'Error:', testError)

        // Get all campaigns to see what exists
        const { data: allCampaigns, error: issuesError } = await supabaseAdmin
          .from('publication_issues')
          .select('id, date, status')
          .order('date', { ascending: false })

        console.log('Campaigns query result:', allCampaigns, 'Error:', issuesError)

        // Get RSS feeds to see if they're configured
        const { data: feeds } = await supabaseAdmin
          .from('rss_feeds')
          .select('id, name, url, active')

        if (!allCampaigns || allCampaigns.length === 0) {
          return NextResponse.json({
            error: 'No issues found',
            issues: [],
            feeds: feeds || [],
            debug: 'RSS processing has never run or campaigns are not being created'
          })
        }

        const issue = allCampaigns[0]

        // Get RSS posts with images for this issue
        const { data: posts } = await supabaseAdmin
          .from('rss_posts')
          .select('id, title, image_url, issue_id')
          .eq('issue_id', issue.id)

        // Get articles for this issue
        const { data: articles } = await supabaseAdmin
          .from('module_articles')
          .select(`
            id,
            headline,
            is_active,
            rss_post:rss_posts(
              id,
              title,
              image_url
            )
          `)
          .eq('issue_id', issue.id)

        return NextResponse.json({
          issues: allCampaigns,
          currentissue: issue,
          feeds: feeds || [],
          posts: posts || [],
          articles: articles || [],
          postsWithImages: posts?.filter(p => p.image_url) || [],
          activeArticles: articles?.filter(a => a.is_active) || []
        })

      } catch (error) {
        console.error('Debug endpoint error:', error)
        return NextResponse.json({
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  'process-images': {
    POST: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const issueId = searchParams.get('issue_id')

      if (!issueId) {
        return NextResponse.json({ error: 'issueId parameter required' }, { status: 400 })
      }

      logger.info({ issueId }, 'Manual image processing started')

      const imageStorage = new SupabaseImageStorage()

      // Get active articles with their RSS post image URLs
      const { data: articles, error } = await supabaseAdmin
        .from('module_articles')
        .select(`
          id,
          rss_post:rss_posts(
            id,
            image_url,
            title
          )
        `)
        .eq('issue_id', issueId)
        .eq('is_active', true)

      if (error || !articles) {
        return NextResponse.json({
          error: 'Failed to fetch articles',
          details: error?.message
        }, { status: 500 })
      }

      logger.info(`Found ${articles.length} active articles to process`)

      const results = []

      // Process images for each article
      for (const article of articles) {
        try {
          const rssPost = Array.isArray(article.rss_post) ? article.rss_post[0] : article.rss_post

          if (!rssPost?.image_url) {
            results.push({
              articleId: article.id,
              status: 'skipped',
              reason: 'No image URL'
            })
            continue
          }

          const originalImageUrl = rssPost.image_url

          // Skip if already hosted on Supabase
          let isHosted = false
          try { const h = new URL(originalImageUrl).hostname.toLowerCase(); isHosted = h.endsWith('.supabase.co') || h === 'img.aiprodaily.com' } catch {}
          if (isHosted) {
            results.push({
              articleId: article.id,
              status: 'skipped',
              reason: 'Already hosted on Supabase',
              currentUrl: originalImageUrl
            })
            continue
          }

          // Upload image to Supabase (optimized via Tinify)
          const hostedUrl = await imageStorage.uploadImage(originalImageUrl, rssPost.title)

          if (hostedUrl) {
            await supabaseAdmin
              .from('rss_posts')
              .update({ image_url: hostedUrl })
              .eq('id', rssPost.id)

            results.push({
              articleId: article.id,
              status: 'success',
              originalUrl: originalImageUrl,
              hostedUrl
            })
          } else {
            results.push({
              articleId: article.id,
              status: 'failed',
              originalUrl: originalImageUrl,
              reason: 'Upload returned null'
            })
          }

        } catch (error) {
          results.push({
            articleId: article.id,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      return NextResponse.json({
        debug: 'Manual Image Processing',
        issueId,
        articlesFound: articles.length,
        results,
        summary: {
          total: results.length,
          success: results.filter(r => r.status === 'success').length,
          failed: results.filter(r => r.status === 'failed').length,
          errors: results.filter(r => r.status === 'error').length,
          skipped: results.filter(r => r.status === 'skipped').length
        },
        timestamp: new Date().toISOString()
      })
    }
  },

  'storage': {
    GET: async ({ logger }) => {
      try {
        console.log('=== STORAGE DEBUG ===')

        // Check if the newsletter-images bucket exists
        const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets()
        console.log('Available buckets:', buckets)
        console.log('Buckets error:', bucketsError)

        // Try to list files in newsletter-images bucket
        const { data: files, error: filesError } = await supabaseAdmin.storage
          .from('newsletter-images')
          .list('articles', { limit: 10 })

        console.log('Files in newsletter-images/articles:', files)
        console.log('Files error:', filesError)

        // Get recent RSS posts to see current image URLs
        const { data: posts, error: postsError } = await supabaseAdmin
          .from('rss_posts')
          .select('id, title, image_url, publication_date')
          .order('publication_date', { ascending: false })
          .limit(5)

        console.log('Recent RSS posts:', posts)

        return NextResponse.json({
          debug: 'Supabase Storage Analysis',
          buckets: buckets || [],
          bucketsError,
          files: files || [],
          filesError,
          posts: posts || [],
          postsError
        })

      } catch (error) {
        console.error('Storage debug error:', error)
        return NextResponse.json({
          error: error instanceof Error ? error.message : 'Unknown error',
          debug: 'Failed to analyze storage'
        }, { status: 500 })
      }
    }
  },

  'sync-logo': {
    GET: async ({ logger }) => {
      try {
        // Get logo_url from app_settings
        const { data: logoSetting, error: logoError } = await supabaseAdmin
          .from('app_settings')
          .select('value')
          .eq('key', 'logo_url')
          .single()

        if (logoError) {
          return NextResponse.json({
            error: 'Failed to fetch logo from app_settings',
            details: logoError.message
          }, { status: 500 })
        }

        const logoUrl = logoSetting?.value || null

        // Update newsletters table with logo_url
        const { error: updateError } = await supabaseAdmin
          .from('publications')
          .update({ logo_url: logoUrl })
          .eq('slug', 'accounting')

        if (updateError) {
          return NextResponse.json({
            error: 'Failed to update newsletters table',
            details: updateError.message
          }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: 'Logo synced successfully',
          logo_url: logoUrl
        })

      } catch (error) {
        console.error('Sync logo error:', error)
        return NextResponse.json({
          error: 'Failed to sync logo',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },
}
