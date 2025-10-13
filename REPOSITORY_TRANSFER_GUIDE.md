# Repository Transfer Guide: VFDavid → Organization

## 📋 Pre-Transfer Checklist

### Current Configuration
- **Current Owner**: `VFDavid`
- **Repository**: `st-cloud-scoop`
- **Image Repository**: `st-cloud-scoop-images`
- **Deployment**: Vercel
- **Domain**: `st-cloud-scoop.vercel.app` (and custom domain if configured)

### Dependencies Identified
1. **GitHub Repositories** (2):
   - Main app: `VFDavid/st-cloud-scoop`
   - Images: `VFDavid/st-cloud-scoop-images`

2. **Environment Variables** (configured via fallback in code):
   - `GITHUB_OWNER` (defaults to `VFDavid`)
   - `GITHUB_REPO` (defaults to `st-cloud-scoop-images`)
   - `GITHUB_TOKEN` (personal access token)

3. **External Integrations**:
   - Vercel deployment
   - CodeRabbit CLI (authenticated with your GitHub account)
   - Supabase
   - MailerLite
   - Stripe
   - NextAuth (GitHub OAuth provider)

---

## 🚀 Transfer Steps

### STEP 1: Prepare Your Organization

**Before starting, you need:**
1. ✅ GitHub Organization created
2. ✅ You are an owner/admin of the organization
3. ✅ Organization has appropriate plan (free tier works for public repos)

### STEP 2: Transfer Main Repository

**On GitHub.com:**

1. Go to `https://github.com/VFDavid/st-cloud-scoop`
2. Click **Settings** (top right of repo page)
3. Scroll to bottom → **Danger Zone**
4. Click **Transfer ownership**
5. Enter new owner: `YOUR_ORG_NAME`
6. Confirm by typing repository name
7. Click **I understand, transfer this repository**

**Important Notes:**
- Stars, watchers, and forks transfer with the repo
- Issues and PRs remain intact
- GitHub Actions will need re-enabling
- Webhooks remain configured but may need verification

### STEP 3: Transfer Image Repository

Repeat Step 2 for `st-cloud-scoop-images`:

1. Go to `https://github.com/VFDavid/st-cloud-scoop-images`
2. Settings → Danger Zone → Transfer ownership
3. Transfer to same organization

### STEP 4: Update Local Git Remote

**In your local repository:**

```bash
# Update remote URL to point to organization
git remote set-url origin https://github.com/YOUR_ORG_NAME/st-cloud-scoop.git

# Verify the change
git remote -v

# Test by fetching
git fetch origin
```

### STEP 5: Update Vercel Deployment

**Option A: Automatic (Recommended)**
1. Go to Vercel Dashboard → Project Settings
2. Vercel should auto-detect the transfer
3. May ask you to reconnect GitHub integration
4. Click **Reconnect** and authorize organization access

**Option B: Manual Reconnect**
1. Go to Vercel Dashboard → `st-cloud-scoop` project
2. Settings → Git
3. Click **Disconnect** (don't worry, won't affect deployment)
4. Click **Connect Git Repository**
5. Select your organization → `st-cloud-scoop` repo
6. Reconnect with same branch settings (staging, main)

**Verify:**
- Automatic deployments still work
- Environment variables are preserved
- Domain settings unchanged

### STEP 6: Update Environment Variables in Vercel

**Required Updates:**

Go to Vercel Dashboard → Project → Settings → Environment Variables

Update these variables:
```bash
GITHUB_OWNER=YOUR_ORG_NAME
GITHUB_REPO=st-cloud-scoop-images
```

**Keep these the same:**
```bash
GITHUB_TOKEN=<your-token>  # May need new token if scope issues
DEBUG_SECRET=<unchanged>
# All other variables remain the same
```

### STEP 7: Update GitHub OAuth App (NextAuth)

**If using GitHub as OAuth provider:**

1. Go to GitHub Organization Settings
2. Developer settings → OAuth Apps
3. Find your NextAuth app or create new one
4. Update callback URLs if needed:
   - Homepage URL: `https://your-domain.com`
   - Authorization callback: `https://your-domain.com/api/auth/callback/github`
5. Update Vercel env vars:
   ```bash
   GITHUB_ID=<new-client-id>
   GITHUB_SECRET=<new-client-secret>
   ```

### STEP 8: Update GitHub Personal Access Token

**The `GITHUB_TOKEN` may need updating:**

1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Create new token (classic) or fine-grained token
3. **Scopes needed:**
   - `repo` (for private repos)
   - `public_repo` (for public repos)
   - `read:org` (to access org repos)
4. Copy token and update in Vercel:
   ```bash
   GITHUB_TOKEN=<new-token>
   ```

### STEP 9: CodeRabbit CLI Update

**Your CodeRabbit authentication should continue working, but verify:**

```bash
wsl -e bash -c "cd /mnt/c/Users/dpenn/Documents/STC_Scoop && coderabbit auth status"
```

