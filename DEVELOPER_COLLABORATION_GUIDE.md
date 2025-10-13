# Developer Collaboration Setup Guide

**Last Updated:** October 7, 2025
**Purpose:** Enable multiple developers to work on St. Cloud Scoop project safely

---

## 🎯 Overview

**Current Setup:**
- Repository: GitHub (`VFDavid/st-cloud-scoop`)
- Deployment: Vercel (automatic from `main` branch)
- Database: Supabase

**Goal:** Add another developer who can:
- Create new pages and features
- Test changes before they go live
- Work independently without conflicts

---

## ✅ **Recommended Solution: GitHub Collaboration + Preview Deployments**

### Why This Works Best:

1. **Automatic Testing Environment** - Every branch gets its own preview URL
2. **No Risk to Production** - Changes tested before merging to `main`
3. **Version Control** - Full history of who changed what and when
4. **Code Review** - You can review changes before they go live
5. **Independent Work** - Both developers can work simultaneously

---

## 📋 Part 1: Add Developer to GitHub Repository

### Step 1: Invite Collaborator to GitHub

1. **Go to GitHub Repository:**
   ```
   https://github.com/VFDavid/st-cloud-scoop
   ```

2. **Navigate to Settings:**
   - Click **Settings** tab (top of repo)
   - Click **Collaborators** in left sidebar
   - Click **Add people** button

3. **Invite Developer:**
   - Enter their GitHub username or email
   - Select permission level:
     - **Write** - Can push code, create branches, open PRs (recommended)
     - **Admin** - Full access including settings (if you fully trust them)
   - Click **Add [username] to this repository**

4. **They Accept Invitation:**
   - Developer receives email invitation
   - Must click link to accept
   - Now has access to repository

### Step 2: Verify Access

Developer can test access:
```bash
git clone https://github.com/VFDavid/st-cloud-scoop.git
cd st-cloud-scoop
git status
```

If successful, they're ready to code!

---

## 💻 Part 2: Developer Local Setup

### Prerequisites They Need:

1. **Node.js** (v18 or higher)
   - Download: https://nodejs.org
   - Verify: `node --version`

2. **Git** installed
   - Download: https://git-scm.com
   - Verify: `git --version`

3. **Code Editor** (VS Code recommended)
   - Download: https://code.visualstudio.com

### Step-by-Step Setup:

#### 1. Clone Repository

```bash
# Clone the repo
git clone https://github.com/VFDavid/st-cloud-scoop.git

# Navigate into project
cd st-cloud-scoop
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Create Local Environment File

Create `.env.local` file in project root:

```bash
# Database (can use production or create separate test database)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

# Email (MailerLite)
MAILERLITE_API_KEY=your_mailerlite_key

# Stripe (use TEST keys for local development)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OpenAI
OPENAI_API_KEY=your_openai_key

# Slack (optional for local testing)
SLACK_WEBHOOK_URL=your_slack_webhook

# Cron Secret (not needed locally)
# CRON_SECRET=...

# App URL
NEXT_PUBLIC_URL=http://localhost:3000
```

**Important:**
- Send these secrets securely (not via email!)
- Use a password manager (1Password, LastPass) or encrypted message
- Consider using **test/staging** credentials for local development

#### 4. Run Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

#### 5. Verify Setup

- [ ] Homepage loads
- [ ] Can log in to dashboard
- [ ] Database connection works

---

## 🔄 Part 3: Collaborative Workflow

### **Developer Creates New Feature:**

#### 1. Create Feature Branch

```bash
# Make sure on latest main
git checkout main
git pull origin main

# Create new branch
git checkout -b feature/new-contact-page
```

**Branch Naming Convention:**
- `feature/description` - New features
- `fix/description` - Bug fixes
- `update/description` - Updates to existing features

#### 2. Make Changes

Developer creates/edits files:
```bash
# Example: Create new contact page
src/app/contact/page.tsx

# Edit and save changes
```

#### 3. Test Locally

```bash
npm run dev
# Verify changes work at http://localhost:3000
```

#### 4. Commit Changes

```bash
git add .
git commit -m "Add contact page with form submission"
```

#### 5. Push Branch to GitHub

```bash
git push origin feature/new-contact-page
```

#### 6. Vercel Automatically Creates Preview

**Within 1-2 minutes:**
- Vercel detects new branch
- Builds and deploys preview
- Creates unique URL: `https://st-cloud-scoop-git-feature-new-contact-page-[...].vercel.app`

**Where to Find Preview URL:**
- Vercel Dashboard → Deployments
- GitHub PR comments (if PR created)

#### 7. Test on Preview URL

Developer shares preview link with you:
```
Hey! I added a contact page. Check it out:
https://st-cloud-scoop-git-feature-new-contact-page-xyz.vercel.app/contact
```

