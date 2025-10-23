2025-10-23T19:34:32.432Z [info] Session created: {
  email: 'david@ventureformations.com',
  role: 'reviewer',
  isActive: true,
  timestamp: '2025-10-23T19:34:32.432Z'
}
2025-10-23T19:34:32.434Z [info] [RSS] Start: 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T19:34:32.434Z [info] [Step 1/4] Archive + Fetch for campaign 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T19:34:32.436Z [info] === ARCHIVING ARTICLES FOR CAMPAIGN 3e139a40-b646-4466-8ce0-c8c6a17d2390 ===
2025-10-23T19:34:32.436Z [info] Archive reason: rss_processing_clear
2025-10-23T19:34:32.560Z [info] Found 6 articles to archive
2025-10-23T19:34:32.606Z [info] ✅ Archived 6 articles (including 0 with review positions)
2025-10-23T19:34:32.682Z [info] Found 49 posts to archive
2025-10-23T19:34:32.793Z [warning] ⚠️ archived_post_ratings table does not exist - skipping rating archival
2025-10-23T19:34:32.793Z [warning] Run migrations/create_archived_post_ratings.sql to enable rating archival
2025-10-23T19:34:32.793Z [info] ✅ Archived 49 posts with 18 ratings
2025-10-23T19:34:32.793Z [info] ✅ Archive complete: 6 articles, 49 posts, 18 ratings
2025-10-23T19:34:38.141Z [info] [Step 1/4] Complete: 49 posts fetched
2025-10-23T19:34:38.142Z [info] [Step 2/4] Extract + Score for campaign 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T19:34:38.188Z [info] Starting batch extraction of 49 articles (batch size: 10)
2025-10-23T19:34:38.188Z [info] Processing batch 1/5 (10 articles)
2025-10-23T19:34:39.200Z [info] Batch 1 complete: 10 successful, 0 failed
2025-10-23T19:34:40.200Z [info] Processing batch 2/5 (10 articles)
2025-10-23T19:34:41.279Z [info] Batch 2 complete: 10 successful, 0 failed
2025-10-23T19:34:42.280Z [info] Processing batch 3/5 (10 articles)
2025-10-23T19:34:42.317Z [info] Retry attempt 1 for: https://www.theinformation.com/articles/airbnb-ceo-throws-subtle-shade-openai-khoslas-enterprise-ai-fix
2025-10-23T19:34:42.356Z [info] Retry attempt 1 for: https://www.axios.com/2025/10/23/anthropic-claude-memory-subscribers
2025-10-23T19:34:42.472Z [info] Retry attempt 1 for: https://www.technology.org/2025/10/23/googles-gemini-gets-smarter-about-when-youre-actually-done-talking/
2025-10-23T19:34:44.503Z [info] Batch 3 complete: 7 successful, 3 failed
2025-10-23T19:34:45.503Z [info] Processing batch 4/5 (10 articles)
2025-10-23T19:34:45.633Z [info] Retry attempt 1 for: https://www.startuphub.ai/ai-news/ai-video/2025/claudes-new-memory-feature-elevates-ai-personalization/
2025-10-23T19:34:47.690Z [info] Batch 4 complete: 9 successful, 1 failed
2025-10-23T19:34:48.692Z [info] Processing batch 5/5 (9 articles)
2025-10-23T19:34:48.763Z [info] Retry attempt 1 for: https://www.economist.com/business/2025/10/23/openai-and-anthropic-v-app-developers-techs-cronos-syndrome
2025-10-23T19:34:50.787Z [info] Batch 5 complete: 8 successful, 1 failed
2025-10-23T19:34:50.787Z [info] Batch extraction complete: 44/49 successful, 5 failed
2025-10-23T19:34:59.796Z [info] Criterion 1: 4/10; Criterion 2: 7/10; Criterion 3: 5/10; Total: 21.5 (max: 40)
2025-10-23T19:35:05.610Z [info] Criterion 1: 4/10; Criterion 2: 8/10; Criterion 3: 5/10; Total: 23 (max: 40)
2025-10-23T19:35:12.696Z [info] Criterion 1: 6/10; Criterion 2: 8/10; Criterion 3: 5/10; Total: 26 (max: 40)
2025-10-23T19:35:21.987Z [info] Criterion 1: 6/10; Criterion 2: 4/10; Criterion 3: 1/10; Total: 16 (max: 40)
2025-10-23T19:35:28.510Z [info] Criterion 1: 8/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 14.5 (max: 40)
2025-10-23T19:37:52.154Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:37:52.154Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:37:03.767Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:37:03.767Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:37:04.984Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T19:37:09.975Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:37:09.975Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:35:34.351Z [info] Criterion 1: 4/10; Criterion 2: 8/10; Criterion 3: 6/10; Total: 24 (max: 40)
2025-10-23T19:35:36.424Z [info] === TOPIC DEDUPER RESULT ===
2025-10-23T19:35:36.424Z [info] Result type: object
2025-10-23T19:35:36.424Z [info] Has groups? false
2025-10-23T19:35:36.424Z [info] Groups length: 0
2025-10-23T19:35:36.424Z [info] Full result: {
  "raw": "```json\n{\n  \"groups\": [\n    {\n      \"topic_signature\": \"AI solutions and enhancements at conferences\",\n      \"primary_article_index\": 0,\n      \"duplicate_indices\": [1, 5],\n      \"similarity_explanation\": \"All articles discuss AI solutions and enhancements being showcased or released at various conferences.\"\n    }\n  ],\n  \"unique_articles\": [2, 3, 4]\n}\n```"
}
2025-10-23T19:35:43.213Z [info] Criterion 1: 8/10; Criterion 2: 1/10; Criterion 3: 3/10; Total: 16.5 (max: 40)
2025-10-23T19:35:48.194Z [info] Criterion 1: 8/10; Criterion 2: 1/10; Criterion 3: 3/10; Total: 16.5 (max: 40)
2025-10-23T19:35:54.178Z [info] Criterion 1: 6/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 11.5 (max: 40)
2025-10-23T19:36:00.811Z [info] Criterion 1: 6/10; Criterion 2: 1/10; Criterion 3: 3/10; Total: 13.5 (max: 40)
2025-10-23T19:36:05.447Z [info] Criterion 1: 4/10; Criterion 2: 0/10; Criterion 3: 1/10; Total: 7 (max: 40)
2025-10-23T19:37:19.273Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:37:19.273Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:37:20.188Z [info] primary newsletter article generation complete
2025-10-23T19:37:20.188Z [info] === ABOUT TO SELECT TOP ARTICLES ===
2025-10-23T19:37:20.188Z [info] Selecting top articles for campaign (from lookback window): 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T19:37:20.254Z [info] Max top articles setting: 3
2025-10-23T19:37:20.317Z [info] Searching past 72 hours (since 2025-10-20T19:37:20.316Z) for best unused articles
2025-10-23T19:37:20.415Z [info] Found 14 unused articles in lookback window
2025-10-23T19:37:20.415Z [info] Selected top 3 articles by rating from available pool
2025-10-23T19:37:20.475Z [info] Activated article 7edcba63-3ff5-489e-8103-9dea0c1dc699 (score: 26, rank: 1)
2025-10-23T19:36:48.527Z [info] Criterion 1: 7/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 13 (max: 40)
2025-10-23T19:36:52.634Z [info] Found 0 duplicate posts to exclude
2025-10-23T19:36:52.634Z [info] Found 6 top posts for article generation
2025-10-23T19:36:52.672Z [info] 6 posts have ratings
2025-10-23T19:36:52.753Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T19:36:55.593Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:36:55.593Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:36:59.451Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:36:59.452Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:37:01.343Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T19:37:11.342Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T19:37:14.332Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:37:14.332Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:37:15.968Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T19:38:13.176Z [info] secondary newsletter article generation complete
2025-10-23T19:38:13.176Z [info] === ABOUT TO SELECT SECONDARY ARTICLES ===
2025-10-23T19:38:13.176Z [info] Selecting top secondary articles for campaign (from lookback window): 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T19:38:13.255Z [info] Max secondary articles setting: 3
2025-10-23T19:38:13.299Z [info] Searching past 36 hours (since 2025-10-22T07:38:13.297Z) for best unused secondary articles
2025-10-23T19:38:13.353Z [info] Found 8 unused secondary articles in lookback window
2025-10-23T19:38:13.353Z [info] Selected top 3 secondary articles by rating from available pool
2025-10-23T19:38:13.404Z [info] Activated secondary article f15b11ed-b030-4696-8e26-9ec7ef658776 (score: 16.5, rank: 1)
2025-10-23T19:38:13.441Z [info] Activated secondary article 2a2d1884-978f-44ed-b435-00b3c3686004 (score: 16.5, rank: 2)
2025-10-23T19:38:13.478Z [info] Activated secondary article 8cde85b0-41b4-4f4a-8ea6-429764d6bdbf (score: 14.5, rank: 3)
2025-10-23T19:38:13.478Z [info] Successfully activated 3 secondary articles with ranks 1-3
2025-10-23T19:38:13.478Z [info] Secondary article selection complete
2025-10-23T19:38:13.478Z [info] === SECONDARY ARTICLES SELECTION COMPLETE ===
2025-10-23T19:38:13.478Z [info] === ABOUT TO PROCESS ARTICLE IMAGES ===
2025-10-23T19:38:13.478Z [info] === STARTING IMAGE PROCESSING (GitHub) ===
2025-10-23T19:38:13.478Z [info] Campaign ID: 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T19:38:13.478Z [info] Image processing function started at: 2025-10-23T19:38:13.476Z
2025-10-23T19:38:14.534Z [error] GET /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fb40f6ea47bdcb5cd4f6a1632063b2d7e.jpg - 404 with id ED6A:277BDE:22E83B4:945FAA6:68FA8425 in 48ms
2025-10-23T19:38:14.624Z [error] PUT /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fb40f6ea47bdcb5cd4f6a1632063b2d7e.jpg - 404 with id ED6A:277BDE:22E83FB:945FBF1:68FA8426 in 89ms
2025-10-23T19:38:14.624Z [error] Error uploading image to GitHub: Error [HttpError]: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents
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
2025-10-23T19:38:14.624Z [error] Failed to upload image to GitHub for article c4270ea1-d813-49d5-a105-558d7f3028c9
2025-10-23T19:38:14.624Z [info] Image processing complete: 0 uploaded to GitHub, 0 skipped (already hosted), 3 errors
2025-10-23T19:38:14.678Z [info] === ARTICLE IMAGE PROCESSING COMPLETE ===
2025-10-23T19:38:14.716Z [info] [Step 3/4] Complete: 6 articles
2025-10-23T19:38:14.717Z [info] [Step 4/4] Finalize for campaign 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T19:38:14.717Z [info] [RSS] Generating welcome section...
2025-10-23T19:38:14.815Z [info] [RSS] Generating welcome from 3 primary and 3 secondary articles
2025-10-23T19:38:14.856Z [info] [AI] Using database prompt for welcomeSection
2025-10-23T19:38:14.856Z [info] [AI] Using plain text prompt for welcomeSection
2025-10-23T19:37:20.516Z [info] Activated article a02fc088-3f37-4056-a3ca-779b067b0463 (score: 24, rank: 2)
2025-10-23T19:37:20.565Z [info] Activated article c4270ea1-d813-49d5-a105-558d7f3028c9 (score: 23, rank: 3)
2025-10-23T19:37:20.565Z [info] Successfully activated 3 articles with ranks 1-3
2025-10-23T19:37:20.565Z [info] === GENERATING SUBJECT LINE (After Article Selection) ===
2025-10-23T19:37:20.565Z [info] Starting subject line generation for campaign: 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T19:37:20.617Z [info] Subject line already exists: SAP Unleashes AI Revolution in Travel
2025-10-23T19:37:20.617Z [info] === SUBJECT LINE GENERATION COMPLETED ===
2025-10-23T19:37:20.617Z [info] Article selection complete
2025-10-23T19:37:20.617Z [info] === TOP ARTICLES SELECTION COMPLETE ===
2025-10-23T19:37:20.617Z [info] === ABOUT TO PROCESS ARTICLE IMAGES ===
2025-10-23T19:37:20.617Z [info] === STARTING IMAGE PROCESSING (GitHub) ===
2025-10-23T19:37:20.617Z [info] Campaign ID: 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T19:37:20.617Z [info] Image processing function started at: 2025-10-23T19:37:20.616Z
2025-10-23T19:37:20.664Z [info] Found 3 active articles to process images for
2025-10-23T19:37:20.664Z [info] Article 1: ID=7edcba63-3ff5-489e-8103-9dea0c1dc699, RSS Post Image URL=https://parameter.io/wp-content/uploads/2025/10/shutterstock_2527102223-scaled.jpg, Title=Indonesian Customs and Tax Systems Set for AI Integration
2025-10-23T19:37:20.664Z [info] Article 2: ID=a02fc088-3f37-4056-a3ca-779b067b0463, RSS Post Image URL=https://arizent.brightspotcdn.com/dims4/default/02e9942/2147483647/strip/true/crop/1697x955+0+163/resize/1200x675!/quality/90/?url=https://source-media-brightspot.s3.us-east-1.amazonaws.com/cc/5f/4f7afde44d0db2e4bf7da7014d5a/wolters-kluwer-hq-1.jpg, Title=Wolters Kluwer rolls out AI enhancements for audit, client collab
2025-10-23T19:37:20.664Z [info] Article 3: ID=c4270ea1-d813-49d5-a105-558d7f3028c9, RSS Post Image URL=https://ml.globenewswire.com/Resource/Download/a572c41a-3841-4c47-8ce3-84a0557dc949, Title=Integra Balance AI showcases cutting-edge AI solutions at CPA America annual leadership retreat 2025
2025-10-23T19:37:20.664Z [info] Processing image for article 7edcba63-3ff5-489e-8103-9dea0c1dc699: https://parameter.io/wp-content/uploads/2025/10/shutterstock_2527102223-scaled.jpg
2025-10-23T19:37:20.665Z [info] Downloading image from: https://parameter.io/wp-content/uploads/2025/10/shutterstock_2527102223-scaled.jpg
2025-10-23T19:37:20.786Z [error] GET /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fce88f73def8ce47c93303eae8a8ace1c.jpg - 404 with id C1EA:AF0AF:36A2759:E915125:68FA83F0 in 69ms
2025-10-23T19:37:20.871Z [error] PUT /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fce88f73def8ce47c93303eae8a8ace1c.jpg - 404 with id C1EA:AF0AF:36A279C:E9152AD:68FA83F0 in 85ms
2025-10-23T19:37:20.876Z [error] Error uploading image to GitHub: Error [HttpError]: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents
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
2025-10-23T19:37:20.876Z [error] Failed to upload image to GitHub for article 7edcba63-3ff5-489e-8103-9dea0c1dc699
2025-10-23T19:37:20.876Z [info] Processing image for article a02fc088-3f37-4056-a3ca-779b067b0463: https://arizent.brightspotcdn.com/dims4/default/02e9942/2147483647/strip/true/crop/1697x955+0+163/resize/1200x675!/quality/90/?url=https://source-media-brightspot.s3.us-east-1.amazonaws.com/cc/5f/4f7afde44d0db2e4bf7da7014d5a/wolters-kluwer-hq-1.jpg
2025-10-23T19:37:20.876Z [info] Downloading image from: https://arizent.brightspotcdn.com/dims4/default/02e9942/2147483647/strip/true/crop/1697x955+0+163/resize/1200x675!/quality/90/?url=https://source-media-brightspot.s3.us-east-1.amazonaws.com/cc/5f/4f7afde44d0db2e4bf7da7014d5a/wolters-kluwer-hq-1.jpg
2025-10-23T19:37:21.356Z [error] GET /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2F83ff637bc695f4acf3fad92d758a5d5d.jpg - 404 with id C1EA:AF0AF:36A29E2:E915C65:68FA83F0 in 69ms
2025-10-23T19:37:21.434Z [error] PUT /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2F83ff637bc695f4acf3fad92d758a5d5d.jpg - 404 with id C1EA:AF0AF:36A2A3B:E915DE6:68FA83F1 in 78ms
2025-10-23T19:37:21.435Z [error] Error uploading image to GitHub: Error [HttpError]: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents
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
2025-10-23T19:37:21.435Z [error] Failed to upload image to GitHub for article a02fc088-3f37-4056-a3ca-779b067b0463
2025-10-23T19:37:21.435Z [info] Processing image for article c4270ea1-d813-49d5-a105-558d7f3028c9: https://ml.globenewswire.com/Resource/Download/a572c41a-3841-4c47-8ce3-84a0557dc949
2025-10-23T19:37:21.435Z [info] Downloading image from: https://ml.globenewswire.com/Resource/Download/a572c41a-3841-4c47-8ce3-84a0557dc949
2025-10-23T19:37:21.657Z [error] GET /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fb40f6ea47bdcb5cd4f6a1632063b2d7e.jpg - 404 with id C1EA:AF0AF:36A2B35:E916203:68FA83F1 in 89ms
2025-10-23T19:37:21.724Z [error] PUT /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fb40f6ea47bdcb5cd4f6a1632063b2d7e.jpg - 404 with id C1EA:AF0AF:36A2B9B:E9163B8:68FA83F1 in 66ms
2025-10-23T19:37:21.724Z [error] Error uploading image to GitHub: Error [HttpError]: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents
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
2025-10-23T19:37:21.724Z [error] Failed to upload image to GitHub for article c4270ea1-d813-49d5-a105-558d7f3028c9
2025-10-23T19:37:21.724Z [info] Image processing complete: 0 uploaded to GitHub, 0 skipped (already hosted), 3 errors
2025-10-23T19:37:21.762Z [info] === ARTICLE IMAGE PROCESSING COMPLETE ===
2025-10-23T19:37:21.762Z [info] Starting secondary newsletter article generation...
2025-10-23T19:37:21.939Z [info] Found 0 duplicate posts to exclude
2025-10-23T19:37:21.939Z [info] Found 43 top posts for article generation
2025-10-23T19:37:21.990Z [info] 12 posts have ratings
2025-10-23T19:37:24.601Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:37:24.601Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:37:36.189Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:37:36.189Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:38:07.075Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:38:07.075Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:37:48.346Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:37:48.346Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:37:40.897Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:37:40.897Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:37:44.961Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:37:44.961Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:37:57.631Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:37:57.631Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:38:01.854Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:38:01.854Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:38:11.165Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:38:11.165Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:38:13.521Z [info] Found 3 active articles to process images for
2025-10-23T19:38:13.521Z [info] Article 1: ID=7edcba63-3ff5-489e-8103-9dea0c1dc699, RSS Post Image URL=https://parameter.io/wp-content/uploads/2025/10/shutterstock_2527102223-scaled.jpg, Title=Indonesian Customs and Tax Systems Set for AI Integration
2025-10-23T19:38:13.522Z [info] Article 2: ID=a02fc088-3f37-4056-a3ca-779b067b0463, RSS Post Image URL=https://arizent.brightspotcdn.com/dims4/default/02e9942/2147483647/strip/true/crop/1697x955+0+163/resize/1200x675!/quality/90/?url=https://source-media-brightspot.s3.us-east-1.amazonaws.com/cc/5f/4f7afde44d0db2e4bf7da7014d5a/wolters-kluwer-hq-1.jpg, Title=Wolters Kluwer rolls out AI enhancements for audit, client collab
2025-10-23T19:38:13.522Z [info] Article 3: ID=c4270ea1-d813-49d5-a105-558d7f3028c9, RSS Post Image URL=https://ml.globenewswire.com/Resource/Download/a572c41a-3841-4c47-8ce3-84a0557dc949, Title=Integra Balance AI showcases cutting-edge AI solutions at CPA America annual leadership retreat 2025
2025-10-23T19:38:13.522Z [info] Processing image for article 7edcba63-3ff5-489e-8103-9dea0c1dc699: https://parameter.io/wp-content/uploads/2025/10/shutterstock_2527102223-scaled.jpg
2025-10-23T19:38:13.522Z [info] Downloading image from: https://parameter.io/wp-content/uploads/2025/10/shutterstock_2527102223-scaled.jpg
2025-10-23T19:38:13.652Z [error] GET /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fce88f73def8ce47c93303eae8a8ace1c.jpg - 404 with id ED6A:277BDE:22E7EFE:945E5D0:68FA8425 in 78ms
2025-10-23T19:38:13.754Z [error] PUT /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2Fce88f73def8ce47c93303eae8a8ace1c.jpg - 404 with id ED6A:277BDE:22E7F63:945E78F:68FA8425 in 101ms
2025-10-23T19:38:13.755Z [error] Error uploading image to GitHub: Error [HttpError]: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents
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
2025-10-23T19:38:13.755Z [error] Failed to upload image to GitHub for article 7edcba63-3ff5-489e-8103-9dea0c1dc699
2025-10-23T19:38:13.755Z [info] Processing image for article a02fc088-3f37-4056-a3ca-779b067b0463: https://arizent.brightspotcdn.com/dims4/default/02e9942/2147483647/strip/true/crop/1697x955+0+163/resize/1200x675!/quality/90/?url=https://source-media-brightspot.s3.us-east-1.amazonaws.com/cc/5f/4f7afde44d0db2e4bf7da7014d5a/wolters-kluwer-hq-1.jpg
2025-10-23T19:38:13.755Z [info] Downloading image from: https://arizent.brightspotcdn.com/dims4/default/02e9942/2147483647/strip/true/crop/1697x955+0+163/resize/1200x675!/quality/90/?url=https://source-media-brightspot.s3.us-east-1.amazonaws.com/cc/5f/4f7afde44d0db2e4bf7da7014d5a/wolters-kluwer-hq-1.jpg
2025-10-23T19:38:13.829Z [error] GET /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2F83ff637bc695f4acf3fad92d758a5d5d.jpg - 404 with id ED6A:277BDE:22E8006:945EA4A:68FA8425 in 57ms
2025-10-23T19:38:13.901Z [error] PUT /repos/Venture-Formations/Venture-Formations%2Faiprodaily/contents/newsletter-images%2F83ff637bc695f4acf3fad92d758a5d5d.jpg - 404 with id ED6A:277BDE:22E805F:945EB9C:68FA8425 in 72ms
2025-10-23T19:38:13.902Z [error] Error uploading image to GitHub: Error [HttpError]: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents
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
2025-10-23T19:38:13.902Z [error] Failed to upload image to GitHub for article a02fc088-3f37-4056-a3ca-779b067b0463
2025-10-23T19:38:13.902Z [info] Processing image for article c4270ea1-d813-49d5-a105-558d7f3028c9: https://ml.globenewswire.com/Resource/Download/a572c41a-3841-4c47-8ce3-84a0557dc949
2025-10-23T19:38:13.902Z [info] Downloading image from: https://ml.globenewswire.com/Resource/Download/a572c41a-3841-4c47-8ce3-84a0557dc949
2025-10-23T19:38:19.352Z [info] [RSS] Welcome section generated (length: 0 )
2025-10-23T19:38:19.358Z [error] [RSS] Failed to parse welcome JSON, using fallback: SyntaxError: Unexpected end of JSON input
    at JSON.parse (<anonymous>)
    at m.generateWelcomeSection (.next/server/chunks/3645.js:38:4849)
    at async i (.next/server/app/api/rss/process/route.js:1:6089)
    at async g (.next/server/app/api/rss/process/route.js:1:2273)
