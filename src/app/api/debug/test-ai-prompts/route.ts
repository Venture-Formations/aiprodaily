import { NextRequest, NextResponse } from 'next/server'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'
import { supabaseAdmin } from '@/lib/supabase'

// Helper function to inject post data into any value (string, object, array) recursively
// This matches the behavior of AI Prompt Testing Playground
function injectPostData(obj: any, post: any): any {
  if (typeof obj === 'string') {
    if (!post) return obj
    return obj
      .replace(/\{\{title\}\}/g, post.title || '')
      .replace(/\{\{description\}\}/g, post.description || 'No description available')
      .replace(/\{\{content\}\}/g, post.content || post.full_article_text || 'No content available')
      .replace(/\{\{headline\}\}/g, post.title || post.headline || '')
      .replace(/\{\{url\}\}/g, post.source_url || '')
      .replace(/\{\{source_url\}\}/g, post.source_url || '')
      .replace(/\{\{newsletter_content\}\}/g, post.newsletter_content || '')
      .replace(/\{\{original_content\}\}/g, post.original_content || '')
      .replace(/\{\{articles\}\}/g, post.articles || '')
      .replace(/\{\{posts\}\}/g, post.posts || '')
      .replace(/\{\{venue\}\}/g, post.venue || '')
  }
  if (Array.isArray(obj)) {
    return obj.map(item => injectPostData(item, post))
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {}
    for (const key in obj) {
      result[key] = injectPostData(obj[key], post)
    }
    return result
  }
  return obj
}

