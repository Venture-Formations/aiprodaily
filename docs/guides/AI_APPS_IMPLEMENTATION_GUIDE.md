# AI Applications Database - Implementation Complete ✅

## Summary of Changes

All major features have been implemented for the AI Applications database upgrade:

1. ✅ **Database Schema** - Changed `pricing` to `tool_type` with Client/Firm dropdown
2. ✅ **Categories Updated** - Payroll, HR, Accounting System, Finance, Productivity, Client Management, Banking
3. ✅ **CSV Upload** - Added upload button with "Home Page" → `app_url` mapping
4. ✅ **App Selection** - Automatic selection on campaign creation with category rotation
5. ✅ **Settings API** - API endpoint for managing category counts

---

## 🚀 Next Steps - Manual Tasks Required

### Step 1: Run Database Migration

Open Supabase SQL Editor and run:
```bash
database_ai_apps_migration.sql
```

This will:
- Add `tool_type` column (replacing `pricing`)
- Add `category_priority` column
- Insert default AI app settings into `app_settings` table

### Step 2: Add AI Apps Tab to Settings Page

**File:** `src/app/dashboard/[slug]/settings/page.tsx`

**A) Update tab navigation (line ~46):**
```typescript
{[
  { id: 'system', name: 'System Status' },
  { id: 'business', name: 'Business Settings' },
  { id: 'newsletter', name: 'Newsletter' },
  { id: 'email', name: 'Email' },
  { id: 'slack', name: 'Slack' },
  { id: 'ai-prompts', name: 'AI Prompts' },
  { id: 'ai-apps', name: 'AI Apps' },  // ← ADD THIS LINE
  { id: 'rss', name: 'RSS Feeds' },
  { id: 'notifications', name: 'Notifications' },
  { id: 'users', name: 'Users' }
].map((tab) => (
```

**B) Update tab content (line ~74):**
```typescript
{activeTab === 'system' && <SystemStatus />}
{activeTab === 'business' && <BusinessSettings />}
{activeTab === 'newsletter' && <NewsletterSettings />}
{activeTab === 'email' && <EmailSettings />}
{activeTab === 'slack' && <SlackSettings />}
{activeTab === 'ai-prompts' && <AIPromptsSettings />}
{activeTab === 'ai-apps' && <AIAppsSettings />}  // ← ADD THIS LINE
{activeTab === 'rss' && <RSSFeeds />}
{activeTab === 'notifications' && <Notifications />}
{activeTab === 'users' && <Users />}
```

**C) Add component at the end of the file (before closing):**
```typescript
// Add after the AIPromptsSettings function (around line 2100)
function AIAppsSettings() {
  const [settings, setSettings] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/ai-apps')
      const data = await response.json()

      // Convert to flat object for easier editing
      const flatSettings: any = {}
      Object.entries(data.settings).forEach(([key, val]: [string, any]) => {
        flatSettings[key] = parseInt(val.value) || 0
      })
      setSettings(flatSettings)
    } catch (error) {
      console.error('Failed to fetch AI app settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage('')

      const response = await fetch('/api/settings/ai-apps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      })

      if (response.ok) {
        setMessage('✓ Settings saved successfully')
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage('✗ Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      setMessage('✗ Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (key: string, value: number) => {
    setSettings({ ...settings, [key]: value })
  }

  if (loading) {
    return <div className="text-gray-600">Loading...</div>
  }

  const categories = [
    { key: 'ai_apps_payroll_count', label: 'Payroll', color: 'bg-blue-100 text-blue-800' },
    { key: 'ai_apps_hr_count', label: 'HR', color: 'bg-green-100 text-green-800' },
    { key: 'ai_apps_accounting_count', label: 'Accounting System', color: 'bg-purple-100 text-purple-800' },
    { key: 'ai_apps_finance_count', label: 'Finance (Filler)', color: 'bg-gray-100 text-gray-800' },
    { key: 'ai_apps_productivity_count', label: 'Productivity (Filler)', color: 'bg-gray-100 text-gray-800' },
    { key: 'ai_apps_client_mgmt_count', label: 'Client Management (Filler)', color: 'bg-gray-100 text-gray-800' },
    { key: 'ai_apps_banking_count', label: 'Banking', color: 'bg-yellow-100 text-yellow-800' }
  ]

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">AI Applications Selection Settings</h2>

      <p className="text-gray-600 mb-6">
        Configure how many apps from each category are selected for each newsletter campaign.
        Set count to 0 for "filler" categories (used to fill remaining slots).
      </p>

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.startsWith('✓') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message}
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Total Apps Per Newsletter
        </label>
        <input
          type="number"
          min="1"
          max="20"
          value={settings.ai_apps_per_newsletter || 6}
          onChange={(e) => handleChange('ai_apps_per_newsletter', parseInt(e.target.value) || 6)}
          className="w-32 border border-gray-300 rounded px-3 py-2"
        />
        <p className="text-sm text-gray-500 mt-1">Default: 6 apps</p>
      </div>

      <div className="space-y-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Category Counts</h3>
        {categories.map(({ key, label, color }) => (
          <div key={key} className="flex items-center justify-between">
            <div className="flex items-center">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${color} mr-3`}>
                {label}
              </span>
              <p className="text-sm text-gray-600">
                {settings[key] === 0 ? 'Filler category' : `${settings[key]} per newsletter`}
              </p>
            </div>
            <input
              type="number"
              min="0"
              max="10"
              value={settings[key] || 0}
              onChange={(e) => handleChange(key, parseInt(e.target.value) || 0)}
              className="w-20 border border-gray-300 rounded px-3 py-2"
            />
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Apps are selected automatically when creating a new campaign</li>
          <li>• Categories with count > 0 are "must-have" (always included)</li>
          <li>• Categories with count = 0 are "fillers" (used to reach total apps)</li>
          <li>• Apps rotate like prompts: each app is used before cycling through again</li>
          <li>• Within each category, unused apps are prioritized</li>
        </ul>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}
