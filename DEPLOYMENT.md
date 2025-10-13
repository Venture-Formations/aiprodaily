# St. Cloud Scoop - Deployment Guide

This guide covers the complete deployment process for the St. Cloud Scoop newsletter system.

## Prerequisites

Before deploying, ensure you have:

1. **Supabase Project** - Database and authentication
2. **OpenAI API Key** - For AI content processing
3. **MailerLite Account** - For email campaign management
4. **Google OAuth Credentials** - For user authentication
5. **Slack Webhook URL** - For error notifications (optional)
6. **Vercel Account** - For hosting and cron jobs

## Step 1: Database Setup

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and API keys
3. Go to the SQL Editor in your Supabase dashboard
4. Copy and paste the entire contents of `database.sql`
5. Execute the SQL to create all tables and functions

### 1.2 Configure Authentication

1. In Supabase dashboard, go to Authentication > Settings
2. Disable email confirmation if desired
3. Configure any additional authentication settings

## Step 2: External Service Setup

### 2.1 OpenAI API

1. Create an account at [platform.openai.com](https://platform.openai.com)
2. Generate an API key
3. Ensure you have GPT-4 access

### 2.2 MailerLite Setup

1. Create account at [mailerlite.com](https://mailerlite.com)
2. Go to Integrations > Developer API
3. Generate an API key
4. Create two subscriber groups:
   - "Newsletter Review Team" (for internal review)
   - "Main Subscribers" (for newsletter recipients)
5. Note the group IDs from the URL when viewing each group

### 2.3 Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID
5. Set application type to "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://your-domain.vercel.app/api/auth/callback/google` (production)
7. Note your Client ID and Client Secret

### 2.4 Slack Notifications (Optional)

1. Create a Slack app at [api.slack.com](https://api.slack.com)
2. Add incoming webhooks feature
3. Create a webhook for your desired channel
4. Note the webhook URL

## Step 3: Vercel Deployment

### 3.1 Connect Repository

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com](https://vercel.com) and create account
3. Import your repository
4. Vercel will automatically detect it's a Next.js project

### 3.2 Environment Variables

In Vercel dashboard, go to your project > Settings > Environment Variables.

Add the following variables:

```
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI
OPENAI_API_KEY=sk-your-openai-key

# Email
MAILERLITE_API_KEY=your-mailerlite-key
MAILERLITE_REVIEW_GROUP_ID=your-review-group-id
MAILERLITE_MAIN_GROUP_ID=your-main-group-id

# RSS
RSS_FEED_URL=https://rss.app/feeds/_flJgCqGgmZncd9Sk.xml

# Cron Security
CRON_SECRET=your-random-32-char-string

# NextAuth
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your-random-32-char-string

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Slack (Optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
```

### 3.3 Deploy

1. Click "Deploy" in Vercel
2. Wait for build to complete
3. Visit your deployment URL to verify it works

## Step 4: Verify Cron Jobs

### 4.1 Check Cron Configuration

Cron jobs are defined in `vercel.json`:

- **RSS Processing**: Daily at 8:30 PM CT
- **Final Newsletter**: Daily at 4:55 AM CT
- **Metrics Import**: Daily at 6:00 AM CT
- **Health Checks**: Every 15 minutes (8 AM - 10 PM CT)

### 4.2 Test Cron Endpoints

You can manually test cron endpoints using curl:

```bash
# Test RSS processing
curl -X POST https://your-domain.vercel.app/api/cron/process-rss \
  -H "Authorization: Bearer your-cron-secret"

# Test health check
curl -X POST https://your-domain.vercel.app/api/cron/health-check \
  -H "Authorization: Bearer your-cron-secret"
```

## Step 5: Initial Configuration

### 5.1 Add Users

1. Visit your deployed application
2. Sign in with Google OAuth
3. The first user will be automatically created in the database
4. Additional team members can sign in with their Google accounts

### 5.2 Configure RSS Feeds

Add RSS feeds directly to the database:

```sql
INSERT INTO rss_feeds (url, name, active) VALUES
('https://your-local-news-feed.xml', 'Local News Source', true),
('https://another-feed.xml', 'Another Source', true);
```

### 5.3 Test the System

1. **Manual RSS Processing**:
   - Call `/api/rss/process` endpoint
   - Check that campaigns and articles are created

2. **Review Workflow**:
   - Check that review emails are sent
   - Test article toggling in dashboard

3. **Analytics**:
   - Verify MailerLite metrics import works
   - Check analytics dashboard displays data

## Step 6: Monitoring Setup

### 6.1 Health Monitoring

- Health checks run automatically every 15 minutes
- Check `/api/health` endpoint for current status
- Monitor Slack notifications for alerts

### 6.2 Error Monitoring

- All errors are logged to `system_logs` table
- Critical errors trigger Slack notifications
- Check Vercel function logs for additional details

## Step 7: Ongoing Maintenance

### 7.1 Database Maintenance

- Monitor `system_logs` for errors
- Periodically clean old log entries
- Backup important data regularly

### 7.2 Performance Monitoring

- Check newsletter open/click rates in analytics
- Monitor RSS feed processing success
- Review AI evaluation quality

### 7.3 Updates

- Keep dependencies updated
- Monitor Vercel function execution times
- Update AI prompts as needed

## Troubleshooting

### Common Issues

**Cron Jobs Not Running**
- Verify `CRON_SECRET` environment variable
- Check Vercel function logs
- Ensure cron schedule is valid

**Authentication Issues**
- Verify Google OAuth redirect URIs
- Check `NEXTAUTH_URL` and `NEXTAUTH_SECRET`
- Ensure Supabase auth is configured

**RSS Processing Fails**
- Check RSS feed URLs are accessible
- Verify OpenAI API key and credits
- Monitor `system_logs` for detailed errors

**Email Delivery Issues**
- Verify MailerLite API key and permissions
- Check group IDs are correct
- Monitor MailerLite dashboard for delivery status

### Support

For technical issues:
1. Check system logs in dashboard
2. Review Vercel function logs
3. Monitor Slack notifications
4. Check external service status pages

## Security Considerations

- Keep all API keys secure and rotate regularly
- Monitor authentication logs for suspicious activity
- Use strong random strings for secrets
- Regularly update dependencies
- Monitor error logs for potential security issues

## Performance Optimization

- Monitor Vercel function execution times
- Optimize AI prompt lengths if needed
- Consider caching for frequently accessed data
- Monitor database performance in Supabase

This completes the deployment setup. The system should now run automatically according to the configured schedule.