// Helper function to process custom prompt content (JSON or string) with placeholder replacement
function processCustomPrompt(customPromptContent: string, postData: any): string {
  // Try to parse as JSON (like AI Prompt Testing Playground format)
  try {
    const promptJson = JSON.parse(customPromptContent)
    // Use recursive replacement throughout the entire JSON structure
    const processedJson = injectPostData(promptJson, postData)

    // Extract the prompt string from messages array
    if (processedJson.messages && Array.isArray(processedJson.messages)) {
      const userMessage = processedJson.messages.find((m: any) => m.role === 'user')
      return userMessage?.content || customPromptContent
    } else {
      return JSON.stringify(processedJson)
    }
  } catch (e) {
    // Not JSON, treat as plain string and use recursive replacement
    return injectPostData(customPromptContent, postData)
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const promptType = searchParams.get('type') || 'all'
    const promptKey = searchParams.get('promptKey')
    const rssPostId = searchParams.get('rssPostId')
    const customPromptContent = searchParams.get('promptContent') // Custom prompt content for testing

    const results: Record<string, any> = {}

    // Fetch real RSS post data if provided
    let rssPost: any = null
    if (rssPostId) {
      const { data, error } = await supabaseAdmin
        .from('rss_posts')
        .select('*')
        .eq('id', rssPostId)
        .single()

      if (error) {
        console.error('[DEBUG] Error fetching RSS post:', error)
      } else {
        rssPost = data
        console.log('[DEBUG] Using RSS post:', rssPost.title)
      }
    }

    // Test data for each prompt type - use real RSS data if available
    const testData = {
      contentEvaluator: rssPost ? {
        title: rssPost.title,
        description: rssPost.description || '',
        content: rssPost.content || rssPost.description || ''
      } : {
        title: 'St. Cloud School District Launches New STEM Program',
        description: 'The St. Cloud Area School District announced today that it will launch a comprehensive STEM education program this fall, providing students with hands-on experience in science, technology, engineering, and mathematics through partnerships with local businesses and St. Cloud State University.',
        content: 'The new program will be available to students in grades 6-12 and will include after-school clubs, summer camps, and specialized coursework. Local tech companies have pledged equipment donations and mentorship opportunities.'
      },
      newsletterWriter: rssPost ? {
        title: rssPost.title,
        description: rssPost.description || '',
        content: rssPost.content || rssPost.description || '',
        source_url: rssPost.source_url || ''
      } : {
        title: 'New Community Center Opens in Waite Park',
        description: 'Waite Park celebrated the grand opening of its new $5 million community center on Saturday, featuring a gym, meeting rooms, and senior activity spaces.',
        content: 'The 25,000 square foot facility at 715 2nd Ave S will serve as a hub for community activities, offering fitness classes, youth programs, and event rentals. Mayor Rick Miller said the center will "bring people together" and provide year-round recreational opportunities.',
        source_url: 'https://example.com/article'
      },
      subjectLineGenerator: rssPost ? {
        headline: rssPost.title,
        content: rssPost.content || rssPost.description || ''
      } : {
        headline: 'Sartell Bridge Construction Begins Monday',
        content: 'The Minnesota Department of Transportation will close the Sartell Bridge for major repairs starting Monday morning. The project is expected to last six weeks.'
      },
      eventSummarizer: rssPost ? {
        title: rssPost.title,
        description: rssPost.description || rssPost.content || '',
        venue: 'See description'
      } : {
        title: 'Summer Concert Series at Lake George',
        description: 'Join us for free outdoor concerts every Thursday evening in July! Local bands will perform a variety of music styles from 6-8 PM. Bring your lawn chairs and blankets. Food trucks will be available.',
        venue: 'Lake George Amphitheater'
      },
      roadWorkGenerator: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      imageAnalyzer: 'Image analysis requires actual image input - use the image ingest endpoint instead',
      factChecker: {
        newsletterContent: 'New tax rules for small businesses will take effect in January 2025. The IRS announced sweeping changes to deduction limits and reporting requirements that will affect firms with under 50 employees.',
        originalContent: 'The Internal Revenue Service announced today that significant changes to small business taxation will be implemented starting January 1, 2025. These changes will impact businesses with fewer than 50 employees, particularly in terms of expense deduction limits and quarterly reporting requirements. The new rules aim to simplify compliance while ensuring accurate tax collection.'
      },
      topicDeduper: [
        {
          title: 'AI Tool Revolutionizes Tax Preparation for CPAs',
          description: 'A new AI-powered tax software is helping accounting firms reduce preparation time by 60% while improving accuracy.',
          full_article_text: 'A new AI-powered tax software is helping accounting firms reduce preparation time by 60% while improving accuracy. The technology uses machine learning to analyze tax documents and identify potential deductions.'
        },
        {
          title: 'New AI Software Transforms Tax Filing Process',
          description: 'Accounting professionals are adopting AI technology that cuts tax prep time in half and boosts accuracy rates.',
          full_article_text: 'Accounting professionals are adopting AI technology that cuts tax prep time in half and boosts accuracy rates. The software automates data entry and flags potential errors before submission.'
        },
        {
          title: 'AICPA Issues New Guidelines on AI Use in Auditing',
          description: 'The American Institute of CPAs released comprehensive guidelines for using artificial intelligence in audit procedures.',
          full_article_text: 'The American Institute of CPAs released comprehensive guidelines for using artificial intelligence in audit procedures. The new standards address data privacy, algorithm transparency, and professional judgment requirements.'
        },
        {
          title: 'Cloud Accounting Platform Adds Real-Time Anomaly Detection',
          description: 'QuickBooks announced a new feature that uses AI to detect unusual transactions in real-time.',
          full_article_text: 'QuickBooks announced a new feature that uses AI to detect unusual transactions in real-time. The system monitors account activity and alerts users to potential fraud or data entry errors.'
        },
        {
          title: 'QuickBooks Launches AI-Powered Fraud Detection',
          description: 'The popular accounting software now includes artificial intelligence to flag suspicious transactions automatically.',
          full_article_text: 'The popular accounting software now includes artificial intelligence to flag suspicious transactions automatically. QuickBooks fraud detection monitors patterns and identifies anomalies that may indicate fraudulent activity.'
        }
      ]
    }

    // Test Content Evaluator
    if (promptType === 'all' || promptType === 'contentEvaluator') {
      console.log('Testing Content Evaluator...')
      console.log('[DEBUG] Received promptKey:', promptKey)
      console.log('[DEBUG] Received promptType:', promptType)

      try {
        let prompt: string
        let promptSource = 'default'

        // If custom prompt content is provided, use that directly
        if (customPromptContent) {
          console.log('[DEBUG] Using custom prompt content from request')

          // Build post data object for placeholder replacement
          const postData = {
            title: testData.contentEvaluator.title,
            description: testData.contentEvaluator.description,
            content: testData.contentEvaluator.content,
            full_article_text: testData.contentEvaluator.content
          }

          prompt = processCustomPrompt(customPromptContent, postData)
          promptSource = 'custom'
          console.log('[DEBUG] Using custom prompt, length:', prompt.length)
        } else {
          // If testing a specific criteria prompt, fetch that prompt directly
          const isCriteriaPrompt = promptKey && (promptKey.startsWith('ai_prompt_criteria_') || promptKey.startsWith('ai_prompt_secondary_criteria_'))
          console.log('[DEBUG] Is criteria prompt?', isCriteriaPrompt)

          if (isCriteriaPrompt) {
            console.log('[DEBUG] Fetching criteria prompt from database:', promptKey)

            const { data, error } = await supabaseAdmin
              .from('app_settings')
              .select('value')
              .eq('key', promptKey)
              .single()

            console.log('[DEBUG] Database query result:', { hasData: !!data, error: error?.message })

            if (error || !data) {
              const errorMsg = `Failed to fetch prompt: ${promptKey} - ${error?.message || 'No data returned'}`
              console.error('[DEBUG]', errorMsg)
              throw new Error(errorMsg)
            }

            console.log('[DEBUG] Retrieved prompt length:', data.value?.length || 0)
            console.log('[DEBUG] Prompt preview (first 200 chars):', JSON.stringify(data.value).substring(0, 200))

            // Build post data object for placeholder replacement
            const postData = {
              title: testData.contentEvaluator.title,
              description: testData.contentEvaluator.description,
              content: testData.contentEvaluator.content,
              full_article_text: testData.contentEvaluator.content
            }

            // Use recursive placeholder replacement (handles both JSON and string formats)
            prompt = processCustomPrompt(data.value, postData)

            promptSource = `database:${promptKey}`
            console.log('[DEBUG] After placeholder replacement, prompt length:', prompt.length)
          } else {
            console.log('[DEBUG] Using standard contentEvaluator prompt from AI_PROMPTS')
            // Use the standard contentEvaluator prompt
            prompt = await AI_PROMPTS.contentEvaluator(testData.contentEvaluator)
            promptSource = 'AI_PROMPTS.contentEvaluator'
          }
        }

        console.log('[DEBUG] Final prompt preview (first 300 chars):', prompt.substring(0, 300))
        console.log('[DEBUG] Calling OpenAI with prompt length:', prompt.length)

        const response = await callOpenAI(prompt, 1000, 0.3)

        console.log('[DEBUG] OpenAI response received:', typeof response === 'string' ? response.substring(0, 200) : response)

        results.contentEvaluator = {
          success: true,
          response,
          prompt_length: prompt.length,
          prompt_key_used: promptKey || 'ai_prompt_content_evaluator',
          prompt_source: promptSource,
          prompt_preview: prompt.substring(0, 500) + '...'
        }
      } catch (error) {
        results.contentEvaluator = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Test Newsletter Writer
    if (promptType === 'all' || promptType === 'newsletterWriter') {
      console.log('Testing Newsletter Writer...')
      try {
        let prompt: string
        let promptSource = 'default'

        if (customPromptContent) {
          console.log('[DEBUG] Using custom prompt content for newsletter writer')
          const postData = {
            title: testData.newsletterWriter.title,
            description: testData.newsletterWriter.description,
            content: testData.newsletterWriter.content,
            full_article_text: testData.newsletterWriter.content,
            source_url: testData.newsletterWriter.source_url
          }
          prompt = processCustomPrompt(customPromptContent, postData)
          promptSource = 'custom'
        } else {
          prompt = await AI_PROMPTS.newsletterWriter(testData.newsletterWriter)
          promptSource = 'AI_PROMPTS.newsletterWriter'
        }

        const response = await callOpenAI(prompt, 1000, 0.3)
        results.newsletterWriter = {
          success: true,
          response,
          prompt_length: prompt.length,
          prompt_source: promptSource
        }
      } catch (error) {
        results.newsletterWriter = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Test Primary Article Title
    if (promptType === 'primaryArticleTitle') {
      console.log('Testing Primary Article Title...')
      try {
        let prompt: string
        let promptSource = 'default'

        if (customPromptContent) {
          console.log('[DEBUG] Using custom prompt content for primary article title')
          const postData = {
            title: testData.newsletterWriter.title,
            description: testData.newsletterWriter.description,
            content: testData.newsletterWriter.content,
            full_article_text: testData.newsletterWriter.content,
            source_url: testData.newsletterWriter.source_url
          }
          prompt = processCustomPrompt(customPromptContent, postData)
          promptSource = 'custom'
        } else {
          prompt = await AI_PROMPTS.primaryArticleTitle(testData.newsletterWriter)
          promptSource = 'AI_PROMPTS.primaryArticleTitle'
        }

        console.log('[TEST] Prompt preview (first 500 chars):', prompt.substring(0, 500))
        const response = await callOpenAI(prompt, 200, 0.7)
        results.primaryArticleTitle = {
          success: true,
          response,
          prompt_length: prompt.length,
          prompt_source: promptSource,
          prompt_preview: prompt.substring(0, 300) + '...'
        }
      } catch (error) {
        results.primaryArticleTitle = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Test Primary Article Body
    if (promptType === 'primaryArticleBody') {
      console.log('Testing Primary Article Body...')
      try {
        let prompt: string
        let promptSource = 'default'
        const sampleHeadline = rssPost?.title || 'Sample Test Headline for Article Body'

        if (customPromptContent) {
          console.log('[DEBUG] Using custom prompt content for primary article body')
          const postData = {
            title: testData.newsletterWriter.title,
            description: testData.newsletterWriter.description,
            content: testData.newsletterWriter.content,
            full_article_text: testData.newsletterWriter.content,
            source_url: testData.newsletterWriter.source_url,
            headline: sampleHeadline
          }
          prompt = processCustomPrompt(customPromptContent, postData)
          promptSource = 'custom'
        } else {
          prompt = await AI_PROMPTS.primaryArticleBody(testData.newsletterWriter, sampleHeadline)
          promptSource = 'AI_PROMPTS.primaryArticleBody'
        }

        const response = await callOpenAI(prompt, 500, 0.7)
        results.primaryArticleBody = {
          success: true,
          response,
          prompt_length: prompt.length,
          prompt_source: promptSource,
          note: `Using headline: "${sampleHeadline}"`
        }
      } catch (error) {
        results.primaryArticleBody = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Test Secondary Article Title
    if (promptType === 'secondaryArticleTitle') {
      console.log('Testing Secondary Article Title...')
      try {
        let prompt: string
        let promptSource = 'default'

        if (customPromptContent) {
          console.log('[DEBUG] Using custom prompt content for secondary article title')
          const postData = {
            title: testData.newsletterWriter.title,
            description: testData.newsletterWriter.description,
            content: testData.newsletterWriter.content,
            full_article_text: testData.newsletterWriter.content,
            source_url: testData.newsletterWriter.source_url
          }
          prompt = processCustomPrompt(customPromptContent, postData)
          promptSource = 'custom'
        } else {
          prompt = await AI_PROMPTS.secondaryArticleTitle(testData.newsletterWriter)
          promptSource = 'AI_PROMPTS.secondaryArticleTitle'
        }

        const response = await callOpenAI(prompt, 200, 0.7)
        results.secondaryArticleTitle = {
          success: true,
          response,
          prompt_length: prompt.length,
          prompt_source: promptSource
        }
      } catch (error) {
        results.secondaryArticleTitle = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Test Secondary Article Body
    if (promptType === 'secondaryArticleBody') {
      console.log('Testing Secondary Article Body...')
      try {
        let prompt: string
        let promptSource = 'default'
        const sampleHeadline = rssPost?.title || 'Sample Test Headline for Article Body'

        if (customPromptContent) {
          console.log('[DEBUG] Using custom prompt content for secondary article body')
          const postData = {
            title: testData.newsletterWriter.title,
            description: testData.newsletterWriter.description,
            content: testData.newsletterWriter.content,
            full_article_text: testData.newsletterWriter.content,
            source_url: testData.newsletterWriter.source_url,
            headline: sampleHeadline
          }
          prompt = processCustomPrompt(customPromptContent, postData)
          promptSource = 'custom'
        } else {
          prompt = await AI_PROMPTS.secondaryArticleBody(testData.newsletterWriter, sampleHeadline)
          promptSource = 'AI_PROMPTS.secondaryArticleBody'
        }

        const response = await callOpenAI(prompt, 500, 0.7)
        results.secondaryArticleBody = {
          success: true,
          response,
          prompt_length: prompt.length,
          prompt_source: promptSource,
          note: `Using headline: "${sampleHeadline}"`
        }
      } catch (error) {
        results.secondaryArticleBody = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Test Subject Line Generator
    if (promptType === 'all' || promptType === 'subjectLineGenerator') {
      console.log('Testing Subject Line Generator...')
      try {
        let prompt: string
        let promptSource = 'default'

        if (customPromptContent) {
          console.log('[DEBUG] Using custom prompt content for subject line generator')
          const postData = {
            headline: testData.subjectLineGenerator.headline,
            content: testData.subjectLineGenerator.content,
            full_article_text: testData.subjectLineGenerator.content
          }
          prompt = processCustomPrompt(customPromptContent, postData)
          promptSource = 'custom'
        } else {
          prompt = await AI_PROMPTS.subjectLineGenerator(testData.subjectLineGenerator)
          promptSource = 'AI_PROMPTS.subjectLineGenerator'
        }

        const response = await callOpenAI(prompt, 100, 0.8)
        results.subjectLineGenerator = {
          success: true,
          response,
          character_count: typeof response === 'string' ? response.length : response?.raw?.length || 0,
          prompt_length: prompt.length,
          prompt_source: promptSource
        }
      } catch (error) {
        results.subjectLineGenerator = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Test Event Summarizer
    if (promptType === 'all' || promptType === 'eventSummarizer') {
      console.log('Testing Event Summarizer...')
      try {
        let prompt: string
        let promptSource = 'default'

        if (customPromptContent) {
          console.log('[DEBUG] Using custom prompt content for event summarizer')
          const postData = {
            title: testData.eventSummarizer.title,
            description: testData.eventSummarizer.description,
            venue: testData.eventSummarizer.venue
          }
          prompt = processCustomPrompt(customPromptContent, postData)
          promptSource = 'custom'
        } else {
          prompt = await AI_PROMPTS.eventSummarizer(testData.eventSummarizer)
          promptSource = 'AI_PROMPTS.eventSummarizer'
        }

        const response = await callOpenAI(prompt, 200, 0.7)
        results.eventSummarizer = {
          success: true,
          response,
          prompt_length: prompt.length,
          prompt_source: promptSource
        }
      } catch (error) {
        results.eventSummarizer = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Test Road Work Generator (just show prompt, don't call AI)
    if (promptType === 'all' || promptType === 'roadWorkGenerator') {
      console.log('Testing Road Work Generator (prompt only)...')
      try {
        const prompt = await AI_PROMPTS.roadWorkGenerator(testData.roadWorkGenerator)
        results.roadWorkGenerator = {
          success: true,
          note: 'Prompt generated successfully. Use /api/debug/test-ai-road-work to actually generate road work data.',
          prompt_preview: prompt.substring(0, 500) + '...',
          prompt_length: prompt.length
        }
      } catch (error) {
        results.roadWorkGenerator = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Image Analyzer note
    if (promptType === 'all' || promptType === 'imageAnalyzer') {
      results.imageAnalyzer = {
        success: true,
        note: 'Image analysis requires actual image input. Use POST /api/images/ingest with an image to test.'
      }
    }

    // Test Fact Checker
    if (promptType === 'all' || promptType === 'factChecker') {
      console.log('Testing Fact Checker...')
      console.log('[DEBUG] Newsletter content:', testData.factChecker.newsletterContent.substring(0, 100))
      console.log('[DEBUG] Original content:', testData.factChecker.originalContent.substring(0, 100))
      try {
        let prompt: string
        let promptSource = 'default'

        if (customPromptContent) {
          console.log('[DEBUG] Using custom prompt content for fact checker')
          const postData = {
            newsletter_content: testData.factChecker.newsletterContent,
            original_content: testData.factChecker.originalContent
          }
          prompt = processCustomPrompt(customPromptContent, postData)
          promptSource = 'custom'
        } else {
          prompt = await AI_PROMPTS.factChecker(
            testData.factChecker.newsletterContent,
            testData.factChecker.originalContent
          )
          promptSource = 'AI_PROMPTS.factChecker'
        }

        console.log('[DEBUG] Generated prompt length:', prompt.length)
        console.log('[DEBUG] Prompt preview (first 500 chars):', prompt.substring(0, 500))

        const response = await callOpenAI(prompt, 1000, 0.3)
        console.log('[DEBUG] OpenAI response:', typeof response === 'string' ? response.substring(0, 200) : response)

        results.factChecker = {
          success: true,
          response,
          prompt_length: prompt.length,
          prompt_source: promptSource,
          prompt_preview: prompt.substring(0, 800) + '...',
          test_data_used: {
            newsletter_length: testData.factChecker.newsletterContent.length,
            original_length: testData.factChecker.originalContent.length
          }
        }
      } catch (error) {
        results.factChecker = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Test Welcome Section
    if (promptType === 'all' || promptType === 'welcomeSection') {
      console.log('Testing Welcome Section...')
      try {
        // Fetch sample articles for testing
        const testArticles = [
          {
            headline: 'AI Tool Revolutionizes Tax Preparation for CPAs',
            content: 'A new AI-powered tax software is helping accounting firms reduce preparation time by 60% while improving accuracy. The tool uses machine learning to identify deductions and flag potential issues before filing.'
          },
          {
            headline: 'AICPA Issues New Guidelines on AI Use in Auditing',
            content: 'The American Institute of CPAs released comprehensive guidelines for using artificial intelligence in audit procedures, emphasizing the need for human oversight and validation of AI-generated insights.'
          },
          {
            headline: 'Cloud Accounting Platform Adds Real-Time Anomaly Detection',
            content: 'QuickBooks announced a new feature that uses AI to detect unusual transactions in real-time, alerting accountants to potential fraud or errors before they become major issues.'
          },
          {
            headline: 'Study Shows 78% of Accounting Firms Plan AI Adoption',
            content: 'A recent survey reveals that the majority of accounting firms are planning to adopt AI tools within the next 18 months, primarily for automation of routine tasks and enhanced data analysis.'
          },
          {
            headline: 'New IRS Ruling Addresses AI-Generated Tax Forms',
            content: 'The Internal Revenue Service has issued guidance on the use of AI-generated tax documents, clarifying requirements for review and validation by licensed professionals.'
          }
        ]

        let prompt: string
        let promptSource = 'default'

        if (customPromptContent) {
          console.log('[DEBUG] Using custom prompt content for welcome section')
          const postData = {
            articles: JSON.stringify(testArticles, null, 2)
          }
          prompt = processCustomPrompt(customPromptContent, postData)
          promptSource = 'custom'
        } else {
          prompt = await AI_PROMPTS.welcomeSection(testArticles)
          promptSource = 'AI_PROMPTS.welcomeSection'
        }

        console.log('[TEST] Prompt type:', typeof prompt === 'string' ? 'string' : 'structured')

        const response = await callOpenAI(prompt, 500, 0.8)

        results.welcomeSection = {
          success: true,
          response,
          prompt_length: typeof prompt === 'string' ? prompt.length : 'N/A (structured)',
          prompt_source: promptSource,
          prompt_preview: typeof prompt === 'string' ? prompt.substring(0, 500) + '...' : 'Structured JSON prompt',
          test_articles_count: testArticles.length
        }
      } catch (error) {
        results.welcomeSection = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Test Topic Deduper
    if (promptType === 'all' || promptType === 'topicDeduper') {
      console.log('Testing Topic Deduper...')
      try {
        let prompt: string
        let promptSource = 'default'

        if (customPromptContent) {
          console.log('[DEBUG] Using custom prompt content for topic deduper')
          const postData = {
            posts: JSON.stringify(testData.topicDeduper, null, 2)
          }
          prompt = processCustomPrompt(customPromptContent, postData)
          promptSource = 'custom'
        } else {
          prompt = await AI_PROMPTS.topicDeduper(testData.topicDeduper)
          promptSource = 'AI_PROMPTS.topicDeduper'
        }

        console.log('[TEST] Prompt length:', prompt.length)
        console.log('[TEST] Prompt preview (first 500 chars):', prompt.substring(0, 500))

        const response = await callOpenAI(prompt, 1000, 0.3)
        console.log('[TEST] Response type:', typeof response)
        console.log('[TEST] Response:', JSON.stringify(response, null, 2))

        results.topicDeduper = {
          success: true,
          response,
          prompt_length: prompt.length,
          prompt_source: promptSource,
          prompt_preview: prompt.substring(0, 800) + '...',
          test_posts_count: testData.topicDeduper.length,
          expected_duplicates: 'Posts 0+1 (tax software), Posts 3+4 (QuickBooks fraud detection)'
        }
      } catch (error) {
        results.topicDeduper = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'AI Prompts Test Results',
      prompt_type: promptType,
      test_data: promptType === 'all' ? 'Sample data for all prompts' : testData[promptType as keyof typeof testData],
      rss_post_used: rssPost ? {
        id: rssPost.id,
        title: rssPost.title,
        source_url: rssPost.source_url
      } : null,
      results,
      usage_note: 'Add ?type=promptName to test individual prompts. Add &rssPostId=UUID to use real RSS post data instead of sample data.',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error testing AI prompts:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
