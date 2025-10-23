2025-10-23T16:39:56.803Z [info] Session created: {
  email: 'david@ventureformations.com',
  role: 'reviewer',
  isActive: true,
  timestamp: '2025-10-23T16:39:56.802Z'
}
2025-10-23T16:39:56.839Z [info] [RSS] Start: 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T16:39:56.839Z [info] [Step 1/4] Archive + Fetch for campaign 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T16:39:56.839Z [info] === ARCHIVING ARTICLES FOR CAMPAIGN 3e139a40-b646-4466-8ce0-c8c6a17d2390 ===
2025-10-23T16:39:56.839Z [info] Archive reason: rss_processing_clear
2025-10-23T16:39:56.980Z [info] Found 3 articles to archive
2025-10-23T16:39:57.024Z [info] ✅ Archived 3 articles (including 0 with review positions)
2025-10-23T16:39:57.104Z [info] Found 41 posts to archive
2025-10-23T16:39:57.211Z [warning] ⚠️ archived_post_ratings table does not exist - skipping rating archival
2025-10-23T16:39:57.211Z [warning] Run migrations/create_archived_post_ratings.sql to enable rating archival
2025-10-23T16:39:57.211Z [info] ✅ Archived 41 posts with 21 ratings
2025-10-23T16:39:57.211Z [info] ✅ Archive complete: 3 articles, 41 posts, 21 ratings
2025-10-23T16:40:02.444Z [info] [Step 1/4] Complete: 44 posts fetched
2025-10-23T16:40:02.444Z [info] [Step 2/4] Extract + Score for campaign 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T16:40:02.511Z [info] Starting batch extraction of 44 articles (batch size: 10)
2025-10-23T16:40:02.511Z [info] Processing batch 1/5 (10 articles)
2025-10-23T16:40:03.742Z [info] Batch 1 complete: 10 successful, 0 failed
2025-10-23T16:40:04.742Z [info] Processing batch 2/5 (10 articles)
2025-10-23T16:40:05.815Z [info] Batch 2 complete: 10 successful, 0 failed
2025-10-23T16:40:06.815Z [info] Processing batch 3/5 (10 articles)
2025-10-23T16:40:06.890Z [info] Retry attempt 1 for: https://www.economist.com/business/2025/10/23/openai-and-anthropic-v-app-developers-techs-cronos-syndrome
2025-10-23T16:40:08.946Z [info] Batch 3 complete: 9 successful, 1 failed
2025-10-23T16:40:09.947Z [info] Processing batch 4/5 (10 articles)
2025-10-23T16:40:10.749Z [info] Batch 4 complete: 10 successful, 0 failed
2025-10-23T16:40:11.749Z [info] Processing batch 5/5 (4 articles)
2025-10-23T16:40:12.318Z [info] Batch 5 complete: 4 successful, 0 failed
2025-10-23T16:40:12.318Z [info] Batch extraction complete: 43/44 successful, 1 failed
2025-10-23T16:40:50.082Z [error] OpenAI API error with GPT-5: Error: Request was aborted.
    at s1.makeRequest (.next/server/chunks/7590.js:1:110364)
    at async d (.next/server/chunks/5606.js:844:8941)
    at async m.evaluatePost (.next/server/chunks/3645.js:4:19524)
    at async m.scorePostsForSection (.next/server/chunks/3645.js:4:6277)
    at async o (.next/server/app/api/rss/process/route.js:1:5169)
    at async g (.next/server/app/api/rss/process/route.js:1:2273) {
  status: undefined,
  headers: undefined,
  request_id: undefined,
  error: undefined,
  code: undefined,
  param: undefined,
  type: undefined
}
2025-10-23T16:40:50.082Z [error] Error details: Request was aborted.
2025-10-23T16:40:50.082Z [error] Error name: Error
2025-10-23T16:40:50.082Z [error] Error stack: Error: Request was aborted.
    at s1.makeRequest (/var/task/.next/server/chunks/7590.js:1:110364)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async d (/var/task/.next/server/chunks/5606.js:844:8941)
    at async m.evaluatePost (/var/task/.next/server/chunks/3645.js:4:19524)
    at async m.scorePostsForSection (/var/task/.next/server/chunks/3645.js:4:6277)
    at async o (/var/task/.next/server/app/api/rss/process/route.js:1:5169)
    at async g (/var/task/.next/server/app/api/rss/process/route.js:1:2273)
    at async tr.do (/var/task/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:18:17558)
    at async tr.handle (/var/task/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:18:22072)
    at async ea (/var/task/node_modules/next/dist/compiled/next-server/server.runtime.prod.js:2871:21129)