**If needed, re-authenticate:**
```bash
wsl
cd /mnt/c/Users/dpenn/Documents/STC_Scoop
coderabbit auth login
```

### STEP 10: Test Everything

**Critical tests:**

1. **Push a commit:**
   ```bash
   git commit --allow-empty -m "Test post-transfer commit"
   git push origin staging
   ```

2. **Verify Vercel auto-deploys:**
   - Check Vercel dashboard for deployment
   - Verify deployment succeeds

3. **Test image upload:**
   - Go to `/ads/submit` or admin panel
   - Upload a test image
   - Verify it uploads to organization's `st-cloud-scoop-images` repo

4. **Test debug routes (if needed):**
   ```bash
   curl -H "Authorization: Bearer $DEBUG_SECRET" \
     https://st-cloud-scoop.vercel.app/api/debug/recent-campaigns
   ```

5. **Test authentication:**
   - Log in via NextAuth
   - Verify GitHub OAuth works

---

## ⚠️ Potential Issues & Solutions

### Issue 1: Vercel Can't Access Organization Repo

**Symptom:** "Repository not found" in Vercel

**Solution:**
1. Go to GitHub → Organization Settings
2. Third-party access → Vercel
3. Grant Vercel access to the repository
4. Reconnect in Vercel dashboard

### Issue 2: Image Uploads Fail

**Symptom:** 404 or 401 errors when uploading images

**Solution:**
1. Verify `GITHUB_OWNER` and `GITHUB_REPO` env vars in Vercel
2. Check `GITHUB_TOKEN` has correct permissions
3. Verify token can access organization repositories
4. Redeploy after updating env vars

### Issue 3: GitHub OAuth Login Fails

**Symptom:** Users can't log in

**Solution:**
1. Update OAuth app callback URLs
2. Update `GITHUB_ID` and `GITHUB_SECRET` in Vercel
3. Ensure OAuth app is approved for organization (if required)

### Issue 4: Webhooks Stop Working

**Symptom:** Stripe webhooks or other integrations fail

**Solution:**
1. Check webhook URLs in respective services
2. Verify webhook secrets in environment variables
3. Re-save webhooks if needed (they should auto-update)

---

## 📝 Post-Transfer Cleanup

### Update Documentation

Files to update with new organization name:

1. **README.md** - Update repository links
2. **CLAUDE.md** - Update if it references old owner
3. **package.json** - Update repository field if present
4. **Any deployment guides** - Update GitHub URLs

### Update Team Access

**In GitHub Organization:**
1. Add team members to repository
2. Set appropriate permissions (write, admin, etc.)
3. Configure branch protection rules
4. Review security settings

### Verify All Integrations

- [x] Vercel deployments
- [x] GitHub Actions (if any)
- [x] CodeRabbit CLI
- [x] Supabase (should be unaffected)
- [x] MailerLite (should be unaffected)
- [x] Stripe (should be unaffected)
- [x] Image uploads to GitHub

---

## 🎯 Quick Reference

### Environment Variables to Update in Vercel

```bash
# MUST UPDATE
GITHUB_OWNER=YOUR_ORG_NAME
GITHUB_REPO=st-cloud-scoop-images

# MAY NEED UPDATE
GITHUB_TOKEN=<new-token-with-org-access>
GITHUB_ID=<if-using-github-oauth>
GITHUB_SECRET=<if-using-github-oauth>

# SHOULD REMAIN UNCHANGED
DEBUG_SECRET=<unchanged>
DATABASE_URL=<unchanged>
NEXTAUTH_SECRET=<unchanged>
# All other vars unchanged
```

### Git Commands Quick Reference

```bash
# Update remote
git remote set-url origin https://github.com/YOUR_ORG_NAME/st-cloud-scoop.git

# Verify
git remote -v

# Test push
git push origin staging

# Pull latest
git pull origin staging
```

---

## ✅ Final Checklist

Before considering the transfer complete:

- [ ] Both repositories transferred to organization
- [ ] Local git remote updated
- [ ] Vercel reconnected to new organization repo
- [ ] Environment variables updated in Vercel
- [ ] GitHub OAuth app updated (if applicable)
- [ ] GitHub token updated with org access
- [ ] Test deployment successful
- [ ] Test image upload successful
- [ ] Test authentication works
- [ ] Documentation updated
- [ ] Team members invited to org/repo
- [ ] CodeRabbit still works
- [ ] All external services verified

---

## 🆘 Need Help?

If you encounter issues:

1. Check Vercel deployment logs
2. Check GitHub Actions logs (if any)
3. Verify environment variables in Vercel
4. Test with `curl` commands
5. Check browser console for client-side errors

**Common commands for debugging:**
```bash
# Check current remote
git remote -v

# Check Vercel deployment
vercel --version
vercel list

# Test API endpoints
curl https://st-cloud-scoop.vercel.app/api/health
```

---

**Estimated Time:** 15-30 minutes
**Downtime Expected:** None (if done carefully)
**Risk Level:** Low (GitHub transfers are safe and reversible within 24 hours)
