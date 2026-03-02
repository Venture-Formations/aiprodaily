# Subscribe/Offers Page — After Offers Tracking (Conversions & Impressions)

This doc summarizes Emile’s two questions from After Offers and recommended responses, plus implementation notes for the `/subscribe/offers` page and postback.

## Context

- **Page:** `/subscribe/offers` — iframe to `https://offers.afteroffers.com/show_offers/994-2MMat6y-1?email=...`
- **Goal:** Track conversions and (if available) impressions for Facebook conversion targeting and revenue attribution.
- **Current state:** Only `email` is passed in the After Offers URL; no postback endpoint exists.

---

## Emile’s Two Questions — Recommended Responses

### 1) Identifier (click_id vs email)

**Recommended answer to send Emile:**

> We’ll use **click_id** as the identifier. We’ll pass a unique `click_id` in the After Offers URL on every visit to our offers page (along with `email`). That way we get per-visit data and can tie conversions back to our Facebook campaigns. Example URL we’ll use:
>
> `https://offers.afteroffers.com/show_offers/994-2MMat6y-1?email={email}&click_id={click_id}`

**Why:** Same email can hit the offers page from different sources (e.g. different ad campaigns). Using `click_id` gives one ID per visit so revenue and conversions can be attributed to the right source.

---

### 2) Postback URL (GET or POST) and variable names

**Recommended answer to send Emile:**

> **Method:** GET is preferred for simplicity; we’ll accept query parameters. If you only support POST, we can accept that instead.
>
> **Postback URL:**  
> `https://aiaccountingdaily.com/api/webhooks/afteroffers/postback`
>
> **Variables we’d like to receive:**
> - **click_id** (required) — so we can match the postback to the visit we sent you.
> - **revenue** (required) — amount earned for that conversion.
> - **email** (optional) — if you have it, so we can tie the conversion to our subscriber record.
>
> If you also send impression or click events (not just conversions), an **event** or **action** parameter would be helpful (e.g. `conversion`, `impression`, `click`) so we can track funnel steps.

**Example GET postback they might call:**  
`https://aiaccountingdaily.com/api/webhooks/afteroffers/postback?click_id=abc123&revenue=1.50&email=joe@gmail.com`

---

## Implementation Checklist

### A. Generate and pass `click_id` on the offers page

- **Option A (simplest):** Generate a new `click_id` when the offers page loads (e.g. `crypto.randomUUID()` or a short nanoid). Append it to the iframe URL:  
  `...?email=...&click_id=<generated_id>`  
  Each page load = one visit = one click_id.
- **Option B (tie to subscribe):** Generate `click_id` when the user completes the subscribe step and pass it in the redirect:  
  `/subscribe/offers?email=...&click_id=...`  
  Then use that same `click_id` in the After Offers URL. This ties the “visit” to the same session as the Lead event for Facebook.

**Code change:** In `src/app/website/subscribe/offers/offers-content.tsx`, read `click_id` from `searchParams` or generate one (e.g. in `useEffect`), then build:  
`afterOffersUrl = \`...?email=${encodeURIComponent(email)}&click_id=${encodeURIComponent(clickId)}\``

### B. Postback endpoint

- Add **GET** (and optionally **POST**) handler at  
  `src/app/api/webhooks/afteroffers/postback/route.ts`.
- **GET:** Parse `searchParams`: `click_id`, `revenue`, `email`, optional `event`/`action`.
- **POST:** Parse JSON or form body with same fields.
- **Validation:** Require at least `click_id`; `revenue` can be optional if they send impression/click events with no revenue.
- **Actions:**
  - Log for debugging (e.g. `[AfterOffers] postback click_id=... revenue=...`).
  - Persist to DB in `afteroffers_events` table with `click_id`, `revenue`, `email`, `event_type`, and `created_at`.
  - Optional: forward conversion to Facebook (e.g. server-side Conversion API) using the same `click_id` / visit so it matches the client-side Lead/ViewContent events.

### C. Optional: pass `click_id` from subscribe flow

- In `subscribe-form.tsx` (and any other entry points to `/subscribe/offers`), generate `click_id` when redirecting to offers and add it to the URL so the same ID is used for the iframe and for postbacks.

---

## Summary for Jake / David

| Question              | Recommendation                                      |
|-----------------------|-----------------------------------------------------|
| **Identifier**        | Use **click_id** (plus keep passing email).          |
| **GET or POST**       | **GET** preferred; we’ll support GET and can add POST if needed. |
| **Postback URL (prod)** | `https://aiaccountingdaily.com/api/webhooks/afteroffers/postback` |
| **Postback URL (staging)** | `https://staging.aiaccountingdaily.com/api/webhooks/afteroffers/postback` (or current staging host) |
| **Variables**         | `click_id`, `revenue`; optional: `email`, `event`/`action`. |

### Environment config

- **Secret:** `AFTEROFFERS_WEBHOOK_SECRET` must be set in both staging and production.
- **Auth:** After Offers calls `Authorization: Bearer ${AFTEROFFERS_WEBHOOK_SECRET}` on every postback.
- **Failure mode:** If the secret is missing or incorrect, the endpoint responds with HTTP 401.

Use the “Recommended answer” blocks above as the reply to Emile. After they confirm, implement (A) click_id in the offers URL and (B) the postback route; (C) is optional for better Facebook attribution.
