# Local Events Feature Specification
## St. Cloud Scoop Newsletter System

**Version**: 1.0  
**Date**: January 2025  
**Feature**: Local Events Integration

---

## 1. Feature Overview

### Purpose
Add a "Local Events" section to the newsletter that pulls events from the Visit St. Cloud API, stores them in a database, and allows editorial control over featured events and selection for each day.

### Integration Points
- Existing newsletter campaign workflow
- Admin dashboard article management
- Email template generation
- MailerLite campaign creation

---

## 2. Data Requirements

### 2.1 New Database Table: `events`

```sql
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  venue VARCHAR(255),
  address TEXT,
  url VARCHAR(500),
  image_url VARCHAR(500),
  featured BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_featured ON events(featured);
CREATE INDEX idx_events_active ON events(active);
```

### 2.2 New Database Table: `campaign_events`

```sql
CREATE TABLE campaign_events (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES newsletter_campaigns(id),
  event_id INTEGER REFERENCES events(id),
  event_date DATE NOT NULL,
  is_selected BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  display_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_campaign_events_campaign ON campaign_events(campaign_id);
CREATE INDEX idx_campaign_events_date ON campaign_events(event_date);
```

### 2.3 New Database Table: `newsletter_sections`

```sql
CREATE TABLE newsletter_sections (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  display_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default sections
INSERT INTO newsletter_sections (name, display_order) VALUES 
('The Local Scoop', 1),
('Local Events', 2);
```

---

## 3. API Integration

### 3.1 Visit St. Cloud Events API

**Endpoint**: `https://www.visitstcloud.com/wp-json/tribe/events/v1/events`

**Processing Requirements**:
- Fetch events for next 7 days
- Store in `events` table with deduplication by `external_id`
- Update existing events if data changes
- Mark events as inactive if no longer in API response

### 3.2 New API Endpoints

```javascript
// Fetch and sync events from Visit St. Cloud API
POST /api/events/sync

// Get events for a specific date range
GET /api/events?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD

// Update event selection for campaign
PATCH /api/campaigns/[id]/events
{
  "event_date": "2025-01-20",
  "selected_events": [1, 3, 5, 7],
  "featured_event": 3
}

// Update newsletter section order
PATCH /api/settings/sections
{
  "sections": [
    {"name": "The Local Scoop", "order": 1},
    {"name": "Local Events", "order": 2}
  ]
}

// Toggle event featured status in database
PATCH /api/events/[id]/featured
{
  "featured": true
}
```

---

## 4. User Interface Changes

### 4.1 Campaign Detail Page Modifications

#### Articles Section Updates
- **Title Change**: "Articles" → "The Local Scoop"
- **Collapsible Interface**: 
  - Minimize arrow to collapse section
  - When minimized: Show title, article count, and "5/5 selected"
  - When expanded: Show full article management interface

#### New Local Events Section
- **Position**: Below "The Local Scoop" section
- **Layout**: Three-column layout for consecutive days
- **Column Headers**: 
  - Day 1: Date 12 hours after campaign creation
  - Day 2: Following day
  - Day 3: Day after that
- **Date Format**: "Friday, Sept. 19th"

#### Event Management Per Day
- **Selection Limit**: Maximum 8 events per day
- **Selection Counter**: "6/8 selected" display
- **Featured Checkbox**: One featured event per day
- **Event Ordering**:
  1. Featured event (if selected) at top
  2. Remaining selected events by start time
  3. Unselected events below selected ones
- **Initial Selection**: Random selection of 8 events per day
- **Featured Logic**:
  - If event.featured = TRUE in database, checkbox is checked and disabled
  - If multiple featured events exist for same day, all are checked/disabled
  - User can feature non-database-featured events (one per day)

### 4.2 Settings Page - Email Section

#### New Section Order Management
- **Location**: Settings → Email → Section Order
- **Interface**: Drag-and-drop or up/down arrows
- **Sections Listed**:
  - The Local Scoop
  - Local Events
  - (Future sections can be added)
- **Impact**: Order affects both campaign page display and email HTML generation

---

## 5. Email Template Integration

### 5.1 EventsHTML.txt Template

Create `EventsHTML.txt` file with template structure:
```html
<tr class='row'>
 <td class='column' style='padding:8px; vertical-align: top;'>
 <table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 8px; background: #fff; font-family: Arial, sans-serif; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15);'>
 <tr><td style='padding: 12px 12px 4px; font-size: 20px; font-weight: bold; color: #1877F2;'>Local Events - {DATE}</td></tr>
 {EVENTS_CONTENT}
 </table>
 </td>
</tr>
```

### 5.2 Email Generation Logic

