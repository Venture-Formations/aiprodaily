# Master → Main Branch Migration Plan

**Date Created:** 2025-11-11
**Target Execution:** 2025-11-12 Morning
**Estimated Time:** 2-3 hours
**Risk Level:** MEDIUM

---

## 📋 Executive Summary

**Current State:**
- Working branch: `master` (commit 35b0d96)
- Image storage: Split between `master` (old) and `main` (new)
- Production deployments: Likely pointing to `master`
- Advertisement uploads: Already configured for `main` ✅
- Business image uploads: Currently saving to `master` ⚠️

**Goal:**
Consolidate all development on `main` branch and migrate critical images from `master` to `main`.

**Why This Matters:**
- GitHub industry standard is `main` (not `master`)
- Better collaboration and tooling support
- Current split state causes confusion
- Images are scattered across branches

---

## 🎯 Success Criteria

- [x] All code saves images to `main` branch
- [x] Critical images migrated from `master` to `main`
- [x] Social media icons moved to `public/` folder
- [x] Database references updated to `main` branch URLs
- [x] Production deployments working from `main`
- [x] No broken images on website or emails
- [x] Local development switched to `main`

---

## 📊 Current Inventory

### Images in `master` Branch

#### 1. **Business Branding Images** (11 files) 🚨 CRITICAL
**Location:** `business/` directory
**Purpose:** Newsletter headers and logos used in emails and website

```
business/business-header-1760623595373.png
business/business-header-1760623817270.png
business/business-header-1760624093181.png
business/business-header-1760624240642.png
business/business-header-1760993772168.png
business/business-header-1761050419114.png
business/business-header-1761058431254.png
business/business-logo-1760632118687.png
business/business-logo-1761055196303.png
business/business-logo-1761056643605.png  ← Currently used in production!
business/business-website_header-1761058292513.png
```

**Database Impact:**
- `app_settings` table: `header_image_url`, `logo_url`, `website_header_url` keys
- `newsletters` table: `logo_url` column
- Used in email templates via `newsletter-templates.ts`

**Action Required:** ✅ MIGRATE to `main`

---

#### 2. **Newsletter Content Images** (9 files) 🚨 CRITICAL
**Location:** `newsletter-images/` directory
**Purpose:** Images embedded in past newsletter articles

```
newsletter-images/033d346657b378dda9b55652489ab4d4.webp
newsletter-images/34b4435ad5668000aaa90b359428cb7d.png
newsletter-images/594bcaa444721ccfa8fe124f1ab60403.png
newsletter-images/70c431a4a67560e6db3719e71a3096a2.jpg
newsletter-images/7c599d4054e0cdb04470fc70f9c9268b.jpg
newsletter-images/8f4cdcc5b48ae55e36a1f3125617f9d0.jpg
newsletter-images/b1fc0a04d28e8dc19fb388e75e1f7938.jpg
newsletter-images/bd4dbc7b3e50776888a916d22e5f3f8c.jpg
newsletter-images/e51280d68ab874a1e0e100432a75497d.jpg
```

**Database Impact:**
- `articles` table: `image_url` column (may reference these images)
- `secondary_articles` table: `image_url` column
- Historical newsletters sent to subscribers

**Action Required:** ✅ MIGRATE to `main`

---

#### 3. **Social Media Icons** (4 files) ⚠️ NEEDS RELOCATION
**Location:** Root directory (wrong location)
**Purpose:** Social media links in email footers

```
facebook_light.png
instagram_light.png
linkedin_light.png
twitter_light.png
```

**Database Impact:**
- Possibly referenced in email templates or settings

**Action Required:** ✅ MIGRATE to `main` AND move to `public/social/` directory

---

#### 4. **Old Advertisement Images** (9 files) ✅ SKIP
**Location:** `advertisements/` directory
**Date Range:** October 8-9, 2025
**Status:** Outdated, no longer needed

```
advertisements/ad-1759957234892.jpg (Oct 8)
advertisements/ad-1760035555026.jpg (Oct 9)
... (7 more old ads)
```

**Action Required:** ❌ DO NOT MIGRATE (outdated content)

---

#### 5. **Screenshot** (1 file) ✅ SKIP
**Location:** Root directory
**File:** `Screenshot 2025-10-14 111624.png`

**Action Required:** ❌ DO NOT MIGRATE (not needed)

---

### Images in `main` Branch

#### 1. **Advertisement Images** (13 files) ✅ CURRENT
**Location:** `advertisements/` directory
**Date Range:** November 6+, 2025
**Status:** Current production ads