2025-10-23T19:38:19.612Z [warning] Slack webhook URL not configured
2025-10-23T19:38:19.646Z [warning] Slack webhook URL not configured - cannot send low article count alert
2025-10-23T19:38:19.646Z [info] [Step 4/4] Complete: Campaign finalized
2025-10-23T19:38:19.646Z [info] [RSS] Complete: 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T19:36:52.439Z [info] === TOPIC DEDUPER RESULT ===
2025-10-23T19:36:52.439Z [info] Result type: object
2025-10-23T19:36:52.439Z [info] Has groups? false
2025-10-23T19:36:52.439Z [info] Groups length: 0
2025-10-23T19:36:52.439Z [info] Full result: {
  "raw": "```json\n{\n  \"groups\": [\n    {\n      \"topic_signature\": \"ChatGPT Atlas features and reviews\",\n      \"primary_article_index\": 0,\n      \"duplicate_indices\": [1, 3, 5],\n      \"similarity_explanation\": \"These articles discuss ChatGPT Atlas, its features, and reviews of its performance.\"\n    },\n    {\n      \"topic_signature\": \"Google Gemini AI integration\",\n      \"primary_article_index\": 6,\n      \"duplicate_indices\": [4, 7],\n      \"similarity_explanation\": \"These articles cover the integration and potential applications of Google Gemini AI in various platforms.\"\n    },\n    {\n      \"topic_signature\": \"OpenAI's business and partnerships\",\n      \"primary_article_index\": 2,\n      \"duplicate_indices\": [9, 11],\n      \"similarity_explanation\": \"These articles discuss OpenAI's business ventures, partnerships, and financial aspects.\"\n    }\n  ],\n  \"unique_articles\": [8, 10]\n}\n```"
}
2025-10-23T19:36:52.487Z [info] [Step 2/4] Complete: 18 posts scored
2025-10-23T19:36:52.487Z [info] [Step 3/4] Generate for campaign 3e139a40-b646-4466-8ce0-c8c6a17d2390
2025-10-23T19:36:52.488Z [info] Starting primary newsletter article generation...
2025-10-23T19:36:56.785Z [info] [AI] Using plain text database prompt for primaryArticleTitle (length: 2704 chars)
2025-10-23T19:36:10.685Z [info] Criterion 1: 6/10; Criterion 2: 1/10; Criterion 3: 3/10; Total: 13.5 (max: 40)
2025-10-23T19:36:17.747Z [info] Criterion 1: 6/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 11.5 (max: 40)
2025-10-23T19:36:24.036Z [info] Criterion 1: 8/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 14.5 (max: 40)
2025-10-23T19:36:29.153Z [info] Criterion 1: 8/10; Criterion 2: 0/10; Criterion 3: 1/10; Total: 13 (max: 40)
2025-10-23T19:36:36.501Z [info] Criterion 1: 7/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 13 (max: 40)
2025-10-23T19:36:42.126Z [info] Criterion 1: 7/10; Criterion 2: 1/10; Criterion 3: 1/10; Total: 13 (max: 40)
2025-10-23T19:37:28.786Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:37:28.786Z [info] [AI] Using plain text prompt for factChecker
2025-10-23T19:37:32.373Z [info] [AI] Using database prompt for factChecker
2025-10-23T19:37:32.373Z [info] [AI] Using plain text prompt for factChecker