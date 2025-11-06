# Quick Reference: Cleanup Actions

## 🎯 Priority Actions

### 🔴 CRITICAL - Update Immediately (Breaking Issues)

| Item | Files | Action | Impact |
|------|-------|--------|--------|
| Email sender defaults | `mailerlite.ts`, `newsletter-templates.ts` | Change fallbacks from "St. Cloud Scoop" to use settings | Emails will show wrong branding |
| Event URLs | `newsletter-templates.ts` lines 620-621 | Change `events.stcscoop.com` to use `website_url` setting | Links will break |
| Logo fallbacks | `newsletter-templates.ts` line 167 | Change GitHub logo URL to use `header_image_url` setting | Wrong logo shows |

### 🟡 HIGH PRIORITY - Update Soon (Branding Issues)

| Item | Files | Action | Impact |
|------|-------|--------|--------|
| Feedback page text | `feedback/thank-you/page.tsx`, `feedback/error/page.tsx` | Use `newsletter_name` from settings | Shows wrong branding to users |
| Event page logos | `events/view/page.tsx`, `events/submit/page.tsx` | Use logo from settings | Shows St. Cloud logo |
| Email footer links | `gmail-service.ts` lines 118, 191 | Use `website_url` from settings | Links to wrong website |
| Poll placeholder | `dashboard/polls/page.tsx` line 258 | Make generic | Example shows St. Cloud |

### 🟢 MEDIUM PRIORITY - Update When Convenient

| Item | Files | Action | Impact |
|------|-------|--------|--------|
| User-Agent headers | `github-storage.ts`, `vrbo-image-processor.ts` | Change to generic name | Shows in server logs only |
| Settings form defaults | `dashboard/[slug]/settings/page.tsx` line 1130 | Change default to empty or generic | Form pre-fills with St. Cloud |
| Test endpoints | Various debug/test routes | Update or delete | Debug endpoints only |

### 🤔 DECISION REQUIRED

| Feature | Status | Recommendation | Action |
|---------|--------|----------------|--------|
| **Wordle** | Active cron job | Remove for AI newsletters | Delete cron, scraper, UI components |
| **Local Events** | Active feature | Keep but rebrand for AI events | Update URLs, rebrand text |
| **Road Work** | Disabled | Remove completely | Delete section, keep DB schema for multi-tenant |

---

## 🗑️ Safe to Delete Now

### Files/Code
- ✅ `*.backup` files (all backup files)
- ✅ Road Work section generator (already disabled)
- ✅ `src/app/api/debug/test-visitstcloud/route.ts` (St. Cloud specific)
- ✅ St. Cloud-specific scraping functions (if Road Work removed)

### Documentation
- ✅ `CLAUDE.md.backup`
- ✅ `SESSION_NOTES.md` (archive or delete)
- ✅ `SESSION_PROGRESS.md` (archive or delete)
- ✅ Other `.backup` files

---

## 📝 Must Update

### Code Files
- `src/lib/newsletter-templates.ts` - Multiple St. Cloud references
- `src/lib/mailerlite.ts` - Email defaults
- `src/lib/gmail-service.ts` - Email templates
- `src/app/events/*` - Event pages
- `src/app/feedback/*` - Feedback pages

### Documentation
- `README.md` - Update to reflect AI Pros Newsletter

---

## 🔵 Keep As-Is (For Now)

- Database schemas (multi-tenant support)
- Road Work scraping utilities (if keeping for other newsletters)
- Code comments (informational only)
- Migration guides (historical reference)

---

## 📊 Statistics

- **Total St. Cloud References**: ~109
- **Total Road Work References**: ~226
- **Total Wordle References**: ~120
- **Total Local Events References**: ~36

**Estimated Cleanup Time:**
- Critical updates: 2-3 hours
- High priority: 1-2 hours
- Medium priority: 1 hour
- Feature decisions: 30 minutes
- Documentation: 1 hour

**Total**: ~5-7 hours of work

---

## 🚀 Quick Start

1. **Start with critical updates** (email defaults, URLs)
2. **Make feature decisions** (Wordle, Events, Road Work)
3. **Delete unused code** (after decisions made)
4. **Update documentation** (README, guides)
5. **Test thoroughly** (verify no breaking changes)

---

*See CLEANUP_RECOMMENDATIONS.md for detailed analysis.*