```
advertisements/ad-1762443608378.jpg (Nov 6+)
advertisements/ad-1762547127142.jpg
... (11 more current ads)
```

**Note:** Ad upload API already configured to save to `main` ✅

---

## 🔧 Code Changes Required

### 1. **Business Image Upload Endpoint** 🚨 CRITICAL

**File:** `src/app/api/settings/upload-business-image/route.ts`

**Line 49:** Current code defaults to `master`
```typescript
const githubBranch = process.env.GITHUB_BRANCH || 'master'  // ⚠️ CHANGE THIS
```

**Required Change:**
```typescript
const githubBranch = process.env.GITHUB_BRANCH || 'main'  // ✅ NEW
```

**Why:** Business logos and headers should save to `main` going forward

---

### 2. **Debug Maintenance Endpoint** ⚠️ MEDIUM

**File:** `src/app/api/debug/(maintenance)/update-image-urls/route.ts`

**Line 6:** Hardcoded master branch URL
```typescript
const correctLogoUrl = 'https://raw.githubusercontent.com/Venture-Formations/aiprodaily/refs/heads/master/business/business-logo-1761056643605.png'
```

**Required Change:**
```typescript
const correctLogoUrl = 'https://raw.githubusercontent.com/Venture-Formations/aiprodaily/refs/heads/main/business/business-logo-1761056643605.png'
```

**Why:** This endpoint updates database URLs and should reference the correct branch

---

### 3. **GitHub Storage Class** ℹ️ INFO ONLY

**File:** `src/lib/github-storage.ts`

**Lines 103, 202, 394, 466:** Uses `createOrUpdateFileContents` without specifying branch
```typescript
await this.octokit.repos.createOrUpdateFileContents({
  owner: this.owner,
  repo: this.repo,
  path: filePath,
  // No branch specified - uses repo default
})
```

**Note:** This uses the **repository's default branch** (configured in GitHub settings). Once we update GitHub's default branch to `main`, this will automatically work correctly.

**Action Required:** ✅ Update GitHub default branch setting (Step 6 below)

---

### 4. **Advertisement Upload** ✅ ALREADY CORRECT

**File:** `src/app/api/ads/upload-image/route.ts`

**Line 78:** Already configured for `main`
```typescript
body: JSON.stringify({
  message: `Add advertisement image: ${filename}`,
  content: base64Content,
  branch: 'main'  // ✅ Already correct
})
```

**Action Required:** ✅ None - already correct

---

## 🗄️ Database Verification

### Tables to Check

#### 1. **app_settings** (Newsletter branding)
```sql
SELECT key, value
FROM app_settings
WHERE key IN (
  'header_image_url',
  'logo_url',
  'website_header_url'
)
AND value LIKE '%master%';
```

**Expected:** URLs pointing to master branch
**Action:** Update to `main` after migration

---

#### 2. **newsletters** (Logo references)
```sql
SELECT id, name, logo_url
FROM newsletters
WHERE logo_url LIKE '%master%';
```

**Expected:** Logo URLs pointing to master branch
**Action:** Update to `main` after migration

---

#### 3. **articles** (Content images)
```sql
SELECT id, headline, image_url
FROM articles
WHERE image_url LIKE '%newsletter-images%'
  OR image_url LIKE '%master%'
LIMIT 20;
```

**Expected:** Some articles may reference master branch images
**Action:** Update to `main` after migration

---

#### 4. **secondary_articles** (Content images)
```sql
SELECT id, headline, image_url
FROM secondary_articles
WHERE image_url LIKE '%newsletter-images%'
  OR image_url LIKE '%master%'
LIMIT 20;
```

**Expected:** Some articles may reference master branch images
**Action:** Update to `main` after migration

---

## 📝 Step-by-Step Migration Plan

### PHASE 1: Pre-Migration Preparation (30 minutes)

#### Step 1.1: Backup Current State
```bash
# Document current branch
git branch --show-current > pre-migration-branch.txt
git log -1 --oneline > pre-migration-commit.txt

# Export database references (run these in Supabase SQL editor)
# Save results to text files for reference
```

**Checklist:**
- [ ] Current branch documented
- [ ] Current commit hash saved
- [ ] Database image references exported
- [ ] Current Vercel deployment URL saved

---

#### Step 1.2: Verify Vercel Settings
1. Go to: https://vercel.com/[your-project]/settings/git
2. Document current production branch: ____________
3. Document current deployment status: ____________