#### Event HTML Structure per Day
```html
<tr><td style='padding: 0 12px 8px;'>
  <div style='border-left: 3px solid #1877F2; padding-left: 8px; margin-bottom: 8px;'>
    <strong style='color: #1877F2;'>{EVENT_TIME}</strong> - {EVENT_TITLE}
    {FEATURED_INDICATOR}
    <br><span style='font-size: 14px; color: #666;'>{VENUE}</span>
  </div>
</td></tr>
```

#### Featured Event Styling
- **Featured Badge**: ⭐ or "FEATURED" text
- **Enhanced Styling**: Bold text, different background, or border

---

## 6. Technical Implementation

### 6.1 Event Sync Cron Job

```javascript
// Add to existing cron jobs
// Schedule: Every 6 hours
// Path: /api/cron/sync-events

async function syncEvents() {
  // Fetch from Visit St. Cloud API
  // Update events table
  // Handle deduplication
  // Mark inactive events
}
```

### 6.2 Campaign Creation Updates

```javascript
// In prepare-newsletter cron job
// After article processing, add event processing

async function processEventsForCampaign(campaignId) {
  const campaignDate = getCampaignDate(campaignId);
  const eventDates = [
    addHours(campaignDate, 12),  // 12 hours after creation
    addDays(addHours(campaignDate, 12), 1),  // Next day
    addDays(addHours(campaignDate, 12), 2)   // Day after that
  ];

  for (const eventDate of eventDates) {
    const events = await getEventsForDate(eventDate);
    const selectedEvents = selectRandomEvents(events, 8);
    await saveCampaignEvents(campaignId, eventDate, selectedEvents);
  }
}
```

### 6.3 Preview Generation Updates

```javascript
// Update newsletter preview generation
function generateNewsletterPreview(campaignId) {
  const sections = getOrderedSections();
  let html = '';

  for (const section of sections) {
    switch(section.name) {
      case 'The Local Scoop':
        html += generateArticlesHTML(campaignId);
        break;
      case 'Local Events':
        html += generateEventsHTML(campaignId);
        break;
    }
  }

  return html;
}
```

---

## 7. UI Component Specifications

### 7.1 Collapsible Section Component

```jsx
function CollapsibleSection({ title, children, defaultExpanded = true }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <div 
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        <ChevronDownIcon 
          className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </div>
      
      {expanded ? children : (
        <div className="mt-2 text-sm text-gray-500">
          {/* Summary content when collapsed */}
        </div>
      )}
    </div>
  );
}
```

### 7.2 Event Selection Component

```jsx
function EventDay({ date, events, selectedEvents, featuredEvent, onUpdate }) {
  const handleEventToggle = (eventId) => {
    // Toggle selection logic
    // Maintain 8-event limit
    // Update display order
  };

  const handleFeatureToggle = (eventId) => {
    // Feature/unfeature logic
    // Only one featured per day
    // Respect database-featured events
  };

  return (
    <div className="border rounded-lg p-4">
      <h4 className="font-semibold mb-2">{formatDate(date)}</h4>
      <div className="text-sm text-gray-500 mb-3">
        {selectedEvents.length}/8 selected
      </div>
      
      {events.map(event => (
        <EventItem 
          key={event.id}
          event={event}
          isSelected={selectedEvents.includes(event.id)}
          isFeatured={featuredEvent === event.id}
          onToggleSelect={() => handleEventToggle(event.id)}
          onToggleFeature={() => handleFeatureToggle(event.id)}
        />
      ))}
    </div>
  );
}
```

---

## 8. Settings Implementation

### 8.1 Section Order Management

```jsx
function SectionOrderSettings() {
  const [sections, setSections] = useState([]);

  const handleReorder = (dragIndex, hoverIndex) => {
    // Drag and drop reordering logic
    // Update database
    // Refresh UI
  };

  return (
    <div className="space-y-4">
      <h3>Section Order</h3>
      <p className="text-sm text-gray-600">
        Drag to reorder sections. This affects both the campaign page and email layout.
      </p>
      
      <DragDropContext onDragEnd={handleReorder}>
        <Droppable droppableId="sections">
          {sections.map((section, index) => (
            <Draggable key={section.id} draggableId={section.id} index={index}>
              <div className="flex items-center p-3 bg-gray-50 rounded border">
                <GripVertical className="h-4 w-4 text-gray-400 mr-3" />
                <span>{section.name}</span>
              </div>
            </Draggable>
          ))}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
```

---

## 9. Implementation Checklist

### Phase 1: Database & API
- [ ] Create new database tables
- [ ] Implement events sync API endpoint
- [ ] Create event management API endpoints
- [ ] Add events sync cron job

