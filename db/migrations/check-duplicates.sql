SELECT 
  dg.id as group_id,
  dg.topic_signature,
  dg.primary_post_id,
  p1.title as primary_title,
  dp.post_id as duplicate_post_id,
  p2.title as duplicate_title
FROM duplicate_groups dg
LEFT JOIN duplicate_posts dp ON dp.group_id = dg.id
LEFT JOIN rss_posts p1 ON p1.id = dg.primary_post_id
LEFT JOIN rss_posts p2 ON p2.id = dp.post_id
WHERE dg.campaign_id = '3c1c8063-806a-483d-a00a-0eab54d721a5'
ORDER BY dg.id;