**Checklist:**
- [ ] Production branch documented
- [ ] Deployment status confirmed
- [ ] Recent deployment logs reviewed

---

#### Step 1.3: Check GitHub Default Branch
1. Go to: https://github.com/Venture-Formations/aiprodaily/settings/branches
2. Document current default branch: ____________

**Checklist:**
- [ ] Default branch documented
- [ ] Branch protection rules reviewed

---

### PHASE 2: Code Updates (15 minutes)

#### Step 2.1: Update Business Image Upload
```bash
# Edit file: src/app/api/settings/upload-business-image/route.ts
# Line 49: Change 'master' to 'main'
```

**Before:**
```typescript
const githubBranch = process.env.GITHUB_BRANCH || 'master'
```

**After:**
```typescript
const githubBranch = process.env.GITHUB_BRANCH || 'main'
```

**Checklist:**
- [ ] File edited
- [ ] Change verified
- [ ] No syntax errors

---

#### Step 2.2: Update Debug Maintenance Endpoint
```bash
# Edit file: src/app/api/debug/(maintenance)/update-image-urls/route.ts
# Line 6: Change 'master' to 'main' in URL
```

**Before:**
```typescript
const correctLogoUrl = 'https://raw.githubusercontent.com/Venture-Formations/aiprodaily/refs/heads/master/business/business-logo-1761056643605.png'
```

**After:**
```typescript
const correctLogoUrl = 'https://raw.githubusercontent.com/Venture-Formations/aiprodaily/refs/heads/main/business/business-logo-1761056643605.png'
```

**Checklist:**
- [ ] File edited
- [ ] URL updated
- [ ] No syntax errors

---

#### Step 2.3: Commit Code Changes
```bash
# On current branch (docs/claude-optimized)
git add src/app/api/settings/upload-business-image/route.ts
git add src/app/api/debug/(maintenance)/update-image-urls/route.ts

git commit -m "chore: update image uploads from master to main branch

- Update business image upload endpoint to use main branch
- Update debug maintenance endpoint URL reference
- Preparation for master → main migration"

git push origin docs/claude-optimized
```

**Checklist:**
- [ ] Changes committed
- [ ] Commit message clear
- [ ] Pushed to remote

---

### PHASE 3: Image Migration (45 minutes)

#### Step 3.1: Create Migration Script

Create file: `scripts/migrate-images.js`