#### 8. Create Pull Request (PR)

**On GitHub:**
1. Go to repository
2. Click **Pull requests** tab
3. Click **New pull request**
4. Select `feature/new-contact-page` → `main`
5. Add description of changes
6. Click **Create pull request**

#### 9. You Review Changes

**You can:**
- View code changes on GitHub
- Test the preview URL
- Leave comments on specific lines
- Request changes or approve

#### 10. Merge to Production

**When ready:**
1. Click **Merge pull request**
2. Click **Confirm merge**
3. Vercel automatically deploys to production
4. Live at: https://st-cloud-scoop.vercel.app

---

## 🔐 Part 4: Access Control & Security

### What Developer Can Do:

✅ **Full Access:**
- Create/edit pages and components
- Add new features
- Fix bugs
- Test changes on preview URLs

✅ **Limited Access:**
- Cannot change Vercel settings (unless you add them)
- Cannot see environment variables (unless you share)
- Cannot access Supabase dashboard (unless you add them)
- Cannot deploy to production without your approval (if using PR workflow)

### What You Control:

🔒 **You Maintain:**
- Vercel account and deployment settings
- Environment variables (API keys, secrets)
- Supabase database access
- Final approval on merging to `main`

### Recommended Permissions:

| Resource | Your Access | Developer Access |
|----------|-------------|------------------|
| **GitHub Repo** | Admin | Write |
| **Vercel Project** | Owner | Member (optional) or None |
| **Supabase Database** | Owner | Read-only or None |
| **Environment Variables** | Full Access | Share only what's needed |

---

## 🛠️ Part 5: Optional - Add Developer to Vercel

**If you want them to:**
- See deployment status
- View deployment logs
- Manually trigger redeployments

### Steps:

1. **Go to Vercel Dashboard:**
   ```
   https://vercel.com/dashboard
   ```

2. **Navigate to Team Settings:**
   - Your Project → **Settings** → **Team**
   - Or create a Team if on free plan (requires upgrade)

3. **Invite Member:**
   - Click **Invite Member**
   - Enter their email
   - Select role: **Member** (can view, not change settings)
   - Click **Invite**

**Note:** Vercel free plan only supports 1 member. Team features require Vercel Pro ($20/month).

**Recommendation:** Unless they need deployment logs, just keep them on GitHub. Preview URLs work without Vercel access.

---

## 📊 Part 6: Shared Database Strategy

### Option A: Shared Production Database (Simplest)

**Setup:**
- Both developers use same Supabase database
- Tag test data with `test_` prefix or specific user
- **Risk:** Could accidentally affect real data

**Best For:**
- Small teams
- Careful developers
- Non-critical testing

### Option B: Developer Test Database (Safer)

**Setup:**
1. Create new Supabase project: "st-cloud-scoop-dev"
2. Copy schema from production
3. Use dev database credentials in `.env.local`
4. Production uses real database

**Best For:**
- Safer testing
- Complex database changes
- Multiple developers

**How To:**
```bash
# Developer's .env.local uses test database
SUPABASE_URL=https://xyz-dev.supabase.co
SUPABASE_SERVICE_ROLE_KEY=dev_key

# Production Vercel uses production database
SUPABASE_URL=https://xyz-prod.supabase.co
SUPABASE_SERVICE_ROLE_KEY=prod_key
```

### Option C: Row-Level Security (RLS) (Advanced)

**Setup:**
- Use Supabase RLS policies
- Developer gets limited access user
- Can read but not delete production data

**Best For:**
- Protecting sensitive data
- Multiple external developers
- Enterprise security needs

**Recommendation:** Start with **Option A** (shared database) if you trust the developer. Move to **Option B** if you start seeing conflicts or want safer testing.

---

## 📱 Part 7: Communication & Collaboration

### Best Practices:

#### 1. Daily Standup (Optional)
- Quick 5-10 min sync
- What did you work on?
- What are you working on today?
- Any blockers?

#### 2. Use GitHub Issues
- Track feature requests
- Log bugs
- Assign to developers
- Close when completed

#### 3. Code Review Checklist
- Does it work on preview URL?
- No breaking changes?
- Follows project conventions?
- Is it documented (if complex)?

#### 4. Branch Naming
- Use consistent naming: `feature/`, `fix/`, `update/`
- Keep branch names descriptive
- Delete branches after merging

#### 5. Commit Messages
```bash
# Good
git commit -m "Add contact form with email validation"
git commit -m "Fix broken image links on events page"

# Bad
git commit -m "updates"
git commit -m "fixed stuff"
```

---

## 🚨 Part 8: Preventing Conflicts

### 1. Assign Clear Responsibilities