### Phase 2: UI Components
- [ ] Update campaign page with collapsible sections
- [ ] Implement Local Events three-column layout
- [ ] Create event selection/featuring interface
- [ ] Add section order management to settings

### Phase 3: Email Integration
- [ ] Create EventsHTML.txt template
- [ ] Update newsletter preview generation
- [ ] Modify MailerLite campaign creation
- [ ] Implement section ordering in email

### Phase 4: Testing & Refinement
- [ ] Test event API integration
- [ ] Verify email template rendering
- [ ] Test section reordering functionality
- [ ] Validate featured event logic

---

## 12. Database Management Feature

### 12.1 New Main Navigation Page: "Databases"

**Location**: Between "Analytics" and "Settings" in main navigation

**Purpose**: Provide administrative interface for managing all database tables used by the newsletter system

#### Page Layout
- **Header**: "Database Management"
- **Description**: "Manage and edit database records for newsletter content"
- **Database List**: Cards showing each database with entry counts

#### Database Cards
```jsx
function DatabaseCard({ name, tableName, count, description }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <h3 className="text-lg font-semibold mb-2">{name}</h3>
      <p className="text-gray-600 text-sm mb-4">{description}</p>
      <div className="flex justify-between items-center">
        <span className="text-2xl font-bold text-blue-600">{count}</span>
        <span className="text-sm text-gray-500">entries</span>
      </div>
      <Link 
        href={`/admin/databases/${tableName}`}
        className="mt-4 block w-full text-center bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
      >
        Manage {name}
      </Link>
    </div>
  );
}
```

#### Initial Database List
- **Local Events** (table: `events`)
  - Description: "Events from Visit St. Cloud API and manual entries"
  - Count: Dynamic count from events table

### 12.2 Event Database Management Page

**URL**: `/admin/databases/events`

#### Page Features
- **Breadcrumb**: Databases > Local Events
- **Header**: "Local Events Database" with entry count
- **Add Event Button**: Prominent button to add new event
- **Data Table**: Advanced table with full CRUD operations

#### Table Functionality
```jsx
function EventsTable() {
  const [events, setEvents] = useState([]);
  const [sortColumn, setSortColumn] = useState('start_date');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filters, setFilters] = useState({});
  const [visibleColumns, setVisibleColumns] = useState([
    'title', 'start_date', 'venue', 'featured', 'active'
  ]);

  // Table controls
  const columnOptions = [
    { key: 'id', label: 'ID' },
    { key: 'title', label: 'Title' },
    { key: 'description', label: 'Description' },
    { key: 'start_date', label: 'Start Date' },
    { key: 'end_date', label: 'End Date' },
    { key: 'venue', label: 'Venue' },
    { key: 'address', label: 'Address' },
    { key: 'url', label: 'URL' },
    { key: 'featured', label: 'Featured' },
    { key: 'active', label: 'Active' },
    { key: 'created_at', label: 'Created' }
  ];

  return (
    <div className="space-y-4">
      {/* Table Controls */}
      <div className="flex justify-between items-center">
        <div className="flex space-x-4">
          <ColumnSelector 
            options={columnOptions}
            selected={visibleColumns}
            onChange={setVisibleColumns}
          />
          <FilterDropdown 
            columns={columnOptions}
            filters={filters}
            onChange={setFilters}
          />
        </div>
        <AddEventButton />
      </div>

      {/* Data Table */}
      <DataTable 
        data={events}
        columns={visibleColumns}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={(column) => handleSort(column)}
        onEdit={(event) => openEditModal(event)}
        onDelete={(eventId) => handleDelete(eventId)}
      />
    </div>
  );
}
```

#### Column Sorting
- **Sortable Columns**: All columns with appropriate data types
- **Visual Indicators**: Up/down arrows in column headers
- **Multi-column Sort**: Click to cycle through asc/desc/no sort

#### Column Filtering
- **Text Columns**: Search input with partial matching
- **Date Columns**: Date range picker
- **Boolean Columns**: Dropdown with True/False/All options
- **Apply/Clear Filters**: Buttons to apply or reset all filters

#### Column Visibility
- **Column Selector**: Dropdown checklist of all available columns
- **Default Visible**: Title, Start Date, Venue, Featured, Active
- **Save Preferences**: Remember user's column selections

### 12.3 Add/Edit Event Form

#### Add Event Modal/Page
**Trigger**: "Add Event" button on database page
**Layout**: Modal overlay or dedicated page

