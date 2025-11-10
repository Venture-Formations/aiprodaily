const data = require('fs').readFileSync(0, 'utf-8');
const json = JSON.parse(data);
console.log('Posts without ratings:', json.posts_without_ratings);
console.log('\nUnrated posts sample:');
if (json.posts_without_ratings_sample) {
  json.posts_without_ratings_sample.forEach((p, i) => {
    console.log(`${i+1}. ${p.title.substring(0, 80)}`);
  });
}
