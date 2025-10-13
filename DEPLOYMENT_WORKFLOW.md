# Deployment Workflow

## Environment Strategy

### 1. Local Development
- **Branch:** Any feature branch
- **URL:** http://localhost:3000
- **Database:** Local Supabase or staging database
- **Purpose:** Initial development and testing

**Commands:**
```bash
npm run dev
```

### 2. Preview Deployments (Automatic)
- **Trigger:** Push any branch to GitHub
- **URL:** Vercel creates preview URL automatically
- **Database:** Can use production OR staging (configure via env vars)
- **Purpose:** Test features before merging

**Workflow:**
```bash
git checkout -b feature/new-feature
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
# Vercel automatically deploys and comments preview URL on PR
```

### 3. Staging Environment (Optional but Recommended)
- **Branch:** `staging`
- **URL:** https://st-cloud-scoop-staging.vercel.app (configure in Vercel)
- **Database:** Separate Supabase staging project
- **Purpose:** Full testing with real data before production

**Setup:**
1. Create `staging` branch: `git checkout -b staging`
2. In Vercel dashboard: Settings > Git > Production Branch → Change to `staging`
3. Create new Vercel project for production

### 4. Production
- **Branch:** `main`
- **URL:** https://st-cloud-scoop.vercel.app (or custom domain)
- **Database:** Production Supabase
- **Purpose:** Live newsletter system

---

## Recommended Workflow

### For New Features:
```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes and test locally
npm run dev

# 3. Push to get preview deployment
git push origin feature/my-feature

# 4. Test on preview URL (check Vercel dashboard or GitHub PR)

# 5. Merge to staging for full testing (optional)
git checkout staging
git merge feature/my-feature
git push origin staging

# 6. After testing, merge to main for production
git checkout main
git merge feature/my-feature
git push origin main
```

### For Hotfixes:
```bash
# Create hotfix branch from main
git checkout -b hotfix/urgent-fix main

# Make fix and test
npm run dev

# Push directly to main after testing
git checkout main
git merge hotfix/urgent-fix
git push origin main
```

---

## Environment Variables

Create separate `.env` files for each environment:

### `.env.local` (Local Development)
```env
NEXTAUTH_URL=http://localhost:3000
SUPABASE_URL=your_staging_or_local_supabase
SUPABASE_SERVICE_ROLE_KEY=staging_key
```

### Vercel Preview Deployments
- Use same env vars as production OR
- Configure separate "Preview" env vars in Vercel dashboard

### Vercel Production
- Configure in Vercel dashboard under Settings > Environment Variables
- Set to "Production" branch only

---

## Database Strategy

### Option A: Shared Database (Simpler)
- All environments use same Supabase database
- Add `environment` field to identify test data
- **Risk:** Could accidentally affect production data

### Option B: Separate Databases (Safer)
- **Production:** Main Supabase project
- **Staging:** Separate Supabase project with copy of schema
- **Local:** Local Supabase or staging database

**To create staging database:**
1. Create new Supabase project "st-cloud-scoop-staging"
2. Copy schema from production
3. Use staging credentials in staging/preview environments

---

## Current Setup

**Current State:** All commits to `main` immediately go live ⚠️

**Next Steps:**
1. ✅ Enable Vercel preview deployments (already enabled by default)
2. 🔄 Create `staging` branch for pre-production testing
3. 🔄 (Optional) Set up separate staging database
4. 🔄 Configure Vercel environment variables per environment

---

## Testing Checklist Before Going Live

- [ ] Test RSS processing on preview/staging
- [ ] Test email sending (use test email addresses)
- [ ] Test AI prompts and scoring
- [ ] Test campaign workflow (draft → review → send)
- [ ] Test with real RSS feeds
- [ ] Verify Slack notifications work
- [ ] Check scheduled cron jobs work correctly
- [ ] Test image processing and GitHub storage
- [ ] Verify database constraints and validations
- [ ] Test error handling and recovery

---

## Rollback Strategy

If production breaks:

### Quick Rollback:
```bash
# In Vercel dashboard: Deployments → Find last working deployment → "Promote to Production"
```

### Manual Rollback:
```bash
git revert <bad-commit-hash>
git push origin main
```

### Emergency:
- Pause cron jobs in `vercel.json`
- Disable RSS processing via Settings page
- Fix issue on feature branch and test thoroughly before deploying
