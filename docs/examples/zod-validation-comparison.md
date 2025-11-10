# Zod Validation: Before & After Comparison

## Example 1: Invalid UUID

### ❌ Without Zod (Current)
```json
// Request
POST /api/articles/manual
{
  "campaign_id": "invalid-uuid",
  "title": "Test Article",
  "content": "Some content"
}

// Response (generic error, happens later in DB)
{
  "error": "Failed to create manual article",
  "message": "invalid input syntax for type uuid: \"invalid-uuid\""
}
```
**Problem:** Error happens at database level, unclear to API consumer

---

### ✅ With Zod
```json
// Request (same)
POST /api/articles/manual
{
  "campaign_id": "invalid-uuid",
  "title": "Test Article",
  "content": "Some content"
}

// Response (clear, immediate)
{
  "error": "Validation failed",
  "details": [
    {
      "field": "campaign_id",
      "message": "campaign_id must be a valid UUID"
    }
  ]
}
```
**Benefit:** Error caught immediately, clear error message, no DB query wasted

---

## Example 2: Invalid Data Types

### ❌ Without Zod
```json
// Request (rank is string instead of number)
{
  "campaign_id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Test",
  "content": "Content",
  "rank": "five"
}

// Response (no error, stored as string in DB!)
{
  "article": {
    "id": "...",
    "rank": "five"  // ❌ Should be number
  }
}
```
**Problem:** Bad data gets into database, breaks sorting/filtering later

---

### ✅ With Zod
```json
// Request (same)
{
  "campaign_id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Test",
  "content": "Content",
  "rank": "five"
}

// Response (validation fails)
{
  "error": "Validation failed",
  "details": [
    {
      "field": "rank",
      "message": "Expected number, received string"
    }
  ]
}
```
**Benefit:** Type safety enforced at runtime, prevents bad data

---

## Example 3: Invalid URL

### ❌ Without Zod
```json
// Request (invalid URL)
{
  "campaign_id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Test",
  "content": "Content",
  "image_url": "not-a-url"
}

// Response (no error, stored as-is)
{
  "article": {
    "image_url": "not-a-url"  // ❌ Breaks image rendering
  }
}
```
**Problem:** Invalid URL stored, breaks frontend image display

---

### ✅ With Zod
```json
// Request (same)
{
  "campaign_id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Test",
  "content": "Content",
  "image_url": "not-a-url"
}

// Response (validation fails)
{
  "error": "Validation failed",
  "details": [
    {
      "field": "image_url",
      "message": "image_url must be a valid URL"
    }
  ]
}
```
**Benefit:** URL validation prevents broken images

---

## Example 4: Multiple Validation Errors

### ✅ With Zod (shows ALL errors at once)
```json
// Request (multiple issues)
{
  "campaign_id": "invalid",
  "title": "",
  "content": "Content",
  "rank": -5,
  "image_url": "not-a-url"
}

// Response (all errors reported)
{
  "error": "Validation failed",
  "details": [
    {
      "field": "campaign_id",
      "message": "campaign_id must be a valid UUID"
    },
    {
      "field": "title",
      "message": "Title is required"
    },
    {
      "field": "rank",
      "message": "Rank must be at least 1"
    },
    {
      "field": "image_url",
      "message": "image_url must be a valid URL"
    }
  ]
}
```
**Benefit:** All errors shown at once (not one-at-a-time)

---

## Code Comparison

### Before: Manual Validation (8 lines)
```typescript
const body = await request.json()
const { campaign_id, title, content, image_url, source_url, rank } = body

if (!campaign_id || !title || !content) {
  return NextResponse.json({
    error: 'campaign_id, title, and content are required'
  }, { status: 400 })
}
// ❌ No type checking
// ❌ No length validation
// ❌ No URL validation
```

### After: Zod Validation (1 line + reusable schema)
```typescript
const body = await request.json()
const validated = CreateManualArticleSchema.parse(body)
// ✅ All validation done
// ✅ Full type safety
// ✅ Clear error messages
// ✅ TypeScript knows exact types
```

---

## TypeScript Benefits

### Without Zod
```typescript
// TypeScript doesn't know if these are valid
const { campaign_id, title } = body

// Could be anything!
campaign_id.toLowerCase() // ❌ Runtime error if not string
```

### With Zod
```typescript
const validated = CreateManualArticleSchema.parse(body)

// TypeScript KNOWS these are valid types
validated.campaign_id // ✅ Type: string (and it's a UUID)
validated.rank        // ✅ Type: number | undefined
validated.image_url   // ✅ Type: string | undefined (and it's a URL)
```

---

## Performance Impact

- **Validation overhead:** ~1-2ms per request (negligible)
- **Benefit:** Prevents invalid DB queries (saves 50-100ms)
- **Net impact:** Faster overall (catches errors early)

---

## When to Use Zod in Your App

### High Priority (Most Benefit)
1. ✅ **API routes** - Validate all incoming requests
2. ✅ **Database configs** - Validate `app_settings` JSON structure
3. ✅ **RSS feed data** - Validate external data before processing

### Medium Priority
4. **Environment variables** - Validate at startup
5. **Webhook payloads** - Validate external webhook data
6. **Form submissions** - Validate user input

### Lower Priority
- Internal function parameters (TypeScript usually sufficient)
- Data already validated elsewhere

---

## Migration Strategy

### Phase 1: New Code
- Use Zod for all new API routes
- Validate external data (RSS, webhooks)

### Phase 2: Critical Paths
- Refactor high-traffic routes first
- Routes with most validation bugs

### Phase 3: Complete Migration
- Gradually refactor remaining routes
- Create reusable schema library

---

## Next Steps

1. Install Zod: `npm install zod`
2. Create schema file: `src/lib/validation/article-schemas.ts`
3. Refactor one route: `articles/manual/route.ts`
4. Test with invalid data
5. Expand to other routes

**Result:** Safer, more maintainable API with better error messages.
