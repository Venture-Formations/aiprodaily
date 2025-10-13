# St. Cloud Scoop Newsletter System

A complete automated newsletter generation and management system built with Next.js, Supabase, and AI.

## Features

- **Automated RSS Processing**: Fetches and processes RSS feeds with AI content evaluation
- **Smart Content Curation**: AI-powered rating system for local relevance and community impact
- **Collaborative Review**: Team-based article management and approval workflow
- **Email Campaign Management**: Integrated with MailerLite for professional email delivery
- **Analytics Dashboard**: Performance tracking with open rates, click rates, and engagement metrics
- **Error Monitoring**: Comprehensive error handling with Slack notifications
- **Automated Scheduling**: Daily cron jobs for processing and sending newsletters

## Tech Stack

- **Frontend**: Next.js 15, React, Tailwind CSS
- **Backend**: Next.js API Routes, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: NextAuth.js with Google OAuth
- **AI**: OpenAI GPT-4 for content processing
- **Email**: MailerLite API for campaign management
- **Deployment**: Vercel with automated cron jobs
- **Monitoring**: Slack webhooks for alerts

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- OpenAI API key
- MailerLite account and API key
- Google OAuth credentials
- Slack webhook URL (optional)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd STC_Scoop
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your environment variables in `.env.local` with your actual API keys and credentials.

5. Set up the database schema:
   - Go to your Supabase project
   - Run the SQL commands from `database.sql` in the SQL editor

6. Start the development server:
```bash
npm run dev
```

Visit `http://localhost:3000` to access the application.

## Database Setup

The system requires a PostgreSQL database with the following main tables:

- `newsletter_campaigns` - Campaign management and status
- `rss_feeds` - RSS feed configuration
- `rss_posts` - Raw RSS content
- `post_ratings` - AI evaluation scores
- `articles` - Generated newsletter content
- `manual_articles` - User-created content
- `users` - Authentication and permissions
- `email_metrics` - Performance analytics
- `system_logs` - Error tracking and monitoring

Run the complete schema from `database.sql` in your Supabase SQL editor.

## Configuration

### RSS Feeds

Configure RSS feeds in the `rss_feeds` table or through the admin interface:

```sql
INSERT INTO rss_feeds (url, name, active) VALUES
('https://your-rss-feed.com/feed.xml', 'Local News Source', true);
```

### MailerLite Groups

Set up two subscriber groups in MailerLite:
- Review group (for internal team)
- Main subscriber group (for newsletter recipients)

### Cron Schedule

The system runs on the following schedule (all times in Central Time):

- **8:30 PM**: RSS processing and AI evaluation
- **9:00 PM**: Review campaign sent to team
- **4:55 AM**: Final newsletter sent (if approved)
- **6:00 AM**: Import performance metrics
- **Every 15 minutes (8 AM - 10 PM)**: Health checks

## AI Processing Pipeline

1. **Content Evaluation**: Rates articles on interest level, local relevance, and community impact (1-10 scale each)
2. **Duplicate Detection**: Identifies and groups similar stories
3. **Article Generation**: Converts RSS content to newsletter format (40-75 words)
4. **Fact Checking**: Validates accuracy against source content (minimum 20/30 score)
5. **Subject Line Generation**: Creates engaging email subject lines

## Deployment

### Vercel Deployment

1. Connect your repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Set up the following environment variable mappings:
   - `@supabase-url` → Your Supabase URL
   - `@supabase-anon-key` → Your Supabase anon key
   - `@supabase-service-role-key` → Your Supabase service role key
   - `@openai-api-key` → Your OpenAI API key
   - `@mailerlite-api-key` → Your MailerLite API key
   - And so on...

4. Deploy the application

### Cron Jobs

Cron jobs are automatically configured via `vercel.json`. Ensure your `CRON_SECRET` environment variable is set for security.

## Usage

### Daily Workflow

1. **8:30 PM CT**: System automatically processes RSS feeds
2. **9:00 PM CT**: Review team receives email with proposed articles
3. **9:00 PM - 4:00 AM CT**: Team reviews and modifies article selection in dashboard
4. **4:55 AM CT**: Final newsletter automatically sent to subscribers

### Manual Operations

- **Create Campaign**: Start a new newsletter campaign manually
- **Add Manual Articles**: Include custom content alongside RSS articles
- **Override Selections**: Toggle articles on/off for the newsletter
- **Preview Newsletter**: See how the email will look before sending
- **View Analytics**: Monitor performance metrics and trends

### Team Management

All team members with Google accounts can access the dashboard. User roles are managed in the `users` table:

- **Reviewer**: Can review and modify article selections
- **Admin**: Full system access (future enhancement)

## Monitoring

### Health Checks

The system continuously monitors:
- Database connectivity
- RSS feed processing status
- Recent campaign creation
- Email delivery success rates

### Error Handling

- All errors are logged to the `system_logs` table
- Critical errors trigger Slack notifications
- Failed RSS feeds are automatically retried
- Email delivery failures include fallback procedures

### Analytics

Track newsletter performance with:
- Open rates and click rates
- Subscriber growth and churn
- Article engagement metrics
- Historical performance trends

## API Reference

### Public Endpoints

- `GET /api/health` - System health check
- `POST /api/auth/[...nextauth]` - Authentication

### Protected Endpoints

- `GET /api/campaigns` - List newsletter campaigns
- `GET /api/campaigns/[id]` - Get campaign details
- `PATCH /api/campaigns/[id]/articles` - Update article selections
- `POST /api/articles/manual` - Create manual article
- `GET /api/analytics/[campaign]` - Get campaign metrics

### Cron Endpoints

- `POST /api/cron/process-rss` - Trigger RSS processing
- `POST /api/cron/send-final` - Send final newsletter
- `POST /api/cron/import-metrics` - Import performance metrics
- `POST /api/cron/health-check` - Run health checks

## Security

- All API endpoints require authentication
- Cron endpoints protected with secret tokens
- Row-level security enabled in Supabase
- Input validation and sanitization
- No sensitive data in error messages

## Support

For issues and questions:
1. Check the system logs in the dashboard
2. Review error notifications in Slack
3. Examine the `system_logs` table for detailed error information

## License

This project is proprietary software for St. Cloud Scoop newsletter operations.# Force deployment
