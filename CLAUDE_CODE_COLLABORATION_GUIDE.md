# Claude Code Collaboration Guide

**Last Updated:** October 7, 2025
**Purpose:** Enable multiple developers using Claude Code to collaborate on St. Cloud Scoop

---

## 🎯 Overview

**Current Setup:**
- Repository: GitHub (`VFDavid/st-cloud-scoop`)
- Deployment: Vercel (automatic from `main` branch)
- Development Tool: **Claude Code** (both developers)

**Goal:** Add another developer who uses Claude Code to:
- Create new pages and features
- Test changes on preview URLs
- Work independently without conflicts

---

## ✅ **The Workflow (Simple!)**

```
Developer:
  Create branch → Ask Claude to build feature → Push → Vercel creates preview

You:
  Review preview URL → Approve → Merge → Goes live
```

**No local setup needed!** Claude Code handles everything.

---

## 📋 Part 1: Add Developer to GitHub (5 Minutes)

### Step 1: Invite to Repository

1. **Go to GitHub:**
   ```
   https://github.com/VFDavid/st-cloud-scoop
   ```

2. **Add Collaborator:**
   - Click **Settings** tab
   - Click **Collaborators** in left sidebar
   - Click **Add people**
   - Enter their GitHub username or email
   - Select **Write** access
   - Click **Add [username] to this repository**

3. **They Accept:**
   - Developer receives email
   - Clicks link to accept invitation
   - Done!

---

## 💻 Part 2: Developer Setup in Claude Code (2 Minutes)

### All They Need:

1. **GitHub Account** (free)
2. **Claude Code Access** (they already have this)
3. **Access to the Repository** (you just granted this)

### Setup Steps:

#### 1. Clone Repository in Claude Code

In Claude Code terminal:
```bash
git clone https://github.com/VFDavid/st-cloud-scoop.git
cd st-cloud-scoop
```

#### 2. Configure Git (First Time Only)

```bash
git config user.name "Their Name"
git config user.email "their-email@example.com"
```

#### 3. Verify Access

```bash
git status
```

If this works, they're ready! No npm, no Node.js, no local server needed.

---

## 🔄 Part 3: How to Collaborate

### **Developer Creates New Feature:**

#### Step 1: Create Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/contact-page
```

#### Step 2: Ask Claude to Build Feature

In Claude Code chat:
```
"Create a contact page with a form that has:
- Name field
- Email field
- Message textarea
- Submit button
- Form validation
Save to src/app/contact/page.tsx"
```

Claude Code will:
- Create the files
- Write the code
- Commit changes automatically (if configured)

#### Step 3: Push to GitHub

```bash
git add .
git commit -m "Add contact page with form validation"
git push origin feature/contact-page
```

#### Step 4: Vercel Creates Preview Automatically

**Within 60-80 seconds:**
- Vercel detects new branch
- Builds and deploys
- Creates unique preview URL

**Preview URL format:**
```
https://st-cloud-scoop-git-feature-contact-page-[random].vercel.app
```

#### Step 5: Share Preview with You

Developer messages you:
```
"Hey! Added the contact page. Check it out:
https://st-cloud-scoop-git-feature-contact-page-xyz.vercel.app/contact"
```

#### Step 6: You Review

**Test the preview URL:**
- Does it work correctly?
- Does it look good?
- Any changes needed?

**If changes needed:**
```
"Looks good but can you make the button blue instead of green?"
```

**Developer:**
```bash
# Still on feature/contact-page branch
# Ask Claude: "Change the submit button to blue"
git add .
git commit -m "Change submit button color to blue"
git push origin feature/contact-page
# New preview automatically created with updates
```

#### Step 7: Create Pull Request

**On GitHub:**
1. Go to repository
2. Click **Pull requests**
3. Click **New pull request**
4. Select `feature/contact-page` → `main`
5. Add description
6. Click **Create pull request**

#### Step 8: You Merge to Production

**When satisfied:**
1. Review PR on GitHub
2. Click **Merge pull request**
3. Click **Confirm merge**
4. Vercel automatically deploys to production
5. Live at: https://st-cloud-scoop.vercel.app

---

## 🔐 Part 4: Environment Variables Strategy

### Option A: Minimal Sharing (Recommended)

**You keep all production secrets**

Developer doesn't need environment variables because:
- ✅ Preview deployments use Vercel environment variables (you control)
- ✅ They're building UI/pages (don't need API keys)
- ✅ Claude Code commits and Vercel handles deployment

**When they need to test APIs:**
- They use the **preview URL** (has all environment variables)
- Not testing locally, so no `.env.local` needed

### Option B: Share Test Credentials Only

**If developer needs to test payments/APIs:**

Share **test/staging** credentials only:
```
STRIPE_SECRET_KEY=sk_test_... (not live!)
OPENAI_API_KEY=sk-test-... (if testing AI features)
```

**Never share:**
- ❌ Live Stripe keys
- ❌ Production database passwords
- ❌ Production API keys

### Option C: Read-Only Database Access

**If they need to query data:**
- Create read-only Supabase user
- Share those credentials
- They can view data but not modify

**Recommendation:** Start with **Option A**. Only share credentials if they specifically need them.

---

## 🔒 Part 5: Access Control

### What Developer Can Do:

✅ **Full Access:**
- Create/edit pages and components
- Add features via Claude Code
- Push feature branches
- Create pull requests
- View preview deployments

✅ **Cannot Do (Unless You Grant Access):**
- ❌ Merge to `main` (you approve PRs)
- ❌ Access Vercel settings
- ❌ See production environment variables
- ❌ Access Supabase dashboard
- ❌ Deploy to production directly

### What You Control:

🔒 **You Maintain:**
- Vercel account and settings
- All environment variables (secrets)
- Database access and credentials
- Final approval on all production merges
- Production deployment control

### Recommended Permissions:

| Resource | Your Access | Developer Access |
|----------|-------------|------------------|
| **GitHub Repo** | Admin | Write |
| **Vercel Project** | Owner | None (not needed) |
| **Supabase Database** | Owner | None (not needed) |
| **Environment Variables** | Full Access | None (Vercel handles) |
| **Claude Code** | Your License | Their License |

---

## 🛠️ Part 6: Working Together

### Branch Naming Convention

Use clear, descriptive names:

```bash
# Good
feature/contact-page
feature/team-bios
fix/broken-event-links
update/homepage-hero