2025-10-23T16:40:50.082Z [error] Full error object: {}
2025-10-23T16:40:50.083Z [error] Error evaluating criterion 3: Error: Request was aborted.
    at s1.makeRequest (.next/server/chunks/7590.js:1:110364)
    at async d (.next/server/chunks/5606.js:844:8941)
    at async m.evaluatePost (.next/server/chunks/3645.js:4:19524)
    at async m.scorePostsForSection (.next/server/chunks/3645.js:4:6277)
    at async o (.next/server/app/api/rss/process/route.js:1:5169)
    at async g (.next/server/app/api/rss/process/route.js:1:2273) {
  status: undefined,
  headers: undefined,
  request_id: undefined,
  error: undefined,
  code: undefined,
  param: undefined,
  type: undefined
}
2025-10-23T16:40:56.600Z [info] Criterion 1: 3/10; Criterion 2: 8/10; Criterion 3: 5/10; Total: 21.5 (max: 40)
2025-10-23T16:41:05.428Z [info] Criterion 1: 6/10; Criterion 2: 8/10; Criterion 3: 3/10; Total: 24 (max: 40)
2025-10-23T16:41:14.364Z [info] Criterion 1: 4/10; Criterion 2: 7/10; Criterion 3: 5/10; Total: 21.5 (max: 40)
2025-10-23T16:41:20.417Z [info] Criterion 1: 6/10; Criterion 2: 9/10; Criterion 3: 3/10; Total: 25.5 (max: 40)
2025-10-23T16:41:29.162Z [info] Criterion 1: 4/10; Criterion 2: 7/10; Criterion 3: 5/10; Total: 21.5 (max: 40)
2025-10-23T16:41:36.341Z [info] Criterion 1: 4/10; Criterion 2: 8/10; Criterion 3: 3/10; Total: 21 (max: 40)
2025-10-23T16:41:44.518Z [info] Criterion 1: 6/10; Criterion 2: 8/10; Criterion 3: 5/10; Total: 26 (max: 40)
2025-10-23T16:41:51.798Z [info] Criterion 1: 6/10; Criterion 2: 4/10; Criterion 3: 1/10; Total: 16 (max: 40)
2025-10-23T16:41:59.505Z [info] Criterion 1: 8/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 14.5 (max: 40)
2025-10-23T16:42:02.205Z [info] === TOPIC DEDUPER RESULT ===
2025-10-23T16:42:02.205Z [info] Result type: object
2025-10-23T16:42:02.205Z [info] Has groups? false
2025-10-23T16:42:02.205Z [info] Groups length: 0
2025-10-23T16:42:02.205Z [info] Full result: {
  "raw": "```json\n{\n  \"groups\": [\n    {\n      \"topic_signature\": \"AI Tax Software and Planning\",\n      \"primary_article_index\": 0,\n      \"duplicate_indices\": [2, 7],\n      \"similarity_explanation\": \"Articles 0, 2, and 7 all discuss AI applications in tax planning and software, with article 0 providing the most specific details about a new AI tax planning tool.\"\n    },\n    {\n      \"topic_signature\": \"AI Solutions for Governance and Compliance\",\n      \"primary_article_index\": 1,\n      \"duplicate_indices\": [3],\n      \"similarity_explanation\": \"Articles 1 and 3 both cover AI solutions for governance, risk, and compliance, with article 1 providing specific details about the new AI solution.\"\n    }\n  ],\n  \"unique_articles\": [4, 5, 6, 8, 9]\n}\n```"
}
2025-10-23T16:42:07.881Z [info] Criterion 1: 8/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 14.5 (max: 40)
2025-10-23T16:42:12.844Z [info] Criterion 1: 3/10; Criterion 2: 0/10; Criterion 3: 0/10; Total: 4.5 (max: 40)
2025-10-23T16:42:21.436Z [info] Criterion 1: 6/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 11.5 (max: 40)
2025-10-23T16:42:34.426Z [info] Criterion 1: 6/10; Criterion 2: 3/10; Criterion 3: 3/10; Total: 16.5 (max: 40)
2025-10-23T16:42:40.428Z [info] Criterion 1: 7/10; Criterion 2: 1/10; Criterion 3: 3/10; Total: 15 (max: 40)
2025-10-23T16:42:48.068Z [info] Criterion 1: 7/10; Criterion 2: 1/10; Criterion 3: 3/10; Total: 15 (max: 40)
2025-10-23T16:42:54.693Z [info] Criterion 1: 7/10; Criterion 2: 0/10; Criterion 3: 1/10; Total: 11.5 (max: 40)
2025-10-23T16:43:01.085Z [info] Criterion 1: 7/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 13 (max: 40)
2025-10-23T16:43:07.021Z [info] Criterion 1: 6/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 11.5 (max: 40)
2025-10-23T16:43:15.745Z [info] Criterion 1: 7/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 13 (max: 40)
2025-10-23T16:43:21.813Z [info] Criterion 1: 6/10; Criterion 2: 4/10; Criterion 3: 5/10; Total: 20 (max: 40)
2025-10-23T16:43:27.569Z [info] Criterion 1: 8/10; Criterion 2: 3/10; Criterion 3: 5/10; Total: 21.5 (max: 40)
2025-10-23T16:43:35.774Z [info] === TOPIC DEDUPER RESULT ===
2025-10-23T16:43:35.774Z [info] Result type: object
2025-10-23T16:43:35.774Z [info] Has groups? false
2025-10-23T16:43:35.774Z [info] Groups length: 0
2025-10-23T16:43:35.774Z [info] Full result: {
  "raw": "```json\n{\n  \"groups\": [\n    {\n      \"topic_signature\": \"Horoscopes for October 23, 2025\",\n      \"primary_article_index\": 2,\n      \"duplicate_indices\": [1],\n      \"similarity_explanation\": \"Both articles provide horoscope insights for October 23, 2025, covering multiple sun signs.\"\n    },\n    {\n      \"topic_signature\": \"OpenAI's involvement in AI and education\",\n      \"primary_article_index\": 8,\n      \"duplicate_indices\": [],\n      \"similarity_explanation\": \"This article is unique in its focus on OpenAI's educational initiatives.\"\n    },\n    {\n      \"topic_signature\": \"Google Gemini AI advancements\",\n      \"primary_article_index\": 3,\n      \"duplicate_indices\": [9, 10],\n      \"similarity_explanation\": \"All articles discuss advancements and applications of Google's Gemini AI, including its launch, integration into vehicles, and customer engagement strategies.\"\n    },\n    {\n      \"topic_signature\": \"AI model limitations and issues\",\n      \"primary_article_index\": 4,\n      \"duplicate_indices\": [7],\n      \"similarity_explanation\": \"Both articles address issues and limitations of AI models, particularly focusing on Gemini and ChatGPT.\"\n    },\n    {\n      \"topic_signature\": \"OpenAI's ChatGPT Atlas security concerns\",\n      \"primary_article_index\": 11,\n      \"duplicate_indices\": [5],\n      \"similarity_explanation\": \"Both articles discuss security vulnerabilities and concerns related to OpenAI's ChatGPT Atlas.\"\n    }\n  ],\n  \"unique_articles\": [0, 6]\n}\n```"
}
2025-10-23T16:43:35.898Z [info] [Step 2/4] Complete: 21 posts scored
2025-10-23T16:43:35.898Z [info] [Step 3/4] Generate for campaign 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T16:43:35.899Z [info] Starting primary newsletter article generation...
2025-10-23T16:43:36.146Z [info] Found 0 duplicate posts to exclude
2025-10-23T16:43:36.146Z [info] Found 10 top posts for article generation
2025-10-23T16:43:36.206Z [info] 9 posts have ratings
2025-10-23T16:43:36.322Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T16:43:39.610Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:43:39.610Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:43:42.816Z [error] Error generating article for post d9a65987-aa88-4885-a823-3ad0ef439ceb: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5658)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:43:42.856Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T16:43:47.120Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:43:47.120Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:43:50.552Z [error] Error generating article for post 80d8ff37-520c-414f-8251-44d270b4502f: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5658)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:43:50.596Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T16:43:53.247Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:43:53.247Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:43:55.581Z [error] Error generating article for post 6316617d-e42b-4f78-af82-37c2829862c1: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5658)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:43:55.628Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T16:43:58.232Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:43:58.232Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:44:01.176Z [error] Error generating article for post eaabc6d1-c71b-474f-bdaf-d59187cbd708: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5658)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:44:01.224Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T16:44:05.078Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:44:05.078Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:44:07.652Z [error] Error generating article for post 86e40dd6-3792-4641-97fc-671b8f36af9c: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5658)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:44:07.719Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T16:44:11.662Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:44:11.662Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:44:13.592Z [error] Error generating article for post 71eefedd-f7be-4b3b-9e74-c05b11cca58c: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5658)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:44:13.652Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T16:44:16.073Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:44:16.073Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:44:18.849Z [error] Error generating article for post 3e5b2838-81e2-481e-a0e6-4b65e19098c3: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5658)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:44:19.021Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T16:44:22.295Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:44:22.295Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:44:25.070Z [error] Error generating article for post 0679b44d-a8e7-42d7-833c-e0ed26d2f171: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5658)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:44:25.110Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T16:44:27.651Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:44:27.651Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:44:29.859Z [error] Error generating article for post 5c878942-3c06-45c0-9e09-ad93f658f61d: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5658)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:44:29.859Z [info] primary newsletter article generation complete
2025-10-23T16:44:29.859Z [info] === ABOUT TO SELECT TOP ARTICLES ===
2025-10-23T16:44:29.859Z [info] Selecting top articles for campaign (from lookback window): 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T16:44:29.916Z [info] Max top articles setting: 3
2025-10-23T16:44:29.967Z [info] Searching past 72 hours (since 2025-10-20T16:44:29.966Z) for best unused articles
2025-10-23T16:44:30.012Z [info] Found 17 unused articles in lookback window
2025-10-23T16:44:30.012Z [info] Selected top 3 articles by rating from available pool
2025-10-23T16:44:30.077Z [info] Activated article 6f1214c9-7374-4fbc-9118-d6455703f01a (score: 25.5, rank: 1) - moved from different campaign
2025-10-23T16:44:30.127Z [info] Activated article fa2bce52-4900-43c1-a4d3-939f7dde5ecd (score: 25.5, rank: 2) - moved from different campaign
2025-10-23T16:44:30.173Z [info] Activated article 590aabb7-4779-49fa-8519-5bd2e514c72b (score: 25.5, rank: 3) - moved from different campaign
2025-10-23T16:44:30.173Z [info] Successfully activated 3 articles with ranks 1-3
2025-10-23T16:44:30.173Z [info] === GENERATING SUBJECT LINE (After Article Selection) ===
2025-10-23T16:44:30.173Z [info] Starting subject line generation for campaign: 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T16:44:30.247Z [info] Subject line already exists: SAP Unleashes AI Revolution in Travel
2025-10-23T16:44:30.247Z [info] === SUBJECT LINE GENERATION COMPLETED ===
2025-10-23T16:44:30.247Z [info] Article selection complete
2025-10-23T16:44:30.247Z [info] === TOP ARTICLES SELECTION COMPLETE ===
2025-10-23T16:44:30.247Z [info] === ABOUT TO PROCESS ARTICLE IMAGES ===
2025-10-23T16:44:30.247Z [info] === STARTING IMAGE PROCESSING (GitHub) ===
2025-10-23T16:44:30.247Z [info] Campaign ID: 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T16:44:30.247Z [info] Image processing function started at: 2025-10-23T16:44:30.246Z
2025-10-23T16:44:30.303Z [info] Found 3 active articles to process images for
2025-10-23T16:44:30.303Z [info] Article 1: ID=6f1214c9-7374-4fbc-9118-d6455703f01a, RSS Post Image URL=https://assets.bwbx.io/images/users/iqjWHBFdfxIU/ibi52GQ0bYCs/v1/1200x800.jpg, Title=Spark, Khosla, Sequoia Back Startup Bringing AI to Tax Collection
2025-10-23T16:44:30.303Z [info] Article 2: ID=fa2bce52-4900-43c1-a4d3-939f7dde5ecd, RSS Post Image URL=https://assets.bwbx.io/images/users/iqjWHBFdfxIU/ibi52GQ0bYCs/v1/1200x800.jpg, Title=Spark, Khosla, Sequoia Back Startup Bringing AI to Tax Collection
2025-10-23T16:44:30.303Z [info] Article 3: ID=590aabb7-4779-49fa-8519-5bd2e514c72b, RSS Post Image URL=https://arizent.brightspotcdn.com/dims4/default/40a2a24/2147483647/strip/true/crop/4000x2100+0+284/resize/1200x630!/quality/90/?url=https://source-media-brightspot.s3.us-east-1.amazonaws.com/75/78/fb326acb42bc8ff4448f92807a56/417279958.jpg, Title=SAP rolling out new agents
2025-10-23T16:44:30.303Z [info] Processing image for article 6f1214c9-7374-4fbc-9118-d6455703f01a: https://assets.bwbx.io/images/users/iqjWHBFdfxIU/ibi52GQ0bYCs/v1/1200x800.jpg
2025-10-23T16:44:30.303Z [info] Downloading image from: https://assets.bwbx.io/images/users/iqjWHBFdfxIU/ibi52GQ0bYCs/v1/1200x800.jpg
2025-10-23T16:44:30.394Z [error] GET /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fb676129a66f3c541d0161944fa36d98f.jpg - 404 with id D45C:213F9:D8DAF2:38FA877:68FA5B6E in 71ms
2025-10-23T16:44:30.456Z [error] PUT /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fb676129a66f3c541d0161944fa36d98f.jpg - 404 with id D45C:213F9:D8DB44:38FA9C1:68FA5B6E in 62ms
2025-10-23T16:44:30.457Z [error] Error uploading image to GitHub: Error [HttpError]: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents
    at <unknown> (HttpError: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents)
    at O (.next/server/chunks/5381.js:1:9283)
    at async i.uploadImage (.next/server/chunks/6175.js:1:3984)
    at async m.processArticleImages (.next/server/chunks/3645.js:38:907)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:859)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5658)
    at async g (.next/server/app/api/rss/process/route.js:1:2273) {
  status: 404,
  request: [Object],
  response: [Object]
}
2025-10-23T16:44:30.457Z [error] Failed to upload image to GitHub for article 6f1214c9-7374-4fbc-9118-d6455703f01a
2025-10-23T16:44:30.457Z [info] Processing image for article fa2bce52-4900-43c1-a4d3-939f7dde5ecd: https://assets.bwbx.io/images/users/iqjWHBFdfxIU/ibi52GQ0bYCs/v1/1200x800.jpg
2025-10-23T16:44:30.457Z [info] Downloading image from: https://assets.bwbx.io/images/users/iqjWHBFdfxIU/ibi52GQ0bYCs/v1/1200x800.jpg
2025-10-23T16:44:30.512Z [error] GET /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fb676129a66f3c541d0161944fa36d98f.jpg - 404 with id D45C:213F9:D8DB8F:38FAAFF:68FA5B6E in 50ms
2025-10-23T16:44:30.580Z [error] PUT /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fb676129a66f3c541d0161944fa36d98f.jpg - 404 with id D45C:213F9:D8DBC7:38FABFB:68FA5B6E in 69ms
2025-10-23T16:44:30.581Z [error] Error uploading image to GitHub: Error [HttpError]: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents
    at <unknown> (HttpError: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents)
    at O (.next/server/chunks/5381.js:1:9283)
    at async i.uploadImage (.next/server/chunks/6175.js:1:3984)
    at async m.processArticleImages (.next/server/chunks/3645.js:38:907)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:859)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5658)
    at async g (.next/server/app/api/rss/process/route.js:1:2273) {
  status: 404,
  request: [Object],
  response: [Object]
}
2025-10-23T16:44:30.581Z [error] Failed to upload image to GitHub for article fa2bce52-4900-43c1-a4d3-939f7dde5ecd
2025-10-23T16:44:30.582Z [info] Processing image for article 590aabb7-4779-49fa-8519-5bd2e514c72b: https://arizent.brightspotcdn.com/dims4/default/40a2a24/2147483647/strip/true/crop/4000x2100+0+284/resize/1200x630!/quality/90/?url=https://source-media-brightspot.s3.us-east-1.amazonaws.com/75/78/fb326acb42bc8ff4448f92807a56/417279958.jpg
2025-10-23T16:44:30.582Z [info] Downloading image from: https://arizent.brightspotcdn.com/dims4/default/40a2a24/2147483647/strip/true/crop/4000x2100+0+284/resize/1200x630!/quality/90/?url=https://source-media-brightspot.s3.us-east-1.amazonaws.com/75/78/fb326acb42bc8ff4448f92807a56/417279958.jpg
2025-10-23T16:44:30.699Z [error] GET /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2F35359b7c0c71bf9cb1f33fe24b56d342.jpg - 404 with id D45C:213F9:D8DC33:38FADDF:68FA5B6E in 55ms
2025-10-23T16:44:30.744Z [error] PUT /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2F35359b7c0c71bf9cb1f33fe24b56d342.jpg - 404 with id D45C:213F9:D8DC85:38FAF29:68FA5B6E in 88ms
2025-10-23T16:44:30.745Z [error] Error uploading image to GitHub: Error [HttpError]: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents
    at <unknown> (HttpError: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents)
    at O (.next/server/chunks/5381.js:1:9283)
    at async i.uploadImage (.next/server/chunks/6175.js:1:3984)
    at async m.processArticleImages (.next/server/chunks/3645.js:38:907)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:859)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5658)
    at async g (.next/server/app/api/rss/process/route.js:1:2273) {
  status: 404,
  request: [Object],
  response: [Object]
}
2025-10-23T16:44:30.745Z [error] Failed to upload image to GitHub for article 590aabb7-4779-49fa-8519-5bd2e514c72b
2025-10-23T16:44:30.745Z [info] Image processing complete: 0 uploaded to GitHub, 0 skipped (already hosted), 3 errors
2025-10-23T16:44:30.811Z [info] === ARTICLE IMAGE PROCESSING COMPLETE ===
2025-10-23T16:44:30.811Z [info] Starting secondary newsletter article generation...
2025-10-23T16:44:31.023Z [info] Found 0 duplicate posts to exclude
2025-10-23T16:44:31.023Z [info] Found 34 top posts for article generation
2025-10-23T16:44:31.085Z [info] 12 posts have ratings
2025-10-23T16:44:34.756Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:44:34.756Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:44:38.744Z [error] Error generating article for post ce0801fb-77f3-4b42-9ac1-5f358a7fd356: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5706)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:44:41.612Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:44:41.612Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:44:43.848Z [error] Error generating article for post 0a3b9d7c-9a47-4e5a-a97e-70557f63f40d: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5706)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:44:47.563Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:44:47.563Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:44:48.707Z [error] Error generating article for post 3621e9bd-5415-4a72-9c5b-d87827e433f8: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5706)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:44:51.403Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:44:51.403Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:44:53.439Z [error] Error generating article for post 6156b3e5-28f7-415d-91e7-7a56fedd5e36: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5706)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:44:55.396Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:44:55.396Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:44:56.669Z [error] Error generating article for post 133d890a-d316-4f2b-88bf-76b345e2d088: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5706)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:45:02.649Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:45:02.649Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:45:04.404Z [error] Error generating article for post 06412fb9-b594-4a45-8131-9faa4a2e4356: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5706)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:45:09.411Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:45:09.411Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:45:10.486Z [error] Error generating article for post 2d07ff93-5fa6-414a-abe9-59a81eac9a68: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5706)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:45:22.599Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:45:22.599Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:45:24.856Z [error] Error generating article for post e36ea6bf-ba33-46a3-a534-dffef7ce5664: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5706)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:45:27.534Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:45:27.534Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:45:30.665Z [error] Error generating article for post ec1ec5ee-6247-433e-b640-2704cdc50b4f: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5706)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:45:34.580Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:45:34.581Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:45:36.579Z [error] Error generating article for post af66d010-9d03-4902-8347-24dcd1e2b100: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5706)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:45:40.736Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:45:40.736Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:45:44.087Z [error] Error generating article for post ab71ce89-479e-44de-a3a8-17074fee8d6a: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5706)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:45:48.375Z [info] [AI] Using database prompt for factChecker
2025-10-23T16:45:48.375Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T16:45:49.694Z [error] Error generating article for post b6f38ab7-0b58-451f-bd40-2dde9016b951: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5706)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T16:45:49.694Z [info] secondary newsletter article generation complete
2025-10-23T16:45:49.694Z [info] === ABOUT TO SELECT SECONDARY ARTICLES ===
2025-10-23T16:45:49.694Z [info] Selecting top secondary articles for campaign (from lookback window): 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T16:45:49.748Z [info] Max secondary articles setting: 3
2025-10-23T16:45:49.789Z [info] Searching past 36 hours (since 2025-10-22T04:45:49.787Z) for best unused secondary articles
2025-10-23T16:45:49.885Z [info] Found 3 unused secondary articles in lookback window
2025-10-23T16:45:49.885Z [info] Selected top 3 secondary articles by rating from available pool
2025-10-23T16:45:49.932Z [info] Activated secondary article e557fc18-86b1-4a7c-8011-4944ce473743 (score: 8.5, rank: 1) - moved from different campaign
2025-10-23T16:45:49.986Z [info] Activated secondary article 9963a2a2-af49-49c2-bf70-366677bff5ec (score: 8, rank: 2) - moved from different campaign
2025-10-23T16:45:50.036Z [info] Activated secondary article 5065357d-2a5b-438b-ad9a-02403d9b700d (score: 7, rank: 3) - moved from different campaign
2025-10-23T16:45:50.036Z [info] Successfully activated 3 secondary articles with ranks 1-3
2025-10-23T16:45:50.036Z [info] Secondary article selection complete
2025-10-23T16:45:50.036Z [info] === SECONDARY ARTICLES SELECTION COMPLETE ===
2025-10-23T16:45:50.036Z [info] === ABOUT TO PROCESS ARTICLE IMAGES ===
2025-10-23T16:45:50.036Z [info] === STARTING IMAGE PROCESSING (GitHub) ===
2025-10-23T16:45:50.036Z [info] Campaign ID: 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T16:45:50.036Z [info] Image processing function started at: 2025-10-23T16:45:50.035Z
2025-10-23T16:45:50.089Z [info] Found 3 active articles to process images for
2025-10-23T16:45:50.089Z [info] Article 1: ID=6f1214c9-7374-4fbc-9118-d6455703f01a, RSS Post Image URL=https://assets.bwbx.io/images/users/iqjWHBFdfxIU/ibi52GQ0bYCs/v1/1200x800.jpg, Title=Spark, Khosla, Sequoia Back Startup Bringing AI to Tax Collection
2025-10-23T16:45:50.089Z [info] Article 2: ID=fa2bce52-4900-43c1-a4d3-939f7dde5ecd, RSS Post Image URL=https://assets.bwbx.io/images/users/iqjWHBFdfxIU/ibi52GQ0bYCs/v1/1200x800.jpg, Title=Spark, Khosla, Sequoia Back Startup Bringing AI to Tax Collection
2025-10-23T16:45:50.089Z [info] Article 3: ID=590aabb7-4779-49fa-8519-5bd2e514c72b, RSS Post Image URL=https://arizent.brightspotcdn.com/dims4/default/40a2a24/2147483647/strip/true/crop/4000x2100+0+284/resize/1200x630!/quality/90/?url=https://source-media-brightspot.s3.us-east-1.amazonaws.com/75/78/fb326acb42bc8ff4448f92807a56/417279958.jpg, Title=SAP rolling out new agents
2025-10-23T16:45:50.089Z [info] Processing image for article 6f1214c9-7374-4fbc-9118-d6455703f01a: https://assets.bwbx.io/images/users/iqjWHBFdfxIU/ibi52GQ0bYCs/v1/1200x800.jpg
2025-10-23T16:45:50.089Z [info] Downloading image from: https://assets.bwbx.io/images/users/iqjWHBFdfxIU/ibi52GQ0bYCs/v1/1200x800.jpg
2025-10-23T16:45:50.168Z [error] GET /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fb676129a66f3c541d0161944fa36d98f.jpg - 404 with id B118:297834:2C5C919:BEDB3E1:68FA5BBE in 63ms
2025-10-23T16:45:50.223Z [error] PUT /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fb676129a66f3c541d0161944fa36d98f.jpg - 404 with id B118:297834:2C5C95E:BEDB525:68FA5BBE in 55ms
2025-10-23T16:45:50.224Z [error] Error uploading image to GitHub: Error [HttpError]: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents
    at <unknown> (HttpError: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents)
    at O (.next/server/chunks/5381.js:1:9283)
    at async i.uploadImage (.next/server/chunks/6175.js:1:3984)
    at async m.processArticleImages (.next/server/chunks/3645.js:38:907)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:859)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5706)
    at async g (.next/server/app/api/rss/process/route.js:1:2273) {
  status: 404,
  request: [Object],
  response: [Object]
}
2025-10-23T16:45:50.224Z [error] Failed to upload image to GitHub for article 6f1214c9-7374-4fbc-9118-d6455703f01a
2025-10-23T16:45:50.224Z [info] Processing image for article fa2bce52-4900-43c1-a4d3-939f7dde5ecd: https://assets.bwbx.io/images/users/iqjWHBFdfxIU/ibi52GQ0bYCs/v1/1200x800.jpg
2025-10-23T16:45:50.224Z [info] Downloading image from: https://assets.bwbx.io/images/users/iqjWHBFdfxIU/ibi52GQ0bYCs/v1/1200x800.jpg
2025-10-23T16:45:50.307Z [error] GET /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fb676129a66f3c541d0161944fa36d98f.jpg - 404 with id B118:297834:2C5C9B3:BEDB64C:68FA5BBE in 77ms
2025-10-23T16:45:50.369Z [error] PUT /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fb676129a66f3c541d0161944fa36d98f.jpg - 404 with id B118:297834:2C5CA0B:BEDB800:68FA5BBE in 61ms
2025-10-23T16:45:50.370Z [error] Error uploading image to GitHub: Error [HttpError]: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents
    at <unknown> (HttpError: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents)
    at O (.next/server/chunks/5381.js:1:9283)
    at async i.uploadImage (.next/server/chunks/6175.js:1:3984)
    at async m.processArticleImages (.next/server/chunks/3645.js:38:907)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:859)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5706)
    at async g (.next/server/app/api/rss/process/route.js:1:2273) {
  status: 404,
  request: [Object],
  response: [Object]
}
2025-10-23T16:45:50.370Z [error] Failed to upload image to GitHub for article fa2bce52-4900-43c1-a4d3-939f7dde5ecd
2025-10-23T16:45:50.370Z [info] Processing image for article 590aabb7-4779-49fa-8519-5bd2e514c72b: https://arizent.brightspotcdn.com/dims4/default/40a2a24/2147483647/strip/true/crop/4000x2100+0+284/resize/1200x630!/quality/90/?url=https://source-media-brightspot.s3.us-east-1.amazonaws.com/75/78/fb326acb42bc8ff4448f92807a56/417279958.jpg
2025-10-23T16:45:50.370Z [info] Downloading image from: https://arizent.brightspotcdn.com/dims4/default/40a2a24/2147483647/strip/true/crop/4000x2100+0+284/resize/1200x630!/quality/90/?url=https://source-media-brightspot.s3.us-east-1.amazonaws.com/75/78/fb326acb42bc8ff4448f92807a56/417279958.jpg
2025-10-23T16:45:50.453Z [error] GET /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2F35359b7c0c71bf9cb1f33fe24b56d342.jpg - 404 with id B118:297834:2C5CA5A:BEDB993:68FA5BBE in 62ms
2025-10-23T16:45:50.518Z [error] PUT /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2F35359b7c0c71bf9cb1f33fe24b56d342.jpg - 404 with id B118:297834:2C5CAAA:BEDBACF:68FA5BBE in 65ms
2025-10-23T16:45:50.519Z [error] Error uploading image to GitHub: Error [HttpError]: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents
    at <unknown> (HttpError: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents)
    at O (.next/server/chunks/5381.js:1:9283)
    at async i.uploadImage (.next/server/chunks/6175.js:1:3984)
    at async m.processArticleImages (.next/server/chunks/3645.js:38:907)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:859)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async o (.next/server/app/api/rss/process/route.js:1:5706)
    at async g (.next/server/app/api/rss/process/route.js:1:2273) {
  status: 404,
  request: [Object],
  response: [Object]
}
2025-10-23T16:45:50.519Z [error] Failed to upload image to GitHub for article 590aabb7-4779-49fa-8519-5bd2e514c72b
2025-10-23T16:45:50.519Z [info] Image processing complete: 0 uploaded to GitHub, 0 skipped (already hosted), 3 errors
2025-10-23T16:45:50.577Z [info] === ARTICLE IMAGE PROCESSING COMPLETE ===
2025-10-23T16:45:50.630Z [info] [Step 3/4] Complete: 3 articles
2025-10-23T16:45:50.630Z [info] [Step 4/4] Finalize for campaign 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T16:45:50.822Z [warning] Slack webhook URL not configured
2025-10-23T16:45:50.865Z [warning] Slack webhook URL not configured - cannot send low article count alert
2025-10-23T16:45:50.865Z [info] [Step 4/4] Complete: Campaign finalized
2025-10-23T16:45:50.865Z [info] [RSS] Complete: 3e139a40-b646-4466-8ce0-c8c6a17d2390