```

### Step 3: Update Existing Apps (Optional)

If you have existing apps in the database with old categories, you can update them:

1. Go to **Databases → AI Applications**
2. Edit each app and select new category + tool type
3. Or run SQL update queries to batch convert

---

## 📋 How To Use

### Adding Apps via CSV

1. Go to **Databases → AI Applications**
2. Click "📤 Upload CSV" button
3. CSV format:
   ```
   Tool Name,Category,Tool Type,Home Page,Description,Tagline
   QuickBooks AI,Accounting System,Firm,https://quickbooks.com,AI-powered accounting assistant,Automate your bookkeeping
   ```

**Column Mappings:**
- `Tool Name` → app_name
- `Category` → category (must match predefined list)
- `Tool Type` → tool_type (Client or Firm)
- `Home Page` → app_url
- `Description` → description
- `Tagline` → tagline (optional)

### Configuring Category Counts

1. Go to **Settings → AI Apps** tab
2. Set "Total Apps Per Newsletter" (default: 6)
3. Set counts for each category:
   - **Payroll:** 2 (required)
   - **Accounting System:** 2 (required)
   - **HR:** 1 (required)
   - **Banking:** 1 (required)
   - **Finance, Productivity, Client Management:** 0 (fillers)
4. Click "Save Settings"

### App Selection Logic

When a new campaign is created:
1. System selects apps based on category counts
2. Prioritizes unused apps within each category
3. Rotates through all apps before repeating
4. Fills remaining slots with filler categories
5. Updates `last_used_date` and `times_used` for tracking

---

## 📁 Files Modified/Created

### New Files:
```
database_ai_apps_migration.sql                      # Database migration script
src/lib/app-selector.ts                             # App selection logic
src/app/api/ai-apps/upload/route.ts                 # CSV upload endpoint
src/app/api/settings/ai-apps/route.ts               # Settings API
AI_APPS_IMPLEMENTATION_GUIDE.md                     # This file
```

### Modified Files:
```
src/types/database.ts                               # Added ToolType, AIAppCategory types
src/app/dashboard/[slug]/databases/ai-apps/page.tsx # Updated UI (tool_type, CSV upload)
src/app/api/campaigns/route.ts                      # Integrated AppSelector
```

---

## ✅ Testing Checklist

- [ ] Run database migration in Supabase
- [ ] Add AI Apps tab to settings page
- [ ] Upload sample CSV file
- [ ] Configure category counts in Settings
- [ ] Create new campaign and verify apps are selected
- [ ] Check that apps rotate properly across multiple campaigns
- [ ] Verify UI shows new categories and tool types

---

## 🐛 Troubleshooting

**CSV Upload Errors:**
- Check column names match exactly (case-sensitive)
- Ensure "Home Page" column exists (not "URL")
- Category must be one of: Payroll, HR, Accounting System, Finance, Productivity, Client Management, Banking
- Tool Type must be either "Client" or "Firm"

**No Apps Selected on Campaign Creation:**
- Verify `app_settings` table has ai_apps_* entries
- Check that apps have `is_active = true`
- Run: `SELECT * FROM app_settings WHERE key LIKE 'ai_apps_%'`

**Settings Not Saving:**
- Check browser console for API errors
- Verify `/api/settings/ai-apps` endpoint is accessible
- Ensure database connection is working

---

**Implementation Status:** 95% Complete ✅
**Remaining:** Manual addition of AI Apps tab to settings page (Step 2 above)
