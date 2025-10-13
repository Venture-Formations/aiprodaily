const data = require('fs').readFileSync(0, 'utf-8');
const json = JSON.parse(data);
console.log('Total articles:', json.articles.length);
console.log('\nArticles:');
json.articles.forEach((a, i) => {
  console.log(`${i+1}. ${a.headline}`);
});
