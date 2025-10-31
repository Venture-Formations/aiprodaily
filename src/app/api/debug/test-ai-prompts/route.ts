import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Helper function to inject post data into JSON recursively
// Matches the behavior of /api/ai/test-prompt
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

// Helper to call AI provider (OpenAI or Claude) - matches /api/ai/test-prompt pattern
async function callAIProvider(
  promptJson: any,
  provider: 'openai' | 'claude'
): Promise<{ content: any, fullResponse: any }> {
  if (provider === 'openai') {
    // OpenAI API call - send EXACTLY as-is, only rename messages to input
    const apiRequest = { ...promptJson }

    if (apiRequest.messages) {
      apiRequest.input = apiRequest.messages
      delete apiRequest.messages
    }

    const completion = await (openai as any).responses.create(apiRequest)

    // Try multiple response formats (same as /api/ai/test-prompt)
    // For GPT-5 (reasoning model), search for json_schema content item explicitly
    // since reasoning block may be first item (empty, redacted)
    const outputArray = completion.output?.[0]?.content
    const jsonSchemaItem = outputArray?.find((c: any) => c.type === "json_schema")
    const textItem = outputArray?.find((c: any) => c.type === "text")

    let rawResponse =
      jsonSchemaItem?.json ??                                      // JSON schema response (GPT-5 compatible)
      jsonSchemaItem?.input_json ??                               // Alternative JSON location
      completion.output?.[0]?.content?.[0]?.json ??                // Fallback: first content item (GPT-4o)
      completion.output?.[0]?.content?.[0]?.input_json ??          // Fallback: first input_json
      textItem?.text ??                                           // Text from text content item
      completion.output?.[0]?.content?.[0]?.text ??                // Fallback: first text
      completion.output_text ??                                    // Legacy location
      completion.choices?.[0]?.message?.content ??                 // Chat completions format
      'No response'

    // If response is a JSON string, parse it
    let content: any = rawResponse
    if (typeof rawResponse === 'string') {
      try {
        content = JSON.parse(rawResponse)
      } catch {
        content = rawResponse
      }
    }

    return {
      content,
      fullResponse: completion
    }
  } else {
    // Claude API call - send the exact JSON
    const completion = await anthropic.messages.create(promptJson)

    // Extract text from Claude response
    const textContent = completion.content.find(c => c.type === 'text')
    let content = textContent && 'text' in textContent ? textContent.text : 'No response'

    // Try to parse as JSON if it looks like JSON
    try {
      content = JSON.parse(content)
    } catch (e) {
      // Keep as string if not valid JSON
    }

    return {
      content,
      fullResponse: completion
    }
  }
}

