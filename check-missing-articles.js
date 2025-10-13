const data = require('fs').readFileSync(0, 'utf-8');
const json = JSON.parse(data);
console.log('Rated posts WITHOUT articles:');
json.posts_sample.forEach(p => {
  if (p.rating && !p.has_article) {
    console.log('- Score:', p.rating.total_score, '(I:' + p.rating.interest_level + ' L:' + p.rating.local_relevance + ' C:' + p.rating.community_impact + ') -', p.title.substring(0, 60));
  }
});
console.log('\nRated posts WITH articles:');
json.posts_sample.forEach(p => {
  if (p.rating && p.has_article) {
    console.log('- Score:', p.rating.total_score, '(I:' + p.rating.interest_level + ' L:' + p.rating.local_relevance + ' C:' + p.rating.community_impact + ') -', p.title.substring(0, 60));
  }
});
