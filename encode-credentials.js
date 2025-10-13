// Helper script to encode Google Cloud credentials as base64
// Run with: node encode-credentials.js

const fs = require('fs');
const path = require('path');

// You can either:
// 1. Put your credentials JSON file in the same directory and update the filename
// 2. Or copy-paste the JSON content directly in the credentialsJson variable

const credentialsFile = 'service-account-key.json'; // Update this filename

let credentialsJson = '';

// Try to read from file first
if (fs.existsSync(credentialsFile)) {
  credentialsJson = fs.readFileSync(credentialsFile, 'utf8');
  console.log(`Reading credentials from ${credentialsFile}`);
} else {
  // If no file, you can paste your JSON here:
  credentialsJson = `{
    "type": "service_account",
    "project_id": "your-project-id",
    "private_key_id": "your-key-id",
    "private_key": "-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY_HERE\\n-----END PRIVATE KEY-----\\n",
    "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
    "client_id": "your-client-id",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com"
  }`;
}

try {
  // Validate JSON
  JSON.parse(credentialsJson);

  // Encode as base64
  const base64Encoded = Buffer.from(credentialsJson).toString('base64');

  console.log('\n=== BASE64 ENCODED CREDENTIALS ===');
  console.log(base64Encoded);
  console.log('\n=== INSTRUCTIONS ===');
  console.log('1. Copy the base64 string above');
  console.log('2. In Vercel dashboard, update GOOGLE_CLOUD_CREDENTIALS_JSON with this value');
  console.log('3. The parsing logic will automatically detect and decode base64 format');

} catch (error) {
  console.error('Error processing credentials:', error.message);
  console.log('\nPlease ensure you have valid JSON credentials.');
}