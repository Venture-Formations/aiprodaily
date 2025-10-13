## API endpoint standards and conventions

- **RESTful Design**: Follow REST principles with clear resource-based URLs and appropriate HTTP methods (GET, POST, PUT, PATCH, DELETE)
- **Consistent Naming**: Use consistent, lowercase, hyphenated naming conventions for endpoints across the API
- **Versioning**: Implement API versioning strategy (URL path or headers) to manage breaking changes without disrupting existing clients
- **Plural Nouns**: Use plural nouns for resource endpoints (e.g., `/campaigns`, `/events`, `/articles`) for consistency
- **Nested Resources**: Limit nesting depth to 2-3 levels maximum to keep URLs readable and maintainable
- **Query Parameters**: Use query parameters for filtering, sorting, pagination, and search rather than creating separate endpoints
- **HTTP Status Codes**: Return appropriate, consistent HTTP status codes that accurately reflect the response (200, 201, 400, 404, 500, etc.)
- **Rate Limiting Headers**: Include rate limit information in response headers to help clients manage their usage

## Project-Specific Conventions

### Naming Patterns

- **Multi-word Resources**: Use hyphens for multi-word resource names (e.g., `/dining-deals`, `/road-work`, `/link-tracking`)
- **Action Endpoints**: For non-RESTful operations, use verb-noun format at resource level (e.g., `/verify-payment`, `/upload-image`, `/create-checkout`)
- **ID-based Actions**: For actions on specific resources, nest under the ID (e.g., `/ads/[id]/approve`, `/events/[id]/reject`)
- **Never Mix Patterns**: Don't use both `/dining/deals` and `/dining-deals` - choose one and be consistent

### Endpoint Organization

- **Cron Jobs**: All automated tasks under `/api/cron/*` (e.g., `/api/cron/rss-processing`, `/api/cron/sync-events`)
- **Debug Tools**: All debugging endpoints under `/api/debug/*` for easy identification
- **Test Endpoints**: All testing endpoints under `/api/test/*` for clarity
- **Settings**: All configuration endpoints under `/api/settings/*` (e.g., `/api/settings/ai-prompts`, `/api/settings/email`)

### Authentication & Security

- **Session-based Auth**: All protected endpoints require `getServerSession()` check
- **Cron Security**: Cron endpoints protected with `Authorization: Bearer CRON_SECRET` header
- **Error Messages**: Return user-friendly messages without exposing technical details or stack traces
- **Status Codes**: Use 401 for unauthorized, 404 for not found, 500 for server errors

### Response Format

All API responses should use consistent JSON structure:

```typescript
// Success responses
{ success: true, data: {...}, message?: "Optional success message" }

// Error responses
{ error: "User-friendly error", message?: "Additional details", details?: {...} }
```

### Known Inconsistencies to Avoid

These patterns exist in the codebase but should NOT be replicated:

- ❌ Duplicate endpoints with different names (`/process-rss` and `/rss-processing`)
- ❌ Mixed nesting patterns for same resource (`/dining/deals` vs `/dining-deals`)
- ❌ Inconsistent action naming within same resource group
