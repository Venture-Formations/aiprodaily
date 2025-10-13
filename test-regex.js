const testString = '```json\n{\n  "groups": [\n    {\n      "topic_signature": "Fire Department Open Houses during Fire Prevention Week",\n      "primary_article_index": 3,\n      "duplicate_indices": [1, 2],\n      "similarity_explanation": "All articles discuss fire department open houses occurring on October 12 during Fire Prevention Week. They are similar events happening in different locations."\n    }\n  ],\n  "unique_articles": [0]\n}\n```';

const codeFenceMatch = testString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);

console.log('Match found?', !!codeFenceMatch);
if (codeFenceMatch) {
  console.log('Extracted content:');
  console.log(codeFenceMatch[1]);

  try {
    const parsed = JSON.parse(codeFenceMatch[1]);
    console.log('\nParsed successfully!');
    console.log('Groups:', parsed.groups?.length);
  } catch (e) {
    console.error('\nFailed to parse:', e.message);
  }
}
