## Tech stack

Define your technical stack below. This serves as a reference for all team members and helps maintain consistency across the project.

### Framework & Runtime
- **Application Framework:** Next.js 15.1.3 (App Router)
- **Language/Runtime:** TypeScript 5.x on Node.js
- **Package Manager:** npm

### Frontend
- **JavaScript Framework:** React 18
- **CSS Framework:** Tailwind CSS 3.3.0 with @tailwindcss/forms
- **UI Components:** Custom components with @dnd-kit for drag-and-drop, react-image-crop for image editing
- **Utility Libraries:** clsx, tailwind-merge for className management

### Database & Storage
- **Database:** Supabase (PostgreSQL)
- **ORM/Query Builder:** Supabase client (@supabase/supabase-js 2.39.7)
- **Caching:** None currently implemented
- **File Storage:** GitHub for image hosting (via @octokit/rest)

### Testing & Quality
- **Test Framework:** None currently implemented (potential gap)
- **Linting/Formatting:** ESLint (eslint-config-next)
- **Type Checking:** TypeScript strict mode

### Deployment & Infrastructure
- **Hosting:** Vercel
- **CI/CD:** Vercel automatic deployments from Git
- **Cron Jobs:** Vercel Cron for automated newsletter generation, RSS processing, event syncing

### Third-Party Services
- **Authentication:** NextAuth 4.24.6
- **Email:** MailerLite API for newsletter delivery
- **AI/ML:** OpenAI API 4.28.0 for content generation (subject lines, summaries, road work)
- **Image Processing:** Google Cloud Vision API 5.3.3 for image analysis
- **RSS Parsing:** rss-parser 3.13.0
- **Web Scraping:** Cheerio 1.1.2, Axios 1.6.7
- **Notifications:** Slack Webhooks for team notifications
- **Monitoring:** Console logging (no dedicated monitoring service)

### Key Dependencies
- **Validation:** Zod 3.22.4 for schema validation
- **Utilities:** uuid 9.0.1, googleapis 160.0.0 for Google Calendar integration
