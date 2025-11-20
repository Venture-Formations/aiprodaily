# Vercel Workflows Error Report

**Date:** November 20, 2025
**Time:** ~18:00 UTC
**Project:** aiprodaily (prj_6IHGaMW3akCQ8ru7eWtmcHXtKEuT)
**Deployment:** dpl_9qcdXqoRV3GRdUXWLtDG2GE5mtCt
**Commit:** 5faca00dc2f880e50f3fc7545b5e2006731df23b

## Issue Summary

Vercel Workflows service is consistently returning `500 Internal Server Error` when attempting to start workflows via the `workflow/api` `start()` function. This started occurring after a new deployment at approximately 18:03 UTC and persists across multiple retry attempts.

## Error Details

### Error Message
```
Error [InternalServerError]: Server error: 500 Internal Server Error
    at c5.sendMessage (.next/server/chunks/4199.js:60:8485)
    at async dn (.next/server/chunks/4199.js:60:17230)
    at async Object.queue (.next/server/chunks/4199.js:80:7297)
    at async (.next/server/chunks/4199.js:100:7837)
    at async (.next/server/chunks/4199.js:39:3692)
    at async m (.next/server/app/api/campaigns/create-with-workflow/route.js:1:7005)
```

### Code Location
File: `src/app/api/campaigns/create-with-workflow/route.ts`
Lines: 200-203

```typescript
await start(createIssueWorkflow, [{
  issue_id: issueId,
  publication_id: newsletterUuid
}])
```

### Workflow Definition
File: `src/lib/workflows/create-issue-workflow.ts`
Function: `createIssueWorkflow`

```typescript
export async function createIssueWorkflow(input: {
  issue_id: string
  publication_id: string
}) {
  "use workflow"
  // ... workflow steps
}
```

## Reproduction Steps

1. Deploy code with Vercel Workflows using Next.js 15.1.3
2. Wait for deployment to complete and be promoted (status: READY, PROMOTED)
3. Make POST request to `/api/campaigns/create-with-workflow`
4. Code reaches `start(createIssueWorkflow, [...])` invocation
5. Vercel Workflows service returns 500 Internal Server Error

## Attempted Solutions

- ✅ Multiple retry attempts (3+ times over 10 minutes)
- ✅ Verified workflow syntax is correct (`"use workflow"`, `"use step"`)
- ✅ Verified deployment is fully completed and promoted
- ✅ Verified code compiles successfully (TypeScript with no errors)
- ✅ Tested with different workflow invocations (create, reprocess)

## Frequency

**100% reproducible** - Every attempt to start a workflow fails with the same error.

## Impact

**HIGH** - Workflows are the core automation system for our newsletter generation. Without workflows:
- Cannot generate newsletter content automatically
- Cannot run scheduled article processing
- Must manually trigger all processing steps

## Timeline of Events

| Time (UTC) | Event |
|------------|-------|
| 18:03:12 | New deployment promoted to production (5faca00) |
| 17:53:47 | First workflow start attempt - 500 error |
| 17:57:17 | Retry attempt - 500 error |
| 18:00:19 | Third attempt - 500 error |

## Environment Details

### Deployment
- **Project ID:** prj_6IHGaMW3akCQ8ru7eWtmcHXtKEuT
- **Deployment ID:** dpl_9qcdXqoRV3GRdUXWLtDG2GE5mtCt
- **URL:** aiprodaily-hzuzynze4-venture-formations.vercel.app
- **Region:** iad1 (Washington, D.C., USA - East)
- **Build Time:** ~7 minutes
- **Status:** READY, PROMOTED

### Framework
- **Next.js:** 15.1.3
- **Vercel CLI:** 48.10.3
- **Node.js:** 20.x (Vercel default)

### Workflow Configuration
Build logs show successful workflow discovery:
```
Discovering workflow directives 18548ms
Created steps bundle 504ms
Created intermediate workflow bundle 14ms
Creating webhook route
```

## Additional Context

### Previous Deployment
The previous deployment (00483ef) also had the same code and experienced the same issue. This suggests a Vercel Workflows service-level problem rather than a code issue.

### Workflow Registration
The deployment logs show workflows are being discovered and bundled successfully during build time, but the runtime service fails when attempting to invoke them.

### Error Source
The error originates from Vercel's internal workflow orchestration code (`c5.sendMessage`), not from user code, indicating an infrastructure-level issue.

## Expected Behavior

When calling `start(createIssueWorkflow, [payload])`, the workflow should:
1. Accept the payload
2. Queue the workflow execution
3. Return successfully
4. Execute workflow steps asynchronously

## Actual Behavior

The `start()` function throws an `InternalServerError` before the workflow can be queued or executed.

## Request for Assistance

1. Is there a known issue with Vercel Workflows service at this time?
2. Is there additional time needed after deployment for workflows to register?
3. Are there any workflow service logs that could provide more details?
4. Is there a workaround or manual intervention needed?

## Contact Information

- **GitHub Organization:** Venture-Formations
- **Repository:** aiprodaily
- **Vercel Team:** (your team name if applicable)

## Attachments

- Error stack trace (see above)
- Deployment logs showing successful workflow bundle creation
- Deployment URL for inspection: https://vercel.com/venture-formations/aiprodaily/9qcdXqoRV3GRdUXWLtDG2GE5mtCt

---

**Severity:** High
**Priority:** Urgent (blocking production workflows)
**Category:** Vercel Workflows Infrastructure
