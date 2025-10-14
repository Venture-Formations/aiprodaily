# Testing Checklist - Accounting AI Newsletter Dashboard

**Server Running:** ✅ http://localhost:3001
**Date:** 2025-10-13
**Build Status:** Clean compilation, no errors

---

## 🎯 Core Functionality Tests

### 1. Main Dashboard Page
**URL:** http://localhost:3001/dashboard

**Test Steps:**
- [ ] Page loads without errors
- [ ] Navigation header shows "Accounting AI Daily" (not "St. Cloud Scoop")
- [ ] Quick stats cards display (Sent, In Review, etc.)
- [ ] Recent campaigns section visible
- [ ] Quick action cards present (Create Campaign, Analytics, Settings)

**Expected:**
- Clean page load
- No console errors
- Proper branding throughout

---

### 2. Database Management Hub
**URL:** http://localhost:3001/dashboard/databases

**Test Steps:**
- [ ] Page loads without errors
- [ ] Database cards display with correct names:
  - [ ] AI Applications
  - [ ] Prompt Ideas
  - [ ] Images
  - [ ] RSS Sources
  - [ ] Advertisements
- [ ] Count numbers display (should show 10 for AI Apps and Prompts if sample data loaded)
- [ ] Each card links to correct database page

**Expected:**
- 5 database cards total
- NO cards for Events, Dining, or VRBO (St. Cloud sections removed)
- All counts should be accurate

---

### 3. AI Applications Database Page ⭐ NEW
**URL:** http://localhost:3001/dashboard/databases/ai-apps

**Test Steps:**

#### Basic Load
- [ ] Page loads without errors
- [ ] Table displays with applications list
- [ ] "Add Application" button visible in top-right

#### View Sample Data
- [ ] 10 sample applications display (if database loaded correctly)
- [ ] Each row shows: App Name, Description, Category, Pricing, Status
- [ ] Logo images display (if URLs provided)
- [ ] Edit and Delete buttons visible on each row

#### Filter Functionality
- [ ] Category dropdown shows all categories
- [ ] Changing filter updates the displayed applications
- [ ] "Showing X of Y applications" text updates correctly

#### Stats Dashboard (Bottom)
- [ ] Total Applications count accurate
- [ ] Active count shows active apps only
- [ ] Featured count shows featured apps only
- [ ] Categories count shows unique categories

#### Add New Application
- [ ] Click "Add Application" button
- [ ] Form opens with all fields:
  - [ ] App Name (required)
  - [ ] Tagline (optional, 80 char max)
  - [ ] Description (required, 200 char max)
  - [ ] Category dropdown
  - [ ] Pricing dropdown
  - [ ] App URL (required)
  - [ ] Logo URL (optional)
  - [ ] Active checkbox
  - [ ] Featured checkbox
- [ ] Try submitting empty form - should show validation error
- [ ] Fill in required fields and submit
- [ ] New application appears in table
- [ ] Form closes after successful submission

#### Edit Existing Application
- [ ] Click "Edit" button on any application
- [ ] Row switches to inline edit mode
- [ ] All fields become editable
- [ ] Make changes and click "Save"
- [ ] Changes persist in table
- [ ] Click "Cancel" - changes are discarded

#### Delete Application
- [ ] Click "Delete" button on any application
- [ ] Confirmation dialog appears
- [ ] Confirm deletion
- [ ] Application removed from table
- [ ] Stats update accordingly

**Known Limitations:**
- Prompt Ideas page not yet created (will show 404)
- Newsletter preview not yet updated for new layout

---

### 4. Campaigns Page
**URL:** http://localhost:3001/dashboard/campaigns

**Test Steps:**
- [ ] Page loads without errors
- [ ] Campaign list displays (if campaigns exist)
- [ ] "Create New Campaign" button visible
- [ ] Status badges display correctly
- [ ] Can click into campaign detail view

**Expected:**
- Standard St. Cloud Scoop campaign functionality
- No errors or missing features