```javascript
/**
 * Migration Script: Copy Images from Master → Main
 *
 * Purpose: Migrate critical images from master branch to main branch
 * including business branding and newsletter content images.
 */

const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const OWNER = 'Venture-Formations';
const REPO = 'aiprodaily';
const SOURCE_BRANCH = 'master';
const TARGET_BRANCH = 'main';

// Files to migrate
const FILES_TO_MIGRATE = [
  // Business branding images
  'business/business-header-1760623595373.png',
  'business/business-header-1760623817270.png',
  'business/business-header-1760624093181.png',
  'business/business-header-1760624240642.png',
  'business/business-header-1760993772168.png',
  'business/business-header-1761050419114.png',
  'business/business-header-1761058431254.png',
  'business/business-logo-1760632118687.png',
  'business/business-logo-1761055196303.png',
  'business/business-logo-1761056643605.png',
  'business/business-website_header-1761058292513.png',

  // Newsletter content images
  'newsletter-images/033d346657b378dda9b55652489ab4d4.webp',
  'newsletter-images/34b4435ad5668000aaa90b359428cb7d.png',
  'newsletter-images/594bcaa444721ccfa8fe124f1ab60403.png',
  'newsletter-images/70c431a4a67560e6db3719e71a3096a2.jpg',
  'newsletter-images/7c599d4054e0cdb04470fc70f9c9268b.jpg',
  'newsletter-images/8f4cdcc5b48ae55e36a1f3125617f9d0.jpg',
  'newsletter-images/b1fc0a04d28e8dc19fb388e75e1f7938.jpg',
  'newsletter-images/bd4dbc7b3e50776888a916d22e5f3f8c.jpg',
  'newsletter-images/e51280d68ab874a1e0e100432a75497d.jpg',
];

// Social media icons to migrate to new location
const SOCIAL_ICONS_TO_MIGRATE = [
  { source: 'facebook_light.png', target: 'public/social/facebook_light.png' },
  { source: 'instagram_light.png', target: 'public/social/instagram_light.png' },
  { source: 'linkedin_light.png', target: 'public/social/linkedin_light.png' },
  { source: 'twitter_light.png', target: 'public/social/twitter_light.png' },
];

async function migrateFile(sourcePath, targetPath = sourcePath) {
  try {
    console.log(`\n📄 Migrating: ${sourcePath}`);

    // Get file content from source branch
    const { data: sourceFile } = await octokit.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: sourcePath,
      ref: SOURCE_BRANCH
    });

    if (!sourceFile || sourceFile.type !== 'file') {
      console.log(`  ⚠️  Not a file, skipping: ${sourcePath}`);
      return { success: false, reason: 'not_a_file' };
    }

    // Check if file already exists in target branch
    try {
      const { data: existingFile } = await octokit.repos.getContent({
        owner: OWNER,
        repo: REPO,
        path: targetPath,
        ref: TARGET_BRANCH
      });

      if (existingFile) {
        console.log(`  ✅ Already exists in ${TARGET_BRANCH}: ${targetPath}`);
        return { success: true, reason: 'already_exists' };
      }
    } catch (error) {
      // File doesn't exist, proceed with migration
      if (error.status !== 404) throw error;
    }

    // Create file in target branch
    await octokit.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO,
      path: targetPath,
      message: `Migrate image from ${SOURCE_BRANCH}: ${sourcePath}`,
      content: sourceFile.content,
      branch: TARGET_BRANCH
    });

    console.log(`  ✅ Successfully migrated: ${sourcePath} → ${targetPath}`);
    return { success: true, reason: 'migrated' };

  } catch (error) {
    console.error(`  ❌ Failed to migrate ${sourcePath}:`, error.message);
    return { success: false, reason: error.message };
  }
}

async function main() {
  console.log('🚀 Starting Image Migration: Master → Main\n');
  console.log(`Source: ${SOURCE_BRANCH}`);
  console.log(`Target: ${TARGET_BRANCH}\n`);

  const results = {
    migrated: 0,
    already_exists: 0,
    failed: 0
  };

  // Migrate business and newsletter images
  console.log('📦 Migrating business and newsletter images...');
  for (const file of FILES_TO_MIGRATE) {
    const result = await migrateFile(file);
    if (result.success) {
      if (result.reason === 'migrated') results.migrated++;
      if (result.reason === 'already_exists') results.already_exists++;
    } else {
      results.failed++;
    }
    // Rate limit: wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Migrate social icons to new location
  console.log('\n📱 Migrating social media icons to public/social/...');
  for (const { source, target } of SOCIAL_ICONS_TO_MIGRATE) {
    const result = await migrateFile(source, target);
    if (result.success) {
      if (result.reason === 'migrated') results.migrated++;
      if (result.reason === 'already_exists') results.already_exists++;
    } else {
      results.failed++;
    }
    // Rate limit: wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Successfully migrated: ${results.migrated}`);
  console.log(`ℹ️  Already existed: ${results.already_exists}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('='.repeat(50) + '\n');

  if (results.failed > 0) {
    console.log('⚠️  Some files failed to migrate. Review errors above.');
    process.exit(1);
  } else {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  }
}

// Run migration
main().catch(error => {
  console.error('\n💥 Migration script failed:', error);
  process.exit(1);
});
```

**Checklist:**
- [ ] Script file created
- [ ] File paths verified
- [ ] Script syntax validated

---

#### Step 3.2: Install Dependencies
```bash
# Install Octokit if not already installed
npm install @octokit/rest
```

**Checklist:**
- [ ] Octokit installed
- [ ] No installation errors

---

#### Step 3.3: Run Migration Script
```bash
# Set GitHub token (use personal access token with repo permissions)
export GITHUB_TOKEN="your-github-token-here"

# Run migration
node scripts/migrate-images.js
```

**Expected Output:**
```
🚀 Starting Image Migration: Master → Main

Source: master
Target: main

📦 Migrating business and newsletter images...

📄 Migrating: business/business-header-1760623595373.png
  ✅ Successfully migrated: business/business-header-1760623595373.png → business/business-header-1760623595373.png

... (more files)

📱 Migrating social media icons to public/social/...

📄 Migrating: facebook_light.png
  ✅ Successfully migrated: facebook_light.png → public/social/facebook_light.png

... (more icons)

==================================================
📊 MIGRATION SUMMARY
==================================================
✅ Successfully migrated: 24
ℹ️  Already existed: 0
❌ Failed: 0
==================================================

🎉 Migration completed successfully!
```

**Checklist:**
- [ ] Script executed successfully
- [ ] All 24 files migrated
- [ ] No errors in output
- [ ] GitHub shows new files in `main` branch

---

### PHASE 4: Database Updates (30 minutes)

#### Step 4.1: Update app_settings Table

**SQL Query:** (Run in Supabase SQL Editor)
```sql
-- Update header_image_url references
UPDATE app_settings
SET value = REPLACE(value, '/refs/heads/master/', '/refs/heads/main/')
WHERE key IN ('header_image_url', 'logo_url', 'website_header_url')
  AND value LIKE '%master%';

-- Verify changes
SELECT key, value
FROM app_settings
WHERE key IN ('header_image_url', 'logo_url', 'website_header_url');
```

**Checklist:**
- [ ] Query executed
- [ ] URLs updated to `main`
- [ ] Changes verified

---

#### Step 4.2: Update newsletters Table

**SQL Query:**
```sql
-- Update logo_url in newsletters table
UPDATE newsletters
SET logo_url = REPLACE(logo_url, '/refs/heads/master/', '/refs/heads/main/')
WHERE logo_url LIKE '%master%';

-- Verify changes
SELECT id, name, logo_url
FROM newsletters;
```

**Checklist:**
- [ ] Query executed
- [ ] Logo URLs updated
- [ ] Changes verified

---

#### Step 4.3: Update articles Table (if needed)

**Check first:**
```sql
-- See if any articles reference master branch
SELECT id, headline, image_url
FROM articles
WHERE image_url LIKE '%master%'
LIMIT 10;
```

**If results found, update:**
```sql
-- Update article image URLs
UPDATE articles
SET image_url = REPLACE(image_url, '/refs/heads/master/', '/refs/heads/main/')
WHERE image_url LIKE '%master%';

-- Verify changes
SELECT id, headline, image_url
FROM articles
WHERE image_url LIKE '%main%'
LIMIT 10;
```

**Checklist:**
- [ ] Articles checked
- [ ] URLs updated (if needed)
- [ ] Changes verified

---

#### Step 4.4: Update secondary_articles Table (if needed)

**Check first:**
```sql
-- See if any secondary articles reference master branch
SELECT id, headline, image_url
FROM secondary_articles
WHERE image_url LIKE '%master%'
LIMIT 10;
```

**If results found, update:**
```sql
-- Update secondary article image URLs
UPDATE secondary_articles
SET image_url = REPLACE(image_url, '/refs/heads/master/', '/refs/heads/main/')
WHERE image_url LIKE '%master%';

-- Verify changes
SELECT id, headline, image_url
FROM secondary_articles
WHERE image_url LIKE '%main%'
LIMIT 10;
```

**Checklist:**
- [ ] Secondary articles checked
- [ ] URLs updated (if needed)
- [ ] Changes verified

---

### PHASE 5: Merge to Main (10 minutes)

#### Step 5.1: Merge docs/claude-optimized → main

**Option A: Via Git Command Line**
```bash
# Checkout main branch
git checkout main
git pull origin main

# Merge docs/claude-optimized
git merge docs/claude-optimized

# Push to remote
git push origin main
```

**Option B: Via GitHub PR (Recommended)**
1. Go to: https://github.com/Venture-Formations/aiprodaily/compare
2. Set base: `main`, compare: `docs/claude-optimized`
3. Create Pull Request
4. Review changes
5. Merge Pull Request

**Checklist:**
- [ ] Merge completed
- [ ] No merge conflicts
- [ ] Changes pushed to `main`
- [ ] GitHub shows updated files

---

### PHASE 6: GitHub & Vercel Configuration (15 minutes)

#### Step 6.1: Update GitHub Default Branch

1. Go to: https://github.com/Venture-Formations/aiprodaily/settings/branches
2. Under "Default branch", click the switch icon
3. Select `main` from dropdown
4. Click "Update"
5. Confirm the change

**Checklist:**
- [ ] Default branch changed to `main`
- [ ] Change confirmed
- [ ] GitHub shows `main` as default

---

#### Step 6.2: Update Vercel Production Branch

1. Go to: https://vercel.com/[your-project]/settings/git
2. Under "Production Branch", change to `main`
3. Click "Save"
4. Go to Deployments tab
5. Click "Redeploy" on latest deployment

**Checklist:**
- [ ] Production branch set to `main`
- [ ] Settings saved
- [ ] Redeployment triggered
- [ ] Deployment successful

---

#### Step 6.3: Verify Vercel Environment Variables

1. Go to: https://vercel.com/[your-project]/settings/environment-variables
2. Check for: `GITHUB_BRANCH`
3. If exists, update value to: `main`
4. If doesn't exist, it will use code default (now `main`)

**Checklist:**
- [ ] Environment variables checked
- [ ] `GITHUB_BRANCH` updated or confirmed absent
- [ ] Changes saved

---

### PHASE 7: Local Development Switch (5 minutes)

#### Step 7.1: Switch Local Branch

```bash
# Fetch latest
git fetch origin

# Checkout main
git checkout main
git pull origin main

# Verify
git branch --show-current  # Should show: main
git log -1 --oneline        # Should show latest commit
```

**Checklist:**
- [ ] Switched to `main`
- [ ] Latest code pulled
- [ ] Branch verified

---

#### Step 7.2: Update Local Environment

```bash
# Optionally set GITHUB_BRANCH in .env.local
echo "GITHUB_BRANCH=main" >> .env.local

# Restart development server
npm run dev
```

**Checklist:**
- [ ] Environment updated (if needed)
- [ ] Dev server restarted
- [ ] No errors in console

---

### PHASE 8: Verification & Testing (30 minutes)

#### Step 8.1: Test Image Uploads

**Business Image Upload:**
1. Login to dashboard: http://localhost:3000/dashboard/[slug]/settings
2. Upload a test header image
3. Verify upload successful
4. Check GitHub: https://github.com/Venture-Formations/aiprodaily/tree/main/business
5. Verify new image appears in `main` branch

**Checklist:**
- [ ] Test upload successful
- [ ] Image appears in `main` branch
- [ ] Image displays on website
- [ ] No errors in console

---

**Advertisement Upload:**
1. Go to ads page: http://localhost:3000/dashboard/[slug]/databases/ads
2. Upload a test ad image
3. Verify upload successful
4. Check GitHub: https://github.com/Venture-Formations/aiprodaily/tree/main/advertisements
5. Verify new image appears in `main` branch

**Checklist:**
- [ ] Test upload successful
- [ ] Image appears in `main` branch
- [ ] Ad displays correctly
- [ ] No errors in console

---

#### Step 8.2: Verify Migrated Images Load

**Business Images:**
1. Open newsletter settings page
2. Verify logo and header display correctly
3. Check browser dev tools - no 404 errors
4. Test URLs directly in browser:
   ```
   https://raw.githubusercontent.com/Venture-Formations/aiprodaily/refs/heads/main/business/business-logo-1761056643605.png
   ```

**Checklist:**
- [ ] Logo displays
- [ ] Header displays
- [ ] No 404 errors
- [ ] Direct URL loads

---

**Social Media Icons:**
1. View website footer or email template
2. Verify social icons display
3. Test new URL:
   ```
   https://raw.githubusercontent.com/Venture-Formations/aiprodaily/refs/heads/main/public/social/facebook_light.png
   ```

**Checklist:**
- [ ] Icons display
- [ ] No 404 errors
- [ ] Direct URL loads

---

#### Step 8.3: Test Production Website

**Website Homepage:**
1. Go to: https://[your-domain].com
2. Verify logo displays
3. Verify header image displays
4. Check browser console for errors

**Checklist:**
- [ ] Logo loads
- [ ] Header loads
- [ ] No console errors
- [ ] No 404 errors

---

**Newsletter Archive:**
1. Go to: https://[your-domain].com/newsletters
2. Check past newsletters
3. Verify embedded images display
4. Check for any broken images

**Checklist:**
- [ ] Past newsletters display
- [ ] Images load correctly
- [ ] No broken images
- [ ] No console errors

---

#### Step 8.4: Test Email Templates

**Send Test Email:**
1. Go to dashboard campaigns
2. Create a test campaign
3. Send preview email to yourself
4. Verify header image loads
5. Verify article images load

**Checklist:**
- [ ] Test email sent
- [ ] Header image displays
- [ ] Article images display
- [ ] No broken images

---

### PHASE 9: Monitor & Validate (24 hours)

#### Step 9.1: Monitor Vercel Logs

1. Go to: https://vercel.com/[your-project]/logs
2. Filter by: Last 24 hours
3. Look for:
   - GitHub upload errors
   - Image loading 404s
   - Deployment failures

**Checklist:**
- [ ] Logs reviewed
- [ ] No critical errors
- [ ] Uploads working

---

#### Step 9.2: Monitor Cron Jobs

**Check each cron:**
- [ ] `/api/cron/ingest-rss` - RSS fetching
- [ ] `/api/cron/trigger-workflow` - Campaign generation
- [ ] `/api/cron/send-review` - Review emails
- [ ] `/api/cron/send-final` - Final emails

**Verify:**
- [ ] All crons executing
- [ ] No failures in logs
- [ ] Workflows completing

---

#### Step 9.3: Database Verification Query

Run final verification:
```sql
-- Check for any remaining master references
SELECT
  'app_settings' as table_name,
  key as field,
  value
FROM app_settings
WHERE value LIKE '%master%'

UNION ALL

SELECT
  'newsletters' as table_name,
  'logo_url' as field,
  logo_url as value
FROM newsletters
WHERE logo_url LIKE '%master%'

UNION ALL

SELECT
  'articles' as table_name,
  'image_url' as field,
  image_url as value
FROM articles
WHERE image_url LIKE '%master%'
LIMIT 10;
```

**Expected Result:** Zero rows (all references updated to `main`)

**Checklist:**
- [ ] Query executed
- [ ] No master references found
- [ ] All URLs point to `main`

---

### PHASE 10: Cleanup (Optional - After 7 Days)

#### Step 10.1: Archive master Branch

**Only after confirming everything works for 1 week!**

```bash
# Rename master to master-archive
git branch --move master master-archive
git push origin master-archive

# Delete old master branch
git push origin --delete master

# Delete local master
git branch -d master
```

**Checklist:**
- [ ] 7 days passed with stable operation
- [ ] master archived
- [ ] Remote master deleted
- [ ] Local master deleted

---

#### Step 10.2: Update Documentation

Files to update:
- [ ] README.md (if it mentions master)
- [ ] CLAUDE.md (update any references)
- [ ] docs/ (update deployment guides)

---

## 🚨 Rollback Plan

If critical issues occur after migration:

### Immediate Rollback (< 1 hour)

#### Option 1: Revert Vercel Production Branch
1. Go to Vercel → Settings → Git
2. Change production branch back to `master`
3. Trigger redeployment
4. Website returns to previous state

**Time:** 5 minutes
**Impact:** Minimal downtime

---

#### Option 2: Revert GitHub Default Branch
1. Go to GitHub → Settings → Branches
2. Change default branch back to `master`
3. Image uploads resume to `master`

**Time:** 2 minutes
**Impact:** None on production

---

### Full Rollback (If Needed)

#### Step 1: Revert Code Changes
```bash
# Switch back to master
git checkout master

# Revert the commit with code changes
git revert [commit-hash-of-migration]

# Push revert
git push origin master
```

---

#### Step 2: Revert Database URLs (if updated)
```sql
-- Change back to master
UPDATE app_settings
SET value = REPLACE(value, '/refs/heads/main/', '/refs/heads/master/')
WHERE key IN ('header_image_url', 'logo_url', 'website_header_url');

UPDATE newsletters
SET logo_url = REPLACE(logo_url, '/refs/heads/main/', '/refs/heads/master/')
WHERE logo_url LIKE '%main%';
```

---

## ❓ Troubleshooting

### Issue: Images not loading after migration

**Symptoms:**
- 404 errors in browser console
- Broken image icons on website
- Missing logos/headers

**Solution:**
1. Verify images exist in `main` branch on GitHub
2. Check URL format in database matches GitHub:
   ```
   https://raw.githubusercontent.com/Venture-Formations/aiprodaily/refs/heads/main/business/[filename]
   ```
3. Clear browser cache (Ctrl+Shift+R)
4. Check Vercel deployment logs for errors

---

### Issue: Upload failing with 404

**Symptoms:**
- Image upload returns error
- "Branch not found" message

**Solution:**
1. Verify GitHub default branch is `main`
2. Check code changes were deployed to production
3. Verify `GITHUB_BRANCH` env var in Vercel (should be `main` or not set)
4. Check GitHub token has write permissions

---

### Issue: Cron jobs failing

**Symptoms:**
- Workflows not completing
- RSS posts not processing

**Solution:**
1. Check Vercel logs: https://vercel.com/[project]/logs
2. Verify all crons are enabled
3. Check API routes deployed correctly
4. Trigger manual workflow to test

---

### Issue: Database references still pointing to master

**Symptoms:**
- Old URLs in database after update
- Mixed master/main references

**Solution:**
1. Re-run database update queries from Phase 4
2. Check for cached queries in application
3. Restart Vercel deployment to clear any caches
4. Verify queries completed successfully

---

## 📞 Support & Questions

**If you encounter issues:**

1. **Check logs first:**
   - Vercel deployment logs
   - Browser console errors
   - Database query results

2. **Review phases:**
   - Identify which phase has the issue
   - Review checklist items
   - Verify prerequisites completed

3. **Document the issue:**
   - Screenshot errors
   - Copy error messages
   - Note steps taken

4. **Rollback if critical:**
   - Use rollback plan above
   - Document what went wrong
   - Plan fix before retrying

---

## ✅ Success Confirmation

Migration is **100% complete** when:

- [ ] All code changes committed to `main`
- [ ] All critical images migrated to `main`
- [ ] Social media icons in `public/social/`
- [ ] Database URLs updated to `main`
- [ ] GitHub default branch is `main`
- [ ] Vercel production deploys from `main`
- [ ] Local development on `main`
- [ ] Image uploads save to `main`
- [ ] Website loads without broken images
- [ ] Email templates display correctly
- [ ] Test upload successful
- [ ] Cron jobs executing normally
- [ ] 24 hours of stable operation
- [ ] Zero master references in database

---

## 📊 Estimated Timeline

| Phase | Description | Time | Risk |
|-------|-------------|------|------|
| 1 | Pre-Migration Prep | 30 min | LOW |
| 2 | Code Updates | 15 min | LOW |
| 3 | Image Migration | 45 min | MEDIUM |
| 4 | Database Updates | 30 min | MEDIUM |
| 5 | Merge to Main | 10 min | LOW |
| 6 | GitHub/Vercel Config | 15 min | HIGH |
| 7 | Local Switch | 5 min | LOW |
| 8 | Verification | 30 min | MEDIUM |
| 9 | Monitoring | 24 hrs | LOW |
| 10 | Cleanup | 10 min | LOW |
| **TOTAL** | **Active Work** | **~3 hrs** | **MEDIUM** |

**Best Time to Execute:** Morning (low traffic)
**Required Downtime:** 2-5 minutes (during Vercel redeploy)
**Recovery Time (if rollback needed):** 5-10 minutes

---

## 🎯 Pre-Work (Do Tonight)

To make tomorrow morning smoother:

### 1. Install Dependencies
```bash
npm install @octokit/rest
```

### 2. Create Migration Script
- Save the script from Phase 3, Step 3.1
- Place in: `scripts/migrate-images.js`

### 3. Get GitHub Token
1. Go to: https://github.com/settings/tokens
2. Generate new token (classic)
3. Permissions needed:
   - `repo` (full control)
4. Save token securely for tomorrow

### 4. Export Current Database State
Run these queries and save results:

```sql
-- Export app_settings
SELECT * FROM app_settings
WHERE key IN ('header_image_url', 'logo_url', 'website_header_url');

-- Export newsletters
SELECT id, name, logo_url FROM newsletters;

-- Export articles with images
SELECT id, headline, image_url
FROM articles
WHERE image_url IS NOT NULL
LIMIT 50;
```

Save to: `pre-migration-database-export.txt`

### 5. Document Current State
```bash
# Current branch
git branch --show-current > pre-migration-state.txt

# Current commit
git log -1 --oneline >> pre-migration-state.txt

# Current remotes
git remote -v >> pre-migration-state.txt
```

### 6. Review Vercel Dashboard
- [ ] Note current production branch
- [ ] Note recent deployment status
- [ ] Check environment variables

---

## 📝 Questions Checklist

Before starting tomorrow, confirm:

- [ ] **Do you have access to:**
  - GitHub repository (admin rights)
  - Vercel dashboard (deployment access)
  - Supabase database (admin access)

- [ ] **Do you have:**
  - GitHub personal access token
  - Vercel admin login
  - 2-3 hours of uninterrupted time

- [ ] **Are you comfortable:**
  - Running Node.js scripts
  - Executing SQL queries
  - Using Git command line
  - Editing TypeScript files

- [ ] **Have you:**
  - Read this entire plan
  - Prepared migration script
  - Exported database state
  - Installed dependencies

---

## 🚀 Ready to Start?

**On migration day:**

1. ☕ Get coffee
2. 📖 Review this plan
3. ⏰ Pick a low-traffic time window
4. 🚦 Follow phases in order
5. ✅ Check off items as you go
6. 🎉 Celebrate when done!

**Remember:**
- Take your time
- Check each phase before proceeding
- Rollback if issues arise
- Document any problems
- You've got this! 💪

---

**Good luck with the migration! 🚀**