| Task | Owner |
|------|-------|
| Homepage, Events, Articles | You |
| New pages, Contact, About | Other Developer |
| Database Schema | You (discuss changes first) |
| Environment Variables | You |

### 2. Communicate Before Big Changes

**Before changing:**
- Database schema
- Environment variables
- Shared components (header, footer)
- API routes

**Message:** "Hey, I'm planning to add a new field to the events table. Will this affect what you're working on?"

### 3. Pull Before You Push

**Always:**
```bash
git pull origin main  # Get latest changes
git checkout -b feature/my-feature  # Create branch
# Make changes
git commit -m "Add feature"
git pull origin main  # Pull again before pushing
git push origin feature/my-feature
```

### 4. Use Pull Requests (Not Direct Push)

**Good Workflow:**
```
Feature Branch → Pull Request → Review → Merge to Main
```

**Bad Workflow:**
```
Feature Branch → Push directly to Main ❌
```

---

## 🎓 Part 9: Onboarding Checklist

Send this to new developer:

### Before First Day:
- [ ] GitHub account created
- [ ] Accepted GitHub repository invitation
- [ ] Node.js installed (v18+)
- [ ] Git installed
- [ ] Code editor installed (VS Code)
- [ ] Received `.env.local` secrets (securely)

### First Day:
- [ ] Clone repository
- [ ] Run `npm install`
- [ ] Create `.env.local` file
- [ ] Run `npm run dev` successfully
- [ ] Can access http://localhost:3000
- [ ] Can log in to dashboard

### First Week:
- [ ] Created first feature branch
- [ ] Made a small change (typo fix, styling)
- [ ] Pushed branch to GitHub
- [ ] Saw preview deployment
- [ ] Created pull request
- [ ] Merged first PR

---

## 📞 Quick Reference

### For New Developer:

**Starting Work:**
```bash
git checkout main
git pull origin main
git checkout -b feature/my-feature
# Make changes
npm run dev  # Test locally
git add .
git commit -m "Description"
git push origin feature/my-feature
# Create PR on GitHub
```

**Getting Latest Changes:**
```bash
git checkout main
git pull origin main
```

**Seeing Preview URL:**
- Vercel Dashboard: https://vercel.com/dashboard
- Or GitHub PR comments

### For You (Owner):

**Reviewing Changes:**
- GitHub → Pull Requests → View Files Changed
- Test preview URL before merging
- Merge when satisfied

**Emergency Rollback:**
- Vercel Dashboard → Deployments → Find last working → "Promote to Production"

---

## 🆘 Troubleshooting

### Issue: Developer can't push to GitHub

**Error:** `Permission denied (publickey)`

**Fix:**
1. Check SSH keys: https://docs.github.com/en/authentication
2. Or use HTTPS: `git clone https://github.com/...`
3. Use GitHub Desktop app as easier alternative

### Issue: Preview deployment failing

**Check:**
- TypeScript errors: `npm run build` locally
- Missing environment variables in Vercel
- Check Vercel deployment logs

### Issue: Merge conflicts

**When:** Two people edit same file

**Fix:**
```bash
git pull origin main
# Resolve conflicts in code editor
git add .
git commit -m "Resolve merge conflicts"
git push origin feature/my-branch
```

### Issue: Environment variables not working

**Check:**
- `.env.local` exists in project root
- No spaces around `=` in env file
- Restart dev server after changing env vars

---

## 💰 Cost Considerations

### Current Setup (Free):
- ✅ GitHub (free for public/private repos)
- ✅ Vercel (free tier - 100GB bandwidth, unlimited sites)
- ✅ Supabase (free tier - 500MB database, 2GB bandwidth)

### If You Need More:
- **Vercel Pro:** $20/month (team features, more bandwidth)
- **Supabase Pro:** $25/month (8GB database, better support)
- **GitHub Teams:** $4/user/month (advanced features)

**Recommendation:** Start with free tier. Upgrade only if you need more resources or team features.

---

## ✅ Summary: Quick Start

### For You (5 minutes):
1. GitHub → Settings → Collaborators → Add their username
2. Share `.env.local` secrets securely
3. Done! They can start working

### For Developer (30 minutes):
1. Accept GitHub invitation
2. Clone repo: `git clone https://github.com/VFDavid/st-cloud-scoop.git`
3. Run `npm install`
4. Create `.env.local` with secrets you provided
5. Run `npm run dev`
6. Start coding on feature branches!

### Testing Changes:
1. Developer pushes branch
2. Vercel creates preview URL automatically
3. You test preview URL
4. Approve and merge to `main`
5. Goes live automatically

---

**That's it!** This setup gives you full control while letting another developer work independently. 🚀

**Questions?** Common scenarios covered in this guide. For specific issues, check GitHub docs or Vercel docs.