# Bad
test
updates
fix
my-branch
```

### Commit Message Format

```bash
# Good
git commit -m "Add contact page with form validation"
git commit -m "Fix broken image links on events page"
git commit -m "Update homepage hero section with new image"

# Bad
git commit -m "updates"
git commit -m "fixed stuff"
git commit -m "changes"
```

### Communication

**Developer starts work:**
```
"I'm adding a contact page - should take about 2 hours"
```

**Developer shares preview:**
```
"Contact page ready for review: [preview URL]"
```

**You review:**
```
"Looks great! Just make the button bigger"
```

**Developer updates:**
```
"Updated! Same preview URL, refresh to see changes"
```

**You approve:**
```
"Perfect! Go ahead and create the PR"
```

**You merge:**
```
[Merge PR on GitHub] → Automatically goes live
```

---

## 🚨 Part 7: Preventing Conflicts

### Rule 1: Always Work on Feature Branches

**Never commit directly to `main`:**

```bash
# ❌ Bad
git checkout main
# make changes
git push origin main

# ✅ Good
git checkout -b feature/new-thing
# make changes
git push origin feature/new-thing
# Create PR, you review, then merge
```

### Rule 2: Pull Latest Changes First

**Before starting new work:**

```bash
git checkout main
git pull origin main
git checkout -b feature/new-feature
```

### Rule 3: Assign Clear Responsibilities

| Area | Owner | Developer |
|------|-------|-----------|
| **Homepage, Events** | You | Ask first |
| **New Pages** | Discuss | Primary |
| **Database Schema** | You | Never |
| **Environment Variables** | You | Never |
| **Bug Fixes** | Either | Either |

### Rule 4: Communicate Before Big Changes

**Always discuss before:**
- Changing database structure
- Modifying shared components (header, footer)
- Updating API routes
- Changing authentication
- Modifying environment variables

---

## 🎓 Part 8: Onboarding Checklist

### Send to New Developer:

**Before They Start:**
- [ ] GitHub account created
- [ ] GitHub email verified
- [ ] Accepted GitHub repo invitation
- [ ] Claude Code access confirmed
- [ ] Read this guide

**First 30 Minutes:**
- [ ] Clone repo in Claude Code
- [ ] Configure git name/email
- [ ] Can successfully run `git status`
- [ ] Created test branch: `git checkout -b test/my-first-branch`
- [ ] Made small change via Claude Code
- [ ] Committed: `git commit -m "Test commit"`
- [ ] Pushed: `git push origin test/my-first-branch`
- [ ] Saw preview URL in Vercel (or received link)
- [ ] Deleted test branch: `git branch -d test/my-first-branch`

**First Week:**
- [ ] Created first real feature branch
- [ ] Built feature with Claude Code
- [ ] Shared preview URL for review
- [ ] Made revisions based on feedback
- [ ] Created pull request
- [ ] PR merged to production
- [ ] Celebrated first deployment! 🎉

---

## 📊 Part 9: Workflow Examples

### Example 1: Adding New Page

**You assign:**
> "Add an About Us page with our mission statement"

**Developer:**
```bash
git checkout main
git pull origin main
git checkout -b feature/about-page
```

**In Claude Code:**
> "Create an About Us page at src/app/about/page.tsx with:
> - Hero section with title 'About St. Cloud Scoop'
> - Mission statement section
> - Team photos (placeholder images)
> - Contact button linking to /contact"

```bash
git add .
git commit -m "Add About Us page with mission statement"
git push origin feature/about-page
```

**Share preview URL → You review → Approve → Merge**

### Example 2: Fixing Bug

**You report:**
> "The event images aren't showing on mobile"

**Developer:**
```bash
git checkout main
git pull origin main
git checkout -b fix/mobile-event-images
```

**In Claude Code:**
> "The event images in src/app/events/view/page.tsx aren't responsive.
> Add Tailwind classes to make them scale properly on mobile."

```bash
git add .
git commit -m "Fix event images not scaling on mobile devices"
git push origin fix/mobile-event-images
```

**Share preview → You test on mobile → Approve → Merge**

### Example 3: Updating Existing Page

**You request:**
> "Change the homepage hero text to say 'Your Daily Scoop'"

**Developer:**
```bash
git checkout main
git pull origin main
git checkout -b update/homepage-hero-text
```

**In Claude Code:**
> "Find the homepage hero section and change the heading to 'Your Daily Scoop'"

```bash
git add .
git commit -m "Update homepage hero text to 'Your Daily Scoop'"
git push origin update/homepage-hero-text
```

**Share preview → You verify → Merge**

---

## 🆘 Part 10: Troubleshooting

### Issue: "Permission denied" when pushing

**Error:** `remote: Permission to VFDavid/st-cloud-scoop.git denied`

**Fix:**
1. Verify they accepted GitHub invitation
2. Check GitHub Settings → Collaborators (should see their name)
3. They may need to authenticate GitHub in Claude Code:
   ```bash
   git config credential.helper store
   git push origin feature/branch-name
   # Enter GitHub username and Personal Access Token
   ```

### Issue: Preview URL not appearing

**Check:**
1. Go to Vercel Dashboard → Deployments
2. Find the branch deployment
3. Check deployment logs for errors
4. Common issues:
   - TypeScript errors (Claude Code usually prevents these)
   - Missing dependencies
   - Build timeout

### Issue: Merge conflicts

**When:** Both changed same file

**Fix:**
```bash
git checkout feature/your-branch
git pull origin main
# Claude Code: "Help me resolve these merge conflicts"
git add .
git commit -m "Resolve merge conflicts"
git push origin feature/your-branch
```

### Issue: Can't see environment variables in preview

**This is normal and intentional!**

- Preview deployments use Vercel's environment variables (you control)
- Developer shouldn't see production secrets
- If they need to test something requiring API keys, share test keys only

---

## 📞 Quick Reference

### For Developer:

**Starting New Work:**
```bash
git checkout main
git pull origin main
git checkout -b feature/descriptive-name
# Ask Claude to build feature
git add .
git commit -m "Clear description of changes"
git push origin feature/descriptive-name
# Share preview URL with you
```

**Making Changes After Review:**
```bash
# Already on feature branch
# Ask Claude to make requested changes
git add .
git commit -m "Address review feedback"
git push origin feature/descriptive-name
# Preview URL auto-updates
```

**After Merge:**
```bash
git checkout main
git pull origin main
# Ready for next feature!
```

### For You (Owner):

**Reviewing Changes:**
1. Click preview URL developer shared
2. Test functionality
3. Check on mobile (if applicable)
4. Reply with approval or requested changes

**Merging:**
1. Go to GitHub PR
2. Review code changes (optional)
3. Click "Merge pull request"
4. Click "Confirm merge"
5. Goes live automatically!

**Emergency Rollback:**
- Vercel Dashboard → Deployments
- Find last working deployment
- Click "Promote to Production"

---

## 💰 Part 11: Cost

### Current (All Free):
- ✅ GitHub (unlimited repos)
- ✅ Vercel (free tier - 100 preview deployments/month)
- ✅ Claude Code (your existing licenses)

### Only Pay If:
- You exceed Vercel free tier (unlikely for small team)
- Need Vercel Pro features ($20/month) - team collaboration, more deployments
- Need private Vercel team ($20/month) - if you want developer to see Vercel dashboard

**Recommendation:** Free tier handles this perfectly. No need to upgrade.

---

## ✅ Summary: Ultra-Simple Setup

### For You (2 minutes):
1. GitHub → Settings → Collaborators → Add their username → Write access
2. (Optional) Share test API keys if they need them
3. Done!

### For Developer (2 minutes):
1. Accept GitHub invitation
2. Clone in Claude Code: `git clone https://github.com/VFDavid/st-cloud-scoop.git`
3. Done! Start coding with Claude Code

### Daily Workflow:
1. Developer creates branch
2. Asks Claude Code to build feature
3. Pushes branch
4. Shares preview URL
5. You review
6. Approve → Merge
7. Goes live automatically

---

## 🎯 Key Advantages of This Setup

✅ **No environment setup** - Just clone and go
✅ **No local server needed** - Preview URLs for testing
✅ **No npm/Node.js required** - Claude Code handles everything
✅ **Both use same AI** - Consistent code quality
✅ **You control production** - Nothing goes live without approval
✅ **Preview before merge** - Test in production-like environment
✅ **Free** - All within free tiers
✅ **Fast** - From idea to deployed preview in minutes

---

**That's it!** Collaboration is this simple when both developers use Claude Code. 🚀

No complicated setup, no environment mismatches, no "works on my machine" problems. Just clone, code with Claude, push, and share previews.
