# St. Cloud Scoop Newsletter System
## Product Requirements Document (PRD)

**Version**: 1.0  
**Date**: January 2025  
**Product**: Automated Newsletter Generation and Management System

---

## 1. Executive Summary

The St. Cloud Scoop Newsletter System is a cloud-based automation platform that processes RSS feeds through AI to generate, curate, and distribute daily local newsletters. The system provides intelligent content selection, collaborative review workflows, and comprehensive analytics.

---

## 2. Product Goals

### Primary Objectives
- **Automate daily newsletter creation** from RSS sources with 95% reliability
- **Provide collaborative review interface** for team-based content curation
- **Maintain high content quality** through AI fact-checking and human oversight
- **Scale content sources** with multi-RSS support and manual content addition
- **Monitor performance** with integrated analytics and error handling

### Success Metrics
- Daily newsletter delivery rate: >95%
- Review process completion time: <30 minutes
- Content quality score: >20/30 (fact-check threshold)
- Team adoption rate: 100% of reviewers using dashboard
- System uptime: >99.5%

---

## 3. User Personas

### Primary Users: Newsletter Review Team
**Profile**: Editorial team members responsible for content curation
**Access Level**: Full dashboard access with Google authentication
**Primary Tasks**: 
- Review AI-selected articles
- Remove/approve content for publication
- Add manual articles when needed
- Monitor newsletter performance

**Technical Comfort**: Medium to high
**Time Constraints**: 15-30 minutes daily review window (9:00-10:00 PM CT)

---

## 4. Functional Requirements

### 4.1 Content Acquisition System

#### RSS Feed Management
- **Multiple RSS Feed Support**: Add/remove/configure multiple RSS sources
- **Polling Schedule**: Every 24 hours at 8:30 PM CT
- **Content Filtering**: Process posts from previous 24-hour window
- **Metadata Extraction**: Title, description, image, author, publication date, source URL

#### Manual Content Addition
- **Article Submission Interface**: Form-based article creation
- **Image Upload**: Support for article images with automatic optimization
- **Content Validation**: Ensure required fields and content quality
- **Editorial Workflow**: Manual articles bypass AI scoring, require human approval

#### Content Processing Pipeline
- **AI Content Evaluation**: Interest level, local relevance, community impact (1-10 scale each)
- **Duplicate Detection**: Identify and handle multiple posts about same story
- **Article Generation**: AI-powered rewriting to newsletter format (40-75 words)
- **Fact Checking**: Automated verification against source content (threshold: ≥20/30)
- **Subject Line Generation**: AI-created headlines for email campaigns

### 4.2 Review and Approval System

#### Dashboard Interface
- **Campaign Overview**: List of all campaigns with status indicators
- **Article Management**: Grid view of proposed articles with scoring
- **Selection Interface**: Toggle articles in/out of newsletter
- **Preview Generation**: Real-time newsletter preview with changes
- **Article Details**: Expandable view with source content, AI reasoning, fact-check scores

#### Collaborative Features
- **Google Authentication**: Team access with single sign-on
- **Permission Management**: Uniform access levels for all team members
- **Activity Tracking**: Log of who made what changes when
- **Approval Workflow**: Automatic send unless explicitly blocked

#### Review Process
- **Timeline**: 9:00 PM CT delivery to review team
- **Review Window**: Until 4:00 AM CT (automatic send time)
- **Default Behavior**: Proceed with AI selections unless modified
- **Manual Overrides**: Add/remove articles, reorder content
- **Backup Content**: Automatic promotion of ranked backup articles

### 4.3 Email Campaign Management

#### MailerLite Integration
- **Review Campaign**: 9:00 PM CT to internal review group
- **Final Campaign**: 4:55 AM CT to subscriber list
- **Template Management**: Consistent HTML formatting matching current design
- **Scheduling**: Automated campaign creation and scheduling
- **Group Management**: Separate review and subscriber groups

#### Content Formatting
- **HTML Generation**: Convert articles to newsletter template
- **Image Optimization**: Responsive images with proper alt text
- **Link Management**: Source attribution and read-more links
- **Brand Consistency**: Logo, colors, footer matching current design

### 4.4 Analytics and Monitoring

#### Performance Tracking
- **MailerLite Integration**: Import open rates, click rates, subscriber metrics
- **Dashboard Display**: Visual charts and key metrics
- **Historical Trends**: Track performance over time
- **Content Analysis**: Best-performing article types and topics

