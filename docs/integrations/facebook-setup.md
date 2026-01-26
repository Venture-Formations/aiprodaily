# Facebook Page Posting Setup Guide

This guide walks you through setting up automated Facebook Page posting for your newsletter's ad content.

## Overview

The Facebook posting feature allows you to automatically share ad module content to your Facebook Business Page on a daily schedule. Each day, the system posts the same ad content that appears in your newsletter.

## Prerequisites

- A Facebook Business Page that you manage
- A Meta (Facebook) Developer account
- Admin access to your Facebook Page

## Step 1: Create a Meta Developer Account

1. Go to [developers.facebook.com](https://developers.facebook.com/)
2. Click "Get Started" or "Log In"
3. If you don't have a developer account, you'll need to create one
4. Accept the Meta Platform Terms and Developer Policies

## Step 2: Create a Facebook App

1. Go to [Meta for Developers Apps Dashboard](https://developers.facebook.com/apps/)
2. Click "Create App"
3. Select "Business" as the app type
4. Fill in the details:
   - **App Name**: e.g., "My Newsletter Poster"
   - **App Contact Email**: Your email
   - **Business Account**: Select your business account (or create one)
5. Click "Create App"

## Step 3: Configure App Permissions

1. In your app dashboard, go to "App Settings" > "Basic"
2. Make note of your **App ID** and **App Secret**
3. Go to "Add Products" and add "Facebook Login"
4. In the Facebook Login settings, add these permissions:
   - `pages_show_list` - To list pages you manage
   - `pages_read_engagement` - To read page information
   - `pages_manage_posts` - To create posts on your page

## Step 4: Generate a Page Access Token

### Option A: Using Graph API Explorer (Recommended)

1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app from the dropdown
3. Click "Generate Access Token"
4. Grant the required permissions when prompted
5. This gives you a **User Access Token**

### Option B: Converting to Page Access Token

1. In Graph API Explorer, with your User Access Token, run:
   ```
   GET /me/accounts
   ```
2. This returns a list of Pages you manage with their access tokens
3. Find your Page and copy its `access_token`

### Option C: Extending Token Lifetime

User tokens expire quickly. To get a long-lived token:

1. Make this request (replace values):
   ```
   GET /oauth/access_token?
     grant_type=fb_exchange_token&
     client_id={app-id}&
     client_secret={app-secret}&
     fb_exchange_token={short-lived-token}
   ```

2. The response contains a long-lived token (valid ~60 days)

3. Use this long-lived user token to get a Page token:
   ```
   GET /me/accounts
   ```

   Page tokens derived from long-lived user tokens are also long-lived.

## Step 5: Find Your Page ID

1. Go to your Facebook Page
2. Click "About" in the left sidebar
3. Scroll down to find "Page ID" (a numeric ID)
4. Copy this ID

Alternatively, your Page ID is returned in the `/me/accounts` response from Step 4.

## Step 6: Configure in AIProDaily

1. Go to your Dashboard > Settings > Facebook tab
2. Enable "Enable Facebook Posting"
3. Enter your **Page ID**
4. Enter your **Page Access Token**
5. Click "Verify" to confirm the token works
6. Select your posting time (Central Time)
7. Select which **Ad Module** to post content from
8. Click "Save Settings"

## Step 7: Test Your Setup

1. Click "Send Test Post" to post a test message
2. Check your Facebook Page to verify it appeared
3. Click "Test Ad Post" to post actual ad content
4. Verify the ad content appears correctly

## How It Works

- The cron job runs every 5 minutes
- At your configured time (Central Time), it:
  1. Gets the ad content from your selected module
  2. Strips HTML formatting for plain text
  3. Posts to your Facebook Page with image and link (if available)
  4. Records the post date to prevent duplicate posts

## Post Format

Posts are formatted as:

```
[Ad body text - plain text version]

Learn more: [CTA button URL]
```

If the ad has an image, it's attached to the post.

## Token Maintenance

### Token Expiration

- Long-lived Page tokens typically last ~60 days
- The system shows token expiration in the settings
- Plan to refresh your token before it expires

### Refreshing Tokens

1. Repeat Steps 4 to generate a new token
2. Update the token in Settings > Facebook
3. Verify the new token works

## Troubleshooting

### "Token is invalid or expired"

- Generate a new Page Access Token following Step 4
- Make sure you're using a Page token, not a User token

### "Page not found"

- Verify your Page ID is correct
- Ensure your token has access to the Page

### "Missing permissions"

- Your app needs `pages_manage_posts` permission
- Re-generate the token with proper permissions

### Posts not appearing

1. Check Settings > Facebook for "Last Post" status
2. Verify the cron is running (check Vercel logs)
3. Ensure "Enable Facebook Posting" is turned on
4. Verify time matches your configured post time (Central Time)

### "No ad content found"

- Ensure you have active ads in the selected ad module
- Check that ads have "active" status

## Security Notes

- Keep your App Secret confidential
- Page Access Tokens should be stored securely
- Never commit tokens to version control
- Rotate tokens periodically for security

## Rate Limits

Facebook has posting limits:
- ~200 posts per hour per Page
- This feature posts once daily, well within limits

## Support

For issues with this integration:
1. Check the Vercel logs for `[Facebook]` entries
2. Review token validity in Settings > Facebook
3. Test with "Send Test Post" button
