2025-10-23T17:08:41.118Z [info] Processing batch 4/5 (10 articles)
2025-10-23T17:08:42.293Z [info] Batch 4 complete: 10 successful, 0 failed
2025-10-23T17:08:43.292Z [info] Processing batch 5/5 (4 articles)
2025-10-23T17:08:43.883Z [info] Batch 5 complete: 4 successful, 0 failed
2025-10-23T17:08:43.883Z [info] Batch extraction complete: 43/44 successful, 1 failed
2025-10-23T17:08:51.571Z [info] Criterion 1: 3/10; Criterion 2: 8/10; Criterion 3: 5/10; Total: 21.5 (max: 40)
2025-10-23T17:09:00.869Z [info] Criterion 1: 3/10; Criterion 2: 8/10; Criterion 3: 5/10; Total: 21.5 (max: 40)
2025-10-23T17:09:07.279Z [info] Criterion 1: 6/10; Criterion 2: 8/10; Criterion 3: 3/10; Total: 24 (max: 40)
2025-10-23T17:11:47.405Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:11:47.406Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:11:51.756Z [error] Error generating article for post c6f819f2-9b05-4c94-9939-d27b9a266d18: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12078)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:11:51.790Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T17:08:28.230Z [info] Session created: {
  email: 'david@ventureformations.com',
  role: 'reviewer',
  isActive: true,
  timestamp: '2025-10-23T17:08:28.230Z'
}
2025-10-23T17:08:28.232Z [info] [RSS] Start: 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T17:08:28.233Z [info] [Step 1/4] Archive + Fetch for campaign 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T17:08:28.234Z [info] === ARCHIVING ARTICLES FOR CAMPAIGN 3e139a40-b646-4466-8ce0-c8c6a17d2390 ===
2025-10-23T17:08:28.234Z [info] Archive reason: rss_processing_clear
2025-10-23T17:08:28.601Z [info] Found 3 articles to archive
2025-10-23T17:08:28.643Z [info] ✅ Archived 3 articles (including 0 with review positions)
2025-10-23T17:08:28.813Z [info] Found 44 posts to archive
2025-10-23T17:08:28.920Z [warning] ⚠️ archived_post_ratings table does not exist - skipping rating archival
2025-10-23T17:08:28.920Z [warning] Run migrations/create_archived_post_ratings.sql to enable rating archival
2025-10-23T17:08:28.920Z [info] ✅ Archived 44 posts with 21 ratings
2025-10-23T17:08:28.920Z [info] ✅ Archive complete: 3 articles, 44 posts, 21 ratings
2025-10-23T17:08:33.983Z [info] [Step 1/4] Complete: 44 posts fetched
2025-10-23T17:08:33.983Z [info] [Step 2/4] Extract + Score for campaign 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T17:08:34.028Z [info] Starting batch extraction of 44 articles (batch size: 10)
2025-10-23T17:08:34.028Z [info] Processing batch 1/5 (10 articles)
2025-10-23T17:08:34.248Z [info] Retry attempt 1 for: https://www.economist.com/business/2025/10/23/openai-and-anthropic-v-app-developers-techs-cronos-syndrome
2025-10-23T17:08:36.292Z [info] Batch 1 complete: 9 successful, 1 failed
2025-10-23T17:08:37.293Z [info] Processing batch 2/5 (10 articles)
2025-10-23T17:08:38.625Z [info] Batch 2 complete: 10 successful, 0 failed
2025-10-23T17:08:39.625Z [info] Processing batch 3/5 (10 articles)
2025-10-23T17:08:40.118Z [info] Batch 3 complete: 10 successful, 0 failed
2025-10-23T17:13:20.648Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:13:20.648Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:13:22.478Z [error] Error generating article for post a48b5d6d-7e98-41eb-8b09-71f993fd1965: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12126)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:10:45.242Z [info] Criterion 1: 7/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 13 (max: 40)
2025-10-23T17:10:51.108Z [info] Criterion 1: 6/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 11.5 (max: 40)
2025-10-23T17:10:58.439Z [info] Criterion 1: 7/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 13 (max: 40)
2025-10-23T17:11:07.210Z [info] Criterion 1: 7/10; Criterion 2: 3/10; Criterion 3: 5/10; Total: 20 (max: 40)
2025-10-23T17:11:14.030Z [info] Criterion 1: 8/10; Criterion 2: 3/10; Criterion 3: 5/10; Total: 21.5 (max: 40)
2025-10-23T17:13:51.530Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:13:51.530Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:13:54.031Z [error] Error generating article for post 127d0211-e623-4ac5-9c0f-f383d5745169: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12126)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:11:39.237Z [info] Criterion 1: 8/10; Criterion 2: 1/10; Criterion 3: 3/10; Total: 16.5 (max: 40)
2025-10-23T17:09:17.430Z [info] Criterion 1: 4/10; Criterion 2: 8/10; Criterion 3: 5/10; Total: 23 (max: 40)
2025-10-23T17:09:25.614Z [info] Criterion 1: 4/10; Criterion 2: 8/10; Criterion 3: 3/10; Total: 21 (max: 40)
2025-10-23T17:09:32.812Z [info] Criterion 1: 4/10; Criterion 2: 7/10; Criterion 3: 5/10; Total: 21.5 (max: 40)
2025-10-23T17:09:40.935Z [info] Criterion 1: 4/10; Criterion 2: 8/10; Criterion 3: 3/10; Total: 21 (max: 40)
2025-10-23T17:09:50.462Z [info] Criterion 1: 6/10; Criterion 2: 8/10; Criterion 3: 5/10; Total: 26 (max: 40)
2025-10-23T17:09:56.819Z [info] Criterion 1: 6/10; Criterion 2: 4/10; Criterion 3: 1/10; Total: 16 (max: 40)
2025-10-23T17:12:29.270Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:12:29.270Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:12:32.597Z [error] Error generating article for post 2b3c0feb-f3ac-4540-8e75-02312816c154: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12078)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:12:32.632Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T17:11:56.011Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:11:56.011Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:12:47.637Z [error] Error generating article for post 154bdb2e-ecd7-4d56-a2e1-ac3426c87385: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12078)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:12:47.637Z [info] primary newsletter article generation complete
2025-10-23T17:12:47.637Z [info] === ABOUT TO SELECT TOP ARTICLES ===
2025-10-23T17:12:47.637Z [info] Selecting top articles for campaign (from lookback window): 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T17:12:47.685Z [info] Max top articles setting: 3
2025-10-23T17:12:47.737Z [info] Searching past 72 hours (since 2025-10-20T17:12:47.736Z) for best unused articles
2025-10-23T17:12:47.777Z [info] Found 14 unused articles in lookback window
2025-10-23T17:12:47.777Z [info] Selected top 3 articles by rating from available pool
2025-10-23T17:12:47.820Z [info] Activated article edf42cdb-e62b-4ae7-b521-931777271fdb (score: 24.5, rank: 1) - moved from different campaign
2025-10-23T17:12:47.872Z [info] Activated article d747f543-aa1e-4950-b2df-806b39353930 (score: 24, rank: 2) - moved from different campaign
2025-10-23T17:12:47.921Z [info] Activated article 78ec402e-91b3-4e31-9e3f-7b22e5c9cd7a (score: 22.5, rank: 3) - moved from different campaign
2025-10-23T17:12:47.921Z [info] Successfully activated 3 articles with ranks 1-3
2025-10-23T17:12:47.921Z [info] === GENERATING SUBJECT LINE (After Article Selection) ===
2025-10-23T17:12:47.922Z [info] Starting subject line generation for campaign: 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T17:12:47.979Z [info] Subject line already exists: SAP Unleashes AI Revolution in Travel
2025-10-23T17:12:47.979Z [info] === SUBJECT LINE GENERATION COMPLETED ===
2025-10-23T17:12:47.979Z [info] Article selection complete
2025-10-23T17:12:47.979Z [info] === TOP ARTICLES SELECTION COMPLETE ===
2025-10-23T17:12:47.979Z [info] === ABOUT TO PROCESS ARTICLE IMAGES ===
2025-10-23T17:12:47.980Z [info] === STARTING IMAGE PROCESSING (GitHub) ===
2025-10-23T17:12:47.980Z [info] Campaign ID: 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T17:12:47.980Z [info] Image processing function started at: 2025-10-23T17:12:47.978Z
2025-10-23T17:12:48.047Z [info] Found 3 active articles to process images for
2025-10-23T17:12:48.047Z [info] Article 1: ID=edf42cdb-e62b-4ae7-b521-931777271fdb, RSS Post Image URL=https://arizent.brightspotcdn.com/dims4/default/40a2a24/2147483647/strip/true/crop/4000x2100+0+284/resize/1200x630!/quality/90/?url=https://source-media-brightspot.s3.us-east-1.amazonaws.com/75/78/fb326acb42bc8ff4448f92807a56/417279958.jpg, Title=SAP rolling out new agents
2025-10-23T17:12:48.047Z [info] Article 2: ID=78ec402e-91b3-4e31-9e3f-7b22e5c9cd7a, RSS Post Image URL=https://db0ip7zd23b50.cloudfront.net/dims4/default/dd837c1/2147483647/strip/false/crop/5857x2258+5+18/resize/960x370!/quality/90/?url=http://bloomberg-bna-brightspot.s3.amazonaws.com/52/cb/6ab5266c4390852702591b0fd48c/gettyimages-1731069032.jpg, Title=Multinationals in Ireland Want Wider R&D Tax Break for AI, Tech
2025-10-23T17:12:48.047Z [info] Article 3: ID=d747f543-aa1e-4950-b2df-806b39353930, RSS Post Image URL=https://assets.bwbx.io/images/users/iqjWHBFdfxIU/ibi52GQ0bYCs/v1/1200x800.jpg, Title=Spark, Khosla, Sequoia Back Startup Bringing AI to Tax Collection
2025-10-23T17:12:48.047Z [info] Processing image for article edf42cdb-e62b-4ae7-b521-931777271fdb: https://arizent.brightspotcdn.com/dims4/default/40a2a24/2147483647/strip/true/crop/4000x2100+0+284/resize/1200x630!/quality/90/?url=https://source-media-brightspot.s3.us-east-1.amazonaws.com/75/78/fb326acb42bc8ff4448f92807a56/417279958.jpg
2025-10-23T17:12:48.047Z [info] Downloading image from: https://arizent.brightspotcdn.com/dims4/default/40a2a24/2147483647/strip/true/crop/4000x2100+0+284/resize/1200x630!/quality/90/?url=https://source-media-brightspot.s3.us-east-1.amazonaws.com/75/78/fb326acb42bc8ff4448f92807a56/417279958.jpg
2025-10-23T17:12:48.131Z [error] GET /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2F35359b7c0c71bf9cb1f33fe24b56d342.jpg - 404 with id C19E:15766B:EBADCB:3E06039:68FA6210 in 61ms
2025-10-23T17:12:48.193Z [error] PUT /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2F35359b7c0c71bf9cb1f33fe24b56d342.jpg - 404 with id C19E:15766B:EBAE12:3E0616A:68FA6210 in 62ms
2025-10-23T17:12:48.194Z [error] Error uploading image to GitHub: Error [HttpError]: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents
    at <unknown> (HttpError: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents)
    at O (.next/server/chunks/5381.js:1:9283)
    at async i.uploadImage (.next/server/chunks/6175.js:1:3984)
    at async m.processArticleImages (.next/server/chunks/3645.js:38:907)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:859)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12078)
    at async g (.next/server/app/api/rss/process/route.js:1:2273) {
  status: 404,
  request: [Object],
  response: [Object]
}
2025-10-23T17:12:48.194Z [error] Failed to upload image to GitHub for article edf42cdb-e62b-4ae7-b521-931777271fdb
2025-10-23T17:12:48.194Z [info] Processing image for article 78ec402e-91b3-4e31-9e3f-7b22e5c9cd7a: https://db0ip7zd23b50.cloudfront.net/dims4/default/dd837c1/2147483647/strip/false/crop/5857x2258+5+18/resize/960x370!/quality/90/?url=http://bloomberg-bna-brightspot.s3.amazonaws.com/52/cb/6ab5266c4390852702591b0fd48c/gettyimages-1731069032.jpg
2025-10-23T17:12:48.194Z [info] Downloading image from: https://db0ip7zd23b50.cloudfront.net/dims4/default/dd837c1/2147483647/strip/false/crop/5857x2258+5+18/resize/960x370!/quality/90/?url=http://bloomberg-bna-brightspot.s3.amazonaws.com/52/cb/6ab5266c4390852702591b0fd48c/gettyimages-1731069032.jpg
2025-10-23T17:12:48.269Z [error] GET /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2F2c6fcdd3918b2c2da7b54443646ca227.jpg - 404 with id C19E:15766B:EBAE7A:3E06302:68FA6210 in 60ms
2025-10-23T17:12:48.351Z [error] PUT /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2F2c6fcdd3918b2c2da7b54443646ca227.jpg - 404 with id C19E:15766B:EBAED4:3E06444:68FA6210 in 81ms
2025-10-23T17:12:48.352Z [error] Error uploading image to GitHub: Error [HttpError]: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents
    at <unknown> (HttpError: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents)
    at O (.next/server/chunks/5381.js:1:9283)
    at async i.uploadImage (.next/server/chunks/6175.js:1:3984)
    at async m.processArticleImages (.next/server/chunks/3645.js:38:907)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:859)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12078)
    at async g (.next/server/app/api/rss/process/route.js:1:2273) {
  status: 404,
  request: [Object],
  response: [Object]
}
2025-10-23T17:12:48.352Z [error] Failed to upload image to GitHub for article 78ec402e-91b3-4e31-9e3f-7b22e5c9cd7a
2025-10-23T17:12:48.352Z [info] Processing image for article d747f543-aa1e-4950-b2df-806b39353930: https://assets.bwbx.io/images/users/iqjWHBFdfxIU/ibi52GQ0bYCs/v1/1200x800.jpg
2025-10-23T17:12:48.352Z [info] Downloading image from: https://assets.bwbx.io/images/users/iqjWHBFdfxIU/ibi52GQ0bYCs/v1/1200x800.jpg
2025-10-23T17:12:48.428Z [error] GET /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fb676129a66f3c541d0161944fa36d98f.jpg - 404 with id C19E:15766B:EBAF44:3E065ED:68FA6210 in 60ms
2025-10-23T17:12:48.492Z [error] PUT /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fb676129a66f3c541d0161944fa36d98f.jpg - 404 with id C19E:15766B:EBAF87:3E0671C:68FA6210 in 64ms
2025-10-23T17:12:48.493Z [error] Error uploading image to GitHub: Error [HttpError]: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents
    at <unknown> (HttpError: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents)
    at O (.next/server/chunks/5381.js:1:9283)
    at async i.uploadImage (.next/server/chunks/6175.js:1:3984)
    at async m.processArticleImages (.next/server/chunks/3645.js:38:907)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:859)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12078)
    at async g (.next/server/app/api/rss/process/route.js:1:2273) {
  status: 404,
  request: [Object],
  response: [Object]
}
2025-10-23T17:12:48.493Z [error] Failed to upload image to GitHub for article d747f543-aa1e-4950-b2df-806b39353930
2025-10-23T17:12:48.493Z [info] Image processing complete: 0 uploaded to GitHub, 0 skipped (already hosted), 3 errors
2025-10-23T17:12:48.543Z [info] === ARTICLE IMAGE PROCESSING COMPLETE ===
2025-10-23T17:12:48.543Z [info] Starting secondary newsletter article generation...
2025-10-23T17:12:48.692Z [info] Found 0 duplicate posts to exclude
2025-10-23T17:12:48.692Z [info] Found 34 top posts for article generation
2025-10-23T17:12:48.735Z [info] 12 posts have ratings
2025-10-23T17:11:23.701Z [info] Criterion 1: 8/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 14.5 (max: 40)
2025-10-23T17:13:05.978Z [error] Error generating article for post bb0797f0-f747-47c0-b797-b5c1efa496a3: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12126)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:11:43.324Z [info] === TOPIC DEDUPER RESULT ===
2025-10-23T17:11:43.324Z [info] Result type: object
2025-10-23T17:11:43.324Z [info] Has groups? false
2025-10-23T17:11:43.324Z [info] Groups length: 0
2025-10-23T17:11:43.324Z [info] Full result: {
  "raw": "```json\n{\n  \"groups\": [\n    {\n      \"topic_signature\": \"OpenAI's ChatGPT Atlas security vulnerabilities\",\n      \"primary_article_index\": 8,\n      \"duplicate_indices\": [2, 10, 11],\n      \"similarity_explanation\": \"These articles discuss the security vulnerabilities and issues related to OpenAI's ChatGPT Atlas, including prompt injection attacks and potential risks.\"\n    },\n    {\n      \"topic_signature\": \"Google Gemini AI advancements and applications\",\n      \"primary_article_index\": 1,\n      \"duplicate_indices\": [6, 7, 9],\n      \"similarity_explanation\": \"These articles cover various advancements and applications of Google's Gemini AI, including its integration in vehicles, customer engagement, and concerns about its role in spreading fake news.\"\n    }\n  ],\n  \"unique_articles\": [0, 3, 4, 5]\n}\n```"
}
2025-10-23T17:11:43.367Z [info] [Step 2/4] Complete: 22 posts scored
2025-10-23T17:11:43.367Z [info] [Step 3/4] Generate for campaign 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T17:11:43.369Z [info] Starting primary newsletter article generation...
2025-10-23T17:11:43.507Z [info] Found 0 duplicate posts to exclude
2025-10-23T17:11:43.507Z [info] Found 10 top posts for article generation
2025-10-23T17:11:43.556Z [info] 10 posts have ratings
2025-10-23T17:11:43.692Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T17:14:02.816Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:14:02.816Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:12:00.951Z [error] Error generating article for post 8ee8da2a-812c-4a27-a8fa-dbc18f689b92: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12078)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:12:00.982Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T17:11:31.897Z [info] Criterion 1: 7/10; Criterion 2: 1/10; Criterion 3: 3/10; Total: 15 (max: 40)
2025-10-23T17:12:19.252Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:12:19.252Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:12:21.351Z [error] Error generating article for post 241da05a-84e2-47b2-aadf-3b63359a7f30: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12078)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:12:21.386Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T17:12:24.121Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:12:24.121Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:12:25.998Z [error] Error generating article for post abfd9f55-5646-4b24-b8e6-458c46df6291: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12078)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:12:26.037Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T17:12:35.385Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:12:35.385Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:12:39.619Z [error] Error generating article for post 50cdb128-2e3a-45b9-80ba-402e3a952abe: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12078)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:12:39.665Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T17:12:43.387Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:12:43.387Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:13:26.963Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:13:26.963Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:13:31.919Z [error] Error generating article for post dc7628fd-d60d-424a-8ff7-9206e790bd9a: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12126)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:12:53.231Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:12:53.231Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:12:54.964Z [error] Error generating article for post 51549471-c63e-4e92-a1d2-972b188acaad: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12126)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:12:59.802Z [error] Error generating article for post 63761e35-554a-4fdb-a25a-8e75c541c4ca: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12126)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:12:58.165Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:12:58.165Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:13:04.091Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:13:04.091Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:13:09.651Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:13:09.652Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:13:10.577Z [error] Error generating article for post ff9166b7-2a98-4395-a985-460d6b4565b1: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12126)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:12:03.594Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:12:03.594Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:12:05.332Z [error] Error generating article for post d3246e32-9293-4f3a-8d09-9a2cb51ac281: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12078)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:12:05.400Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T17:12:08.328Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:12:08.328Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:13:44.767Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:13:44.767Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:13:48.424Z [error] Error generating article for post fb2cb49b-0033-4657-a86e-a3719133ab3f: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12126)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:10:07.279Z [info] Criterion 1: 8/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 14.5 (max: 40)
2025-10-23T17:10:11.539Z [info] === TOPIC DEDUPER RESULT ===
2025-10-23T17:10:11.539Z [info] Result type: object
2025-10-23T17:10:11.539Z [info] Has groups? false
2025-10-23T17:10:11.539Z [info] Groups length: 0
2025-10-23T17:10:11.539Z [info] Full result: {
  "raw": "```json\n{\n  \"groups\": [\n    {\n      \"topic_signature\": \"AI tax planning and software\",\n      \"primary_article_index\": 0,\n      \"duplicate_indices\": [2, 7],\n      \"similarity_explanation\": \"Articles 0, 2, and 7 all discuss AI integration in tax planning or systems, focusing on software and technology advancements in the tax industry.\"\n    },\n    {\n      \"topic_signature\": \"AI solutions for governance and compliance\",\n      \"primary_article_index\": 1,\n      \"duplicate_indices\": [3],\n      \"similarity_explanation\": \"Articles 1 and 3 both cover AI solutions related to governance, risk, and compliance, with a focus on AI tools and platforms for these areas.\"\n    }\n  ],\n  \"unique_articles\": [4, 5, 6, 8, 9]\n}\n```"
}
2025-10-23T17:10:18.905Z [info] Criterion 1: 6/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 11.5 (max: 40)
2025-10-23T17:10:25.824Z [info] Criterion 1: 7/10; Criterion 2: 3/10; Criterion 3: 3/10; Total: 18 (max: 40)
2025-10-23T17:10:32.501Z [info] Criterion 1: 7/10; Criterion 2: 1/10; Criterion 3: 3/10; Total: 15 (max: 40)
2025-10-23T17:10:40.146Z [info] Criterion 1: 7/10; Criterion 2: 0/10; Criterion 3: 1/10; Total: 11.5 (max: 40)
2025-10-23T17:13:57.451Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:13:57.451Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:14:00.158Z [error] Error generating article for post 03214177-9887-4826-ac78-644456aff03d: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12126)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:12:09.937Z [error] Error generating article for post 868afd6d-cf79-45c0-a5b2-61ce8ccc9b3d: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12078)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:12:09.973Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T17:12:14.850Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:12:14.850Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T17:12:15.830Z [error] Error generating article for post 4fc7de77-a003-441c-a0be-53d3b015ad91: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12078)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:12:15.860Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T17:14:08.977Z [error] Error generating article for post 29acd566-3c84-4b9f-994e-c3b01ebf39eb: Error: Invalid fact-check response
    at m.factCheckContent (.next/server/chunks/3645.js:38:3507)
    at async m.processPostIntoArticle (.next/server/chunks/3645.js:38:1795)
    at async m.generateNewsletterArticles (.next/server/chunks/3645.js:13:386)
    at async m.generateArticlesForSection (.next/server/chunks/3645.js:4:7210)
    at async n (.next/server/app/api/cron/rss-processing/route.js:1:12126)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T17:14:12.078Z [info] [AI] Using database prompt for factChecker
2025-10-23T17:14:12.078Z [info] [AI] Using plain text prompt for factChecker