// Helper to load prompt JSON (from custom content or database) and get provider
async function loadPromptJSON(promptKey: string | null, customPromptContent: string | null): Promise<{ promptJson: any, provider: 'openai' | 'claude' }> {
  let promptJson: any
  let provider: 'openai' | 'claude' = 'openai'

  if (customPromptContent) {
    // Use custom prompt content directly (from text box)
    promptJson = JSON.parse(customPromptContent)
    
    // Still fetch provider from database if promptKey is provided (provider is separate setting)
    if (promptKey) {
      const { data } = await supabaseAdmin
        .from('app_settings')
        .select('ai_provider')
        .eq('key', promptKey)
        .single()
      
      if (data?.ai_provider === 'claude') {
        provider = 'claude'
      }
    }
  } else if (promptKey) {
    // Fetch from database
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value, ai_provider')
      .eq('key', promptKey)
      .single()

    if (error || !data) {
      throw new Error(`Failed to fetch prompt: ${promptKey} - ${error?.message || 'No data returned'}`)
    }

    // Parse the JSON value from database
    promptJson = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
    provider = (data.ai_provider === 'claude' ? 'claude' : 'openai')
  } else {
    throw new Error('Either promptKey or promptContent must be provided')
  }

  return { promptJson, provider }
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
      try {
        // Load prompt JSON (from custom content or database)
        const testPromptKey = promptKey || 'ai_prompt_content_evaluator'
        const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent)
        
        // Build post data for placeholder replacement
        const postData = {
          title: testData.contentEvaluator.title,
          description: testData.contentEvaluator.description,
          content: testData.contentEvaluator.content,
          full_article_text: testData.contentEvaluator.content
        }

        // Replace placeholders in the prompt JSON
        const processedJson = injectPostData(loadedPromptJson, postData)

        // Call AI provider
        const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

        results.contentEvaluator = {
          success: true,
          response: content,
          fullResponse: fullResponse,
          prompt_key_used: testPromptKey,
          prompt_source: customPromptContent ? 'custom' : 'database',
          ai_provider: loadedProvider
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
      try {
        const testPromptKey = promptKey || 'ai_prompt_newsletter_writer'
        const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent)
        
        const postData = {
          title: testData.newsletterWriter.title,
          description: testData.newsletterWriter.description,
          content: testData.newsletterWriter.content,
          full_article_text: testData.newsletterWriter.content,
          source_url: testData.newsletterWriter.source_url
        }

        const processedJson = injectPostData(loadedPromptJson, postData)
        const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

        results.newsletterWriter = {
          success: true,
          response: content,
          fullResponse: fullResponse,
          prompt_key_used: testPromptKey,
          prompt_source: customPromptContent ? 'custom' : 'database',
          ai_provider: loadedProvider
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
      try {
        const testPromptKey = promptKey || 'ai_prompt_primary_article_title'
        const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent)
        
        const postData = {
          title: testData.newsletterWriter.title,
          description: testData.newsletterWriter.description,
          content: testData.newsletterWriter.content,
          full_article_text: testData.newsletterWriter.content,
          source_url: testData.newsletterWriter.source_url
        }

        const processedJson = injectPostData(loadedPromptJson, postData)
        const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

        results.primaryArticleTitle = {
          success: true,
          response: content,
          fullResponse: fullResponse,
          prompt_key_used: testPromptKey,
          prompt_source: customPromptContent ? 'custom' : 'database',
          ai_provider: loadedProvider
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
      try {
        const testPromptKey = promptKey || 'ai_prompt_primary_article_body'
        const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent)
        
        const sampleHeadline = rssPost?.title || 'Sample Test Headline for Article Body'
        const postData = {
          title: testData.newsletterWriter.title,
          description: testData.newsletterWriter.description,
          content: testData.newsletterWriter.content,
          full_article_text: testData.newsletterWriter.content,
          source_url: testData.newsletterWriter.source_url,
          headline: sampleHeadline
        }

        const processedJson = injectPostData(loadedPromptJson, postData)
        const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

        results.primaryArticleBody = {
          success: true,
          response: content,
          fullResponse: fullResponse,
          prompt_key_used: testPromptKey,
          prompt_source: customPromptContent ? 'custom' : 'database',
          note: `Using headline: "${sampleHeadline}"`,
          ai_provider: loadedProvider
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
      try {
        const testPromptKey = promptKey || 'ai_prompt_secondary_article_title'
        const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent)
        
        const postData = {
          title: testData.newsletterWriter.title,
          description: testData.newsletterWriter.description,
          content: testData.newsletterWriter.content,
          full_article_text: testData.newsletterWriter.content,
          source_url: testData.newsletterWriter.source_url
        }

        const processedJson = injectPostData(loadedPromptJson, postData)
        const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

        results.secondaryArticleTitle = {
          success: true,
          response: content,
          fullResponse: fullResponse,
          prompt_key_used: testPromptKey,
          prompt_source: customPromptContent ? 'custom' : 'database',
          ai_provider: loadedProvider
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
      try {
        const testPromptKey = promptKey || 'ai_prompt_secondary_article_body'
        const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent)
        
        const sampleHeadline = rssPost?.title || 'Sample Test Headline for Article Body'
        const postData = {
          title: testData.newsletterWriter.title,
          description: testData.newsletterWriter.description,
          content: testData.newsletterWriter.content,
          full_article_text: testData.newsletterWriter.content,
          source_url: testData.newsletterWriter.source_url,
          headline: sampleHeadline
        }

        const processedJson = injectPostData(loadedPromptJson, postData)
        const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

        results.secondaryArticleBody = {
          success: true,
          response: content,
          fullResponse: fullResponse,
          prompt_key_used: testPromptKey,
          prompt_source: customPromptContent ? 'custom' : 'database',
          note: `Using headline: "${sampleHeadline}"`,
          ai_provider: loadedProvider
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
      try {
        const testPromptKey = promptKey || 'ai_prompt_subject_line'
        const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent)
        
        const postData = {
          headline: testData.subjectLineGenerator.headline,
          content: testData.subjectLineGenerator.content,
          full_article_text: testData.subjectLineGenerator.content
        }

        const processedJson = injectPostData(loadedPromptJson, postData)
        const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

        results.subjectLineGenerator = {
          success: true,
          response: content,
          fullResponse: fullResponse,
          character_count: typeof content === 'string' ? content.length : 0,
          prompt_key_used: testPromptKey,
          prompt_source: customPromptContent ? 'custom' : 'database',
          ai_provider: loadedProvider
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
      try {
        const testPromptKey = promptKey || 'ai_prompt_event_summary'
        const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent)
        
        const postData = {
          title: testData.eventSummarizer.title,
          description: testData.eventSummarizer.description,
          venue: testData.eventSummarizer.venue
        }

        const processedJson = injectPostData(loadedPromptJson, postData)
        const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

        results.eventSummarizer = {
          success: true,
          response: content,
          fullResponse: fullResponse,
          prompt_key_used: testPromptKey,
          prompt_source: customPromptContent ? 'custom' : 'database',
          ai_provider: loadedProvider
        }
      } catch (error) {
        results.eventSummarizer = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Test Road Work Generator - skip (requires special handling)
    if (promptType === 'all' || promptType === 'roadWorkGenerator') {
      results.roadWorkGenerator = {
        success: true,
        note: 'Road Work Generator requires special handling. Use /api/debug/test-ai-road-work to actually generate road work data.'
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
      try {
        const testPromptKey = promptKey || 'ai_prompt_fact_checker'
        const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent)
        
        const postData = {
          newsletter_content: testData.factChecker.newsletterContent,
          original_content: testData.factChecker.originalContent
        }

        const processedJson = injectPostData(loadedPromptJson, postData)
        const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

        results.factChecker = {
          success: true,
          response: content,
          fullResponse: fullResponse,
          prompt_key_used: testPromptKey,
          prompt_source: customPromptContent ? 'custom' : 'database',
          test_data_used: {
            newsletter_length: testData.factChecker.newsletterContent.length,
            original_length: testData.factChecker.originalContent.length
          },
          ai_provider: loadedProvider
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
      try {
        const testPromptKey = promptKey || 'ai_prompt_welcome_section'
        const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent)
        
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

        const postData = {
          articles: JSON.stringify(testArticles, null, 2)
        }

        const processedJson = injectPostData(loadedPromptJson, postData)
        const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

        results.welcomeSection = {
          success: true,
          response: content,
          fullResponse: fullResponse,
          prompt_key_used: testPromptKey,
          prompt_source: customPromptContent ? 'custom' : 'database',
          test_articles_count: testArticles.length,
          ai_provider: loadedProvider
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
      try {
        const testPromptKey = promptKey || 'ai_prompt_topic_deduper'
        const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent)
        
        const postData = {
          posts: JSON.stringify(testData.topicDeduper, null, 2),
          articles: JSON.stringify(testData.topicDeduper, null, 2) // Support both {{posts}} and {{articles}}
        }

        const processedJson = injectPostData(loadedPromptJson, postData)
        const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

        results.topicDeduper = {
          success: true,
          response: content,
          fullResponse: fullResponse,
          prompt_key_used: testPromptKey,
          prompt_source: customPromptContent ? 'custom' : 'database',
          test_posts_count: testData.topicDeduper.length,
          expected_duplicates: 'Posts 0+1 (tax software), Posts 3+4 (QuickBooks fraud detection)',
          ai_provider: loadedProvider
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
      usage_note: 'Add ?type=promptName to test individual prompts. Add &promptKey=KEY to test a specific prompt from database. Add &promptContent=JSON to test custom prompt. Add &rssPostId=UUID to use real RSS post data instead of sample data.',
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