#### Form Fields
```jsx
function EventForm({ event = null, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    venue: '',
    address: '',
    url: '',
    image_url: '',
    featured: false,
    active: true
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField 
          label="Event Title*"
          type="text"
          value={formData.title}
          onChange={(value) => updateField('title', value)}
          required
        />
        
        <FormField 
          label="Venue"
          type="text"
          value={formData.venue}
          onChange={(value) => updateField('venue', value)}
        />

        <FormField 
          label="Start Date & Time*"
          type="datetime-local"
          value={formData.start_date}
          onChange={(value) => updateField('start_date', value)}
          required
        />

        <FormField 
          label="End Date & Time"
          type="datetime-local"
          value={formData.end_date}
          onChange={(value) => updateField('end_date', value)}
        />

        <FormField 
          label="Event URL"
          type="url"
          value={formData.url}
          onChange={(value) => updateField('url', value)}
        />

        <FormField 
          label="Image URL"
          type="url"
          value={formData.image_url}
          onChange={(value) => updateField('image_url', value)}
        />
      </div>

      <FormField 
        label="Description"
        type="textarea"
        value={formData.description}
        onChange={(value) => updateField('description', value)}
        rows={4}
      />

      <FormField 
        label="Address"
        type="textarea"
        value={formData.address}
        onChange={(value) => updateField('address', value)}
        rows={2}
      />

      <div className="flex space-x-6">
        <FormField 
          label="Featured Event"
          type="checkbox"
          checked={formData.featured}
          onChange={(checked) => updateField('featured', checked)}
        />

        <FormField 
          label="Active"
          type="checkbox"
          checked={formData.active}
          onChange={(checked) => updateField('active', checked)}
        />
      </div>

      <div className="flex justify-end space-x-4">
        <button 
          type="button" 
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button 
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {event ? 'Update Event' : 'Submit Event'}
        </button>
      </div>
    </form>
  );
}
```

#### Form Validation
- **Required Fields**: Title, Start Date
- **Date Logic**: End date must be after start date
- **URL Validation**: Proper URL format for event and image URLs
- **Real-time Validation**: Show errors as user types

#### Success Flow
1. User fills out form
2. Clicks "Submit Event"
3. Event added to database
4. Success message displayed
5. Redirect back to database table
6. New event appears in table

### 12.4 New API Endpoints

```javascript
// Get database statistics
GET /api/admin/databases/stats
Response: {
  events: { count: 156, lastUpdated: "2025-01-20T10:30:00Z" }
}

// Events CRUD operations
GET /api/admin/databases/events?sort=start_date&order=asc&filters={}
POST /api/admin/databases/events
PUT /api/admin/databases/events/[id]
DELETE /api/admin/databases/events/[id]

// Bulk operations
POST /api/admin/databases/events/bulk-delete
POST /api/admin/databases/events/bulk-update
```

### 12.5 Database Navigation Updates

#### Main Navigation Addition
```jsx
// Update main navigation component
const navigationItems = [
  { name: 'Dashboard', href: '/admin/dashboard' },
  { name: 'Analytics', href: '/admin/analytics' },
  { name: 'Databases', href: '/admin/databases' }, // NEW
  { name: 'Settings', href: '/admin/settings' }
];
```

### 12.6 Future Database Expansion

#### Scalable Design
The database management system should be designed to easily accommodate future databases:

- **RSS Sources**: Manage multiple RSS feeds
- **Subscribers**: Newsletter subscriber management
- **Templates**: Email template management
- **Users**: Team member management

#### Database Registration System
```javascript
// Future: Register new databases for management
const registeredDatabases = [
  {
    name: 'Local Events',
    tableName: 'events',
    description: 'Events from Visit St. Cloud API and manual entries',
    fields: eventFields,
    permissions: ['create', 'read', 'update', 'delete']
  }
  // Future databases can be added here
];
```

### Functional Requirements
- [ ] Events successfully sync from Visit St. Cloud API
- [ ] Three-day event layout displays correctly
- [ ] Featured event logic works as specified
- [ ] Section ordering affects both UI and email
- [ ] Email preview matches MailerLite output

### User Experience
- [ ] Intuitive event selection interface
- [ ] Clear visual distinction for featured events
- [ ] Smooth collapsible section interactions
- [ ] Responsive design on mobile devices

### Technical Performance
- [ ] Events sync completes within 30 seconds
- [ ] Campaign page loads in under 3 seconds
- [ ] Email generation time remains under 10 seconds
- [ ] Database queries optimized with proper indexing

---

## 11. Future Enhancements

### Potential Additions
- **Event Categories**: Filter events by type (music, sports, family, etc.)
- **Custom Event Addition**: Manual event entry for non-API events
- **Event Images**: Display event photos in newsletter
- **RSVP Integration**: Link to event registration/tickets
- **Event Reminders**: Follow-up emails for featured events

### Analytics Opportunities
- **Event Click Tracking**: Monitor which events get most engagement
- **Featured Event Performance**: Measure impact of featuring
- **Optimal Event Count**: A/B test different numbers of events per day