---

### 5. Settings Page
**URL:** http://localhost:3001/dashboard/settings

**Test Steps:**
- [ ] Page loads without errors
- [ ] RSS feed settings visible
- [ ] Email settings visible
- [ ] AI prompt settings visible
- [ ] All tabs accessible

**Expected:**
- Standard settings page functionality
- May still reference St. Cloud Scoop in some places (OK for now)

---

### 6. Images Database Page
**URL:** http://localhost:3001/dashboard/databases/images

**Test Steps:**
- [ ] Page loads without errors
- [ ] Image grid displays
- [ ] Upload functionality works
- [ ] Filter/search works

**Expected:**
- Standard St. Cloud Scoop images functionality
- Fully reusable for AI newsletter

---

### 7. Advertisements Page
**URL:** http://localhost:3001/dashboard/databases/ads

**Test Steps:**
- [ ] Page loads without errors
- [ ] Ads list displays
- [ ] Add/edit/delete functionality works
- [ ] Status management works

**Expected:**
- Standard advertisement functionality
- Fully reusable for AI newsletter

---

## ❌ Expected 404 Pages (Not Yet Implemented)

These pages should show 404 errors (this is expected):
- http://localhost:3001/dashboard/databases/prompt-ideas (Next to build)
- http://localhost:3001/dashboard/databases/events (Intentionally removed)
- http://localhost:3001/dashboard/databases/dining (Intentionally removed)
- http://localhost:3001/dashboard/databases/vrbo (Intentionally removed)

---

## 🐛 Known Issues & Limitations

### Current Limitations:
1. **Prompt Ideas page not created** - Will be next task
2. **Newsletter preview not updated** - Still uses St. Cloud 7-section layout
3. **Campaign detail page** - Still has Events/Dining/VRBO sections (will update later)
4. **RSS sources** - Still configured for St. Cloud local news (will reconfigure later)

### Expected Behavior:
- Main dashboard works perfectly
- Database hub shows correct 5 databases
- AI Apps page fully functional
- All other pages inherited from St. Cloud Scoop work as-is

---

## 🔍 Console Error Checks

**Open Browser DevTools Console (F12)**

### Check for errors in:
1. **Main Dashboard:** Should be clean, no errors
2. **Database Hub:** May show errors for missing data (OK)
3. **AI Apps Page:** Should be clean except API errors if database empty
4. **Prompt Ideas Page:** Will show 404 (expected)

### Common Warnings (OK to ignore):
- Missing newsletter_id context warnings
- Supabase RLS policy warnings (OK in development)
- Image loading errors (if URLs are invalid)

---

## ✅ Success Criteria

**Minimum Viable:**
- [ ] Dashboard loads with "Accounting AI Daily" branding
- [ ] Database hub shows 5 correct databases
- [ ] AI Apps page loads without crashes
- [ ] Can add/edit/delete AI applications
- [ ] No critical TypeScript or build errors

**Stretch Goals:**
- [ ] Sample data displays correctly (10 apps, 10 prompts)
- [ ] All CRUD operations work smoothly
- [ ] Filters and stats work correctly
- [ ] No console errors on any page

---

## 📝 Bug Report Template

If you find issues, note them here:

```
**Page:**
**Issue:**
**Steps to Reproduce:**
1.
2.
3.
**Expected:**
**Actual:**
**Console Errors:**
```

---

## 🚀 Next Steps After Testing

### If Everything Works:
1. ✅ Mark testing complete
2. 🔨 Build Prompt Ideas page (similar to AI Apps)
3. 🔨 Update newsletter preview for 6-section layout
4. 🔨 Test complete newsletter generation

### If Issues Found:
1. 🐛 Document all bugs
2. 🔧 Fix critical issues
3. ⚠️ Note non-critical issues for later
4. ✅ Re-test after fixes

---

**Testing Started:** 2025-10-13
**Server:** http://localhost:3001
**Status:** ✅ Ready for manual testing
