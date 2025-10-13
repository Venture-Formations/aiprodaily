# Google Cloud Vision API Setup Guide

## Overview
Google Cloud Vision API provides superior reverse image search capabilities compared to other services. This guide walks you through the complete setup process.

## 1. Google Cloud Console Setup

### Create Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: **"STC-Scoop-Vision"**
3. Note your Project ID (will be something like `stc-scoop-vision-123456`)

### Enable APIs
Navigate to **APIs & Services → Library** and enable:
- ✅ **Cloud Vision API**
- ✅ **Custom Search API** (optional, for enhanced results)

### Set up Billing
- Go to **Billing** → Link a billing account
- **Free Tier**: 1,000 Vision API requests/month
- **Pricing**: $1.50 per 1,000 requests after free tier

## 2. Service Account Setup

### Create Service Account
1. Go to **IAM & Admin → Service Accounts**
2. Click **Create Service Account**
3. Fill in details:
   - **Name**: `stc-scoop-vision`
   - **Description**: `Vision API for reverse image lookup`

### Assign Roles
Grant these roles to your service account:
- ✅ **Cloud Vision API Service Agent**
- ✅ **Storage Object Viewer** (if using Cloud Storage)

### Generate Key
1. Click on your service account
2. Go to **Keys** tab
3. Click **Add Key → Create New Key**
4. Choose **JSON** format
5. Download the file (keep it secure!)

## 3. Environment Configuration

### Option A: JSON Credentials (Recommended for Vercel)
Add to your `.env.local` file:
```env
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_CREDENTIALS_JSON={"type":"service_account","project_id":"your-project-id",...}
```

### Option B: File Path (Local Development)
```env
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### For Vercel Deployment
1. Go to your Vercel project settings
2. Add Environment Variables:
   - `GOOGLE_CLOUD_PROJECT_ID` = your project ID
   - `GOOGLE_CLOUD_CREDENTIALS_JSON` = paste the entire JSON content

## 4. Testing the Setup

### Test Endpoint
Use the debug endpoint to verify everything works:

```bash
# Test with a sample image URL
GET /api/debug/test-google-vision?image_url=https://example.com/image.jpg

# Test with an image from your database
POST /api/debug/test-google-vision
{
  "image_id": "your-image-id"
}
```

### Expected Response
```json
{
  "success": true,
  "config": {
    "projectId": "stc-scoop-vision-123456",
    "hasCredentials": true,
    "isConfigured": true
  },
  "duration_ms": 2341,
  "results_count": 8,
  "results": [
    {
      "source_url": "https://www.shutterstock.com/image-photo/...",
      "source_name": "Shutterstock",
      "title": "Business meeting photo",
      "creator": "John Photographer",
      "license_info": "Licensed Stock Photo",
      "similarity_score": 0.92,
      "thumbnail_url": "https://..."
    }
  ]
}
```

## 5. Troubleshooting

### Common Issues

**"Google Cloud Vision not configured"**
- Check environment variables are set correctly
- Verify project ID matches your Google Cloud project
- Ensure JSON credentials are valid

**"Authentication failed"**
- Verify service account has correct permissions
- Check that Vision API is enabled in your project
- Ensure billing is set up

**"Quota exceeded"**
- You've used your free 1,000 requests/month
- Check billing settings to enable paid usage

### Debug Commands
```bash
# Check configuration
curl https://your-domain.com/api/debug/test-google-vision

# Test specific image
curl -X POST https://your-domain.com/api/debug/test-google-vision \
  -H "Content-Type: application/json" \
  -d '{"image_id":"your-image-id"}'
```

## 6. Production Deployment

### Vercel Environment Variables
Set these in your Vercel dashboard:
```
GOOGLE_CLOUD_PROJECT_ID=stc-scoop-vision-123456
GOOGLE_CLOUD_CREDENTIALS_JSON={"type":"service_account",...}
```

### Security Notes
- ✅ Never commit service account keys to Git
- ✅ Use environment variables for all credentials
- ✅ Rotate keys periodically
- ✅ Monitor API usage and costs

## 7. Cost Management

### Free Tier Limits
- **1,000 requests/month** free
- **$1.50 per 1,000 requests** after free tier

### Usage Monitoring
- Monitor usage in Google Cloud Console
- Set up billing alerts
- Consider caching results to reduce API calls

## 8. Advanced Features

### Custom Search Engine (Optional)
For enhanced web search results:
1. Create Custom Search Engine at [programmablesearchengine.google.com](https://programmablesearchengine.google.com/)
2. Add environment variables:
   ```env
   GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your-cse-id
   GOOGLE_API_KEY=your-api-key
   ```

## Support
- **Google Cloud Vision Docs**: [cloud.google.com/vision/docs](https://cloud.google.com/vision/docs)
- **API Reference**: [cloud.google.com/vision/docs/reference](https://cloud.google.com/vision/docs/reference)
- **Pricing**: [cloud.google.com/vision/pricing](https://cloud.google.com/vision/pricing)