#### System Monitoring
- **Health Checks**: Monitor all system components
- **Error Detection**: RSS failures, API timeouts, processing errors
- **Notification System**: Slack integration for failure alerts
- **Recovery Procedures**: Automatic retries and fallback behaviors

---

## 5. Technical Requirements

### 5.1 Architecture Overview

#### Cloud-First Design
- **Platform**: Vercel for hosting and serverless functions
- **Database**: Supabase (PostgreSQL) for data persistence
- **Authentication**: NextAuth.js with Google OAuth
- **Frontend**: Next.js with React and Tailwind CSS
- **API Layer**: Next.js API routes for backend functionality

#### External Integrations
- **OpenAI**: GPT-4 for content processing and generation
- **MailerLite**: Email campaign management and delivery
- **Slack**: Error notifications and team alerts
- **RSS Sources**: Multiple configurable feed endpoints

### 5.2 Data Architecture

#### Database Schema
```sql
-- Core Tables
newsletter_campaigns (id, date, status, subject_line, metrics)
rss_feeds (id, url, name, active, last_processed)
rss_posts (id, feed_id, campaign_id, external_id, title, description, ...)
post_ratings (id, post_id, interest_level, local_relevance, community_impact, ...)
articles (id, post_id, campaign_id, headline, content, rank, is_active, ...)
manual_articles (id, campaign_id, title, content, image_url, created_by, ...)
users (id, email, name, role, last_login)
system_logs (id, level, message, context, timestamp)
```

#### Data Flow
1. **RSS Ingestion** → Raw posts stored with metadata
2. **AI Processing** → Ratings and generated articles stored
3. **Review Interface** → User selections tracked
4. **Campaign Creation** → Final content compiled for email
5. **Analytics** → Performance data imported and displayed

### 5.3 API Design

#### Internal APIs
- `POST /api/rss/process` - Trigger RSS feed processing
- `GET /api/campaigns` - List campaigns with filtering
- `PATCH /api/campaigns/[id]/articles` - Update article selections
- `POST /api/articles/manual` - Create manual article
- `GET /api/analytics/[campaign]` - Fetch performance metrics
- `POST /api/notifications/slack` - Send team alerts

#### External API Interactions
- **OpenAI API**: Batch processing with rate limit handling
- **MailerLite API**: Campaign CRUD operations
- **Slack Webhooks**: Error and status notifications

### 5.4 Security Requirements

#### Authentication & Authorization
- **Google OAuth**: Required for all dashboard access
- **Session Management**: Secure token handling
- **API Protection**: Authenticated endpoints only
- **Environment Variables**: Secure storage of API keys

#### Data Protection
- **Database Security**: Row-level security policies
- **API Rate Limiting**: Prevent abuse and manage costs
- **Input Validation**: Sanitize all user inputs
- **Error Handling**: No sensitive data in error messages

---

## 6. User Experience Requirements

### 6.1 Dashboard Interface

#### Layout and Navigation
- **Responsive Design**: Mobile and desktop optimized
- **Intuitive Navigation**: Clear menu structure and breadcrumbs
- **Loading States**: Progress indicators for long operations
- **Error States**: User-friendly error messages with actions

#### Core User Flows
1. **Daily Review**: Login → Select campaign → Review articles → Make changes → Confirm
2. **Manual Addition**: Navigate to add article → Fill form → Upload image → Submit
3. **Analytics Review**: View dashboard → Select date range → Analyze metrics
4. **System Monitoring**: Check status → View error logs → Take corrective action

### 6.2 Performance Requirements

#### Response Times
- **Page Load**: <2 seconds for dashboard pages
- **API Responses**: <5 seconds for data operations
- **Background Processing**: Status updates every 30 seconds
- **Real-time Updates**: WebSocket for collaborative editing

#### Availability
- **Uptime Target**: 99.5% monthly availability
- **Scheduled Maintenance**: Weekly 30-minute windows
- **Disaster Recovery**: 4-hour RTO, 1-hour RPO

---

## 7. Error Handling and Recovery

### 7.1 Failure Scenarios

#### RSS Feed Failures
- **Detection**: HTTP errors, malformed content, timeout
- **Response**: Retry every 30 minutes up to 4 attempts
- **Fallback**: Skip failed feeds, proceed with available content
- **Notification**: Slack alert after 2 hours of failures

#### AI Processing Failures
- **Rate Limits**: Automatic batch size reduction and retry
- **API Errors**: Exponential backoff retry strategy
- **Quality Issues**: Fall back to manual article selection
- **Cost Management**: Daily spending limits and alerts

#### Email Delivery Failures
- **MailerLite Issues**: Retry campaign creation/scheduling
- **Content Problems**: Validation before campaign creation
- **Subscriber Issues**: Handle bounces and unsubscribes
- **Backup Delivery**: Manual send capability

### 7.2 Monitoring and Alerts

#### System Health Monitoring
- **Automated Checks**: Every 15 minutes during active hours
- **Key Metrics**: Response times, error rates, resource usage
- **Alert Thresholds**: >5% error rate, >10 second response times
- **Escalation**: Slack immediate, email after 30 minutes

#### Content Quality Monitoring
- **AI Score Tracking**: Monitor for score degradation
- **User Feedback**: Track manual overrides and patterns
- **Content Metrics**: Word counts, image availability, source diversity
- **Quality Alerts**: <3 articles meeting threshold

---

## 8. Deployment and Operations

### 8.1 Environment Strategy

#### Development Environment
- **Local Development**: Full stack on developer machines
- **Preview Deployments**: Automatic for pull requests
- **Staging Environment**: Production-like for testing
- **Production**: Live system with full automation

#### Configuration Management
- **Environment Variables**: Different configs per environment
- **Feature Flags**: Toggle new features safely
- **Database Migrations**: Automated schema updates
- **Rollback Procedures**: Quick revert capabilities

### 8.2 Deployment Process

#### Automated Deployment Pipeline
1. **Code Commit** → Automated testing
2. **Pull Request** → Preview deployment
3. **Merge to Main** → Staging deployment
4. **Manual Approval** → Production deployment
5. **Health Checks** → Rollback if issues

#### Production Considerations
- **Zero Downtime**: Rolling deployments
- **Database Changes**: Backward compatible migrations
- **Cron Job Management**: Ensure scheduled tasks continue
- **External Dependencies**: Verify API integrations

---

## 9. Implementation Details

### 9.1 Environment Configuration
The system requires configuration of various API keys and credentials. Copy `.env.example` to `.env.local` and configure with your actual values:

```
# Database
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# AI
OPENAI_API_KEY=your-openai-api-key

# Email
MAILERLITE_API_KEY=your-mailerlite-api-key
MAILERLITE_REVIEW_GROUP_ID=your-review-group-id
MAILERLITE_MAIN_GROUP_ID=your-main-subscriber-group-id

# RSS
RSS_FEED_URL=your-rss-feed-url

# Cron Security
CRON_SECRET=your-secure-random-string
```

**Note**: All credentials have been provided separately for security. See deployment guide for complete setup instructions.

### 9.2 AI Prompts (Existing)
The system uses four specific AI prompts for content processing:
1. **Content Evaluator**: Rates posts on interest, relevance, impact (1-10 scale each)
2. **Topic Deduper**: Identifies duplicate stories, selects longest version
3. **Newsletter Writer**: Converts posts to 40-75 word newsletter articles
4. **Fact Checker**: Validates articles against source content (≥20/30 threshold)
5. **Subject Line Generator**: Creates compelling email subject lines (≤39 characters)

### 9.3 Email Template
Uses existing St. Cloud Scoop template with:
- Brand colors (#1877F2)
- Logo integration
- Responsive design
- Social media links
- Unsubscribe handling

---

## 10. Build Instructions for Claude Code

Please build a complete Next.js application that implements all the requirements above. The system should be production-ready with:

1. **Complete database schema** with all tables and relationships
2. **Authentication system** using NextAuth.js with Google OAuth
3. **RSS processing pipeline** with AI content evaluation
4. **Admin dashboard** with article management and analytics
5. **Email campaign integration** with MailerLite
6. **Error handling and monitoring** with Slack notifications
7. **Automated cron jobs** for daily processing
8. **Responsive UI** with Tailwind CSS
9. **Deployment configuration** for Vercel

Use the existing credentials provided and implement all features as specified in the PRD. Focus on creating a robust, scalable system that handles all edge cases and provides excellent user experience.