const data = require('fs').readFileSync(0, 'utf-8');
const json = JSON.parse(data);
console.log('Total posts:', json.total_posts);
console.log('Posts with ratings:', json.posts_with_ratings);
console.log('Total articles:', json.total_articles);
console.log('Active articles:', json.active_articles);
console.log('\nTop rated posts:');
json.posts_sample.forEach((p, i) => {
  const r = p.rating;
  console.log(`${i+1}. Score: ${r.total_score} (I:${r.interest_level} L:${r.local_relevance} C:${r.community_impact}) - ${p.title.substring(0,60)}`);
});
