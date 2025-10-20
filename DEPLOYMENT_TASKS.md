# Post-Deployment Tasks
**Created:** 2025-10-20
**Last Updated:** 2025-10-20
**Status:** Waiting for Vercel Platform Recovery

## 🚀 Immediate Tasks (Once Deployed)

### 1. Initialize Article Lookback Hours Settings
**Endpoint:** `https://your-domain.vercel.app/api/debug/add-lookback-columns`

**Purpose:** Creates database settings for article lookback feature

**Expected Result:**
```json
{
  "success": true,
  "message": "Created 2 settings: primary_article_lookback_hours, secondary_article_lookback_hours",
  "results": {
    "primary_exists": false,
    "secondary_exists": false,
    "created": ["primary_article_lookback_hours", "secondary_article_lookback_hours"]
  }
}
```

**Defaults Created:**
- `primary_article_lookback_hours`: 72 (3 days)
- `secondary_article_lookback_hours`: 36 (1.5 days)

**Verify:** Go to Settings > Email > Article Lookback Hours - should show 72/36

---

### 2. Initialize Subject Line AI Prompt
**Endpoint:** `https://your-domain.vercel.app/api/debug/init-subject-line-prompt`

**Purpose:** Creates editable subject line prompt in database

**Expected Result:**
```json
{
  "success": true,
  "message": "Subject line prompt initialized successfully",
  "action": "created"
}
```

**Verify:** Go to Settings > AI Prompts > Newsletter category - should see "Subject Line" prompt

---

    "primary_title_created": true,
    "primary_body_created": true,
    "secondary_title_created": true,
    "secondary_body_created": true,
    "errors": []
  }
}
```

**Defaults Created:**
- `ai_prompt_primary_article_title`: Generates engaging headlines (6-12 words)
- `ai_prompt_primary_article_body`: Generates newsletter content (40-75 words)
- `ai_prompt_secondary_article_title`: Generates engaging headlines (6-12 words)
- `ai_prompt_secondary_article_body`: Generates newsletter content (75-150 words)

**Verify:** Go to Settings > AI Prompts - should see new prompts (after UI reorganization)

**Note:** Article generation now uses a two-step process:
1. Generate title first using title prompt
2. Generate body using body prompt with the generated title
3. Falls back to legacy single-step articleWriter if needed

---

### 4. Test Criteria Weights Independence
**Steps:**
1. Go to Settings > AI Prompts
2. Find Primary Evaluation Criteria section
3. Edit weight for Criteria 1 (e.g., change to 2.5)
4. Save
5. Scroll to Secondary Evaluation Criteria section
6. Verify Criteria 1 weight is still 1.0 (not 2.5)

**Expected:** Primary and Secondary weights are independent

---

## 📋 Feature Verification Checklist

### Article Lookback Hours Feature
- [ ] Database settings initialized (task #1 above)
- [ ] Settings page shows controls for Primary/Secondary lookback hours
- [ ] Can save changes successfully
- [ ] Next RSS processing uses lookback window for article selection
- [ ] Articles from past 72h (primary) / 36h (secondary) are eligible
- [ ] Already-sent articles (final_position != null) are excluded

### Criteria Weights Fix
- [ ] Changing primary criteria weights doesn't affect secondary
- [ ] Changing secondary criteria weights doesn't affect primary
- [ ] Each set saves independently to correct database keys:
  - Primary: `criteria_X_weight`
  - Secondary: `secondary_criteria_X_weight`

### Subject Line AI Prompt
- [ ] Subject Line prompt initialized (task #2 above)
- [ ] Appears in Settings > AI Prompts > Newsletter category
- [ ] Can edit the prompt text
- [ ] Can reset to default
- [ ] Can save as custom default
- [ ] Subject line generation uses database template
- [ ] `{{articles}}` placeholder gets replaced with article list

### Article Title/Body Prompts
- [ ] Title/Body prompts initialized (task #3 above)
- [ ] Four new prompts created in database
- [ ] Next RSS processing uses two-step generation (title → body)
- [ ] Primary articles generate with 40-75 word bodies
- [ ] Secondary articles generate with 75-150 word bodies
- [ ] Falls back to legacy articleWriter if title/body prompts missing
- [ ] Generated titles use {{title}} placeholder correctly
- [ ] Generated bodies use {{headline}} placeholder correctly
- [ ] Can customize title and body prompts independently

---

## 🔍 Testing Recommendations

### Test Article Lookback Feature
1. Check current campaign articles before RSS processing
2. Note the created_at timestamps
3. Run manual RSS processing
4. Verify articles selected from full lookback window (not just today)
5. Confirm highest-rated articles were chosen regardless of age

### Test Subject Line Customization
1. Go to Settings > AI Prompts > Newsletter
2. Find Subject Line prompt
3. Modify the prompt (e.g., change character limit from 40 to 35)
4. Save changes
5. Generate a new subject line for a campaign
6. Verify the change took effect

### Test Article Title/Body Generation
1. Run RSS processing or manually create articles
2. Check Vercel function logs for "Generating primary/secondary article title..."
3. Verify logs show "Generated title:" followed by the headline
4. Verify logs show "Generated body: X words"
5. Check that generated articles have engaging, non-generic titles
6. Confirm article bodies are within word count limits (40-75 or 75-150)
7. Test fallback: Temporarily rename a prompt in database, verify fallback works

---

## 📝 Git Commits Deployed

**Commit 1:** `baba3a3` - Article lookback hours feature (backend/frontend)
**Commit 2:** `5851b05` - Trigger Vercel redeploy (empty commit for platform error)
**Commit 3:** `2c7bc80` - Criteria weights independence fix
**Commit 4:** `130453a` - Subject Line AI Prompt feature
**Commit 5:** `f647ab3` - Article Title/Body Split Feature (two-step generation)


---

## ⚠️ Known Issues / Notes

1. **Vercel Platform Error:** Original deployment failed with "An unexpected error happened when running this build." This is a Vercel infrastructure issue, not a code problem. Local builds succeed.

2. **First-Time RSS Processing:** After initializing lookback hours, the first RSS processing will use the new logic. Expect different article selections compared to previous runs.

3. **Existing Criteria Weights:** If you've previously set criteria weights, they apply to BOTH primary and secondary. After this update:
   - Existing weights remain as primary weights
   - Secondary weights start at 1.0 (default)
   - You can now customize them independently
4. **UI Reorganization Completed:** The Settings > AI Prompts page will be reorganized in a future update to:
   - Settings > AI Prompts page reorganized with new section names
   - "Primary Article Prompts" section contains Evaluation Criteria and will show Title/Body prompts
   - "Secondary Article Prompts" section contains Evaluation Criteria and will show Title/Body prompts
   - New title/body prompts will appear in their respective sections after initialization

---

## 🎯 Success Criteria

**All features working when:**
1. ✅ Article lookback settings visible and editable
2. ✅ RSS processing selects from full lookback window
3. ✅ Primary/Secondary criteria weights are independent
4. ✅ Subject Line prompt editable in AI Prompts page
5. ✅ Subject line generation uses custom template
6. ✅ Article Title/Body prompts initialized and generating separately
7. ✅ Two-step article generation working with proper fallback

---

## 📞 Support

If any endpoint returns an error or features don't work as expected:
1. Check Vercel function logs for error details
2. Verify database connectivity
3. Ensure all migrations ran successfully
4. Contact support with specific error messages

---

**Last Updated:** 2025-10-20
**Waiting For:** Vercel platform recovery
