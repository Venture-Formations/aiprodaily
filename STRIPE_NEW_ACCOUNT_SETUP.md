# New Stripe Account Setup Checklist

**Last Updated:** October 7, 2025
**Purpose:** Complete guide for setting up a new Stripe account for St. Cloud Scoop event payments

---

## 📋 Overview

You need to configure **TWO separate environments** in Stripe:

1. **Test Mode** - For development and testing (uses fake cards)
2. **Live Mode** - For real production payments (uses real money)

Each mode has its own API keys and webhook configurations.

---

## 🔑 Part 1: Stripe Account Setup

### Step 1: Create/Access Stripe Account

1. Go to [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Sign up or log in with your new Stripe account
3. Complete business verification if prompted (required for live mode)

### Step 2: Get Test Mode API Keys

1. Ensure you're in **Test Mode** (toggle in top-right corner should show "Test Mode")
2. Navigate to **Developers → API Keys** in left sidebar
3. You'll see two keys:

   **📋 Copy These:**
   - **Publishable Key**: `pk_test_51...` (starts with `pk_test_`)
   - **Secret Key**: Click "Reveal test key" → `sk_test_...` (starts with `sk_test_`)

4. **Store these safely** - you'll need them in a moment

---

## 🪝 Part 2: Test Mode Webhook Setup

### Step 1: Create Test Webhook Endpoint

1. Still in **Test Mode**, go to **Developers → Webhooks**
2. Click **"+ Add endpoint"** button
3. Fill in the form:

   **Endpoint URL:**
   ```
   https://st-cloud-scoop.vercel.app/api/webhooks/stripe
   ```

   **Description:** (optional)
   ```
   Test mode webhook for event submissions
   ```

   **Events to send:**
   - Click **"Select events"**
   - Search for and check: `checkout.session.completed`
   - Click **"Add events"**

4. Click **"Add endpoint"** to save

### Step 2: Get Test Webhook Signing Secret

1. After creating the endpoint, you'll see the webhook details page
2. Scroll down to **"Signing secret"**
3. Click **"Reveal"** or **"Click to reveal"**

   **📋 Copy This:**
   - **Signing Secret**: `whsec_...` (starts with `whsec_`)

4. **Store this safely** - you'll need it for environment variables

---

## 🌐 Part 3: Configure Vercel Environment Variables (Test Mode)

You need to add **3 environment variables** to Vercel for Test Mode:

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your **st-cloud-scoop** project
3. Click **Settings** → **Environment Variables**
4. Add each variable:

   | Variable Name | Value | Environment |
   |--------------|-------|-------------|
   | `STRIPE_SECRET_KEY` | `sk_test_...` (from Step 2) | Production |
   | `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` (from Step 2) | Production |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_...` (from webhook) | Production |

5. Click **"Save"** for each variable

### Option B: Via Vercel CLI

```bash
# Make sure you're in the project directory
cd C:\Users\dpenn\Documents\STC_Scoop

# Set Test Mode keys (using interactive prompts)
vercel env add STRIPE_SECRET_KEY production
# Paste: sk_test_...

vercel env add STRIPE_PUBLISHABLE_KEY production
# Paste: pk_test_...

vercel env add STRIPE_WEBHOOK_SECRET production
# Paste: whsec_...
```

### Step 4: Redeploy to Apply Changes

```bash
# Trigger a redeployment to pick up new env vars
git commit --allow-empty -m "Update Stripe test environment variables"
git push origin main
```

Or via Vercel Dashboard:
- Go to **Deployments** → Click **"..."** on latest → **"Redeploy"**

---

## ✅ Part 4: Test the Test Mode Setup

### Test 1: Verify Environment Variables

```bash
# Visit this URL to check variables are set
https://st-cloud-scoop.vercel.app/api/debug/test-checkout
```

**Expected output:**
```json
{
  "STRIPE_SECRET_KEY_SET": true,
  "STRIPE_WEBHOOK_SECRET_SET": true,
  "message": "Stripe test mode configured correctly"
}
```

### Test 2: Complete Test Payment

1. **Go to event submission page:**
   ```
   https://st-cloud-scoop.vercel.app/events/submit
   ```

2. **Fill out the form:**
   - Event title: "Test Event"
   - Date: Any future date
   - Description: "Testing Stripe payments"
   - Upload any image
   - Select "Featured Event" ($15) or "Paid Placement" ($5)
   - Click **"Add to Cart"**

3. **Proceed to checkout:**
   - Click **"Proceed to Checkout"**
   - Click **"Pay with Stripe"**

4. **Use Stripe test card:**
   ```
   Card Number: 4242 4242 4242 4242
   Expiry: 12/34 (any future date)
   CVC: 123 (any 3 digits)
   ZIP: 12345 (any 5 digits)
   ```

5. **Click "Pay"** and wait for redirect

6. **Verify success:**
   - Should redirect to success page
   - Should receive Slack notification (if configured)
   - Event should appear in database

### Test 3: Verify Webhook Works

1. Go to Stripe Dashboard → **Developers → Webhooks**
2. Click your test endpoint
3. Scroll down to **"Recent events"**
4. You should see a successful `checkout.session.completed` event
5. Click on it to see details - HTTP response should be **200 OK**

---

## 🚀 Part 5: Live Mode Setup (For Production)

**⚠️ ONLY DO THIS WHEN READY TO ACCEPT REAL PAYMENTS**

### Step 1: Switch to Live Mode

1. In Stripe Dashboard, toggle to **"Live Mode"** (top-right corner)
2. Complete business verification if not already done
3. Add bank account for payouts (**Settings → Business settings → Payouts**)

### Step 2: Get Live Mode API Keys

1. Still in **Live Mode**, go to **Developers → API Keys**
2. You'll see different keys (live mode):

   **📋 Copy These:**
   - **Publishable Key**: `pk_live_...` (starts with `pk_live_`)
   - **Secret Key**: Click "Reveal live key" → `sk_live_...` (starts with `sk_live_`)

3. **Store these VERY safely** - these handle real money!

### Step 3: Create Live Webhook Endpoint

1. Still in **Live Mode**, go to **Developers → Webhooks**
2. Click **"+ Add endpoint"** button
3. Fill in the form:

   **Endpoint URL:**
   ```
   https://st-cloud-scoop.vercel.app/api/webhooks/stripe
   ```

   *(Same URL as test mode)*

   **Description:** (optional)
   ```
   Production webhook for event submissions
   ```

   **Events to send:**
   - Click **"Select events"**
   - Search for and check: `checkout.session.completed`
   - Click **"Add events"**

4. Click **"Add endpoint"** to save

### Step 4: Get Live Webhook Signing Secret

1. After creating the live endpoint, scroll down to **"Signing secret"**
2. Click **"Reveal"**

   **📋 Copy This:**
   - **Live Signing Secret**: `whsec_...` (different from test mode!)

### Step 5: Update Vercel Environment Variables (Live Mode)

**⚠️ IMPORTANT:** You're about to replace test keys with live keys. This enables real payments!

#### Via Vercel Dashboard:

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. **Find and EDIT** (don't delete) each of these 3 variables:

   | Variable Name | New Value (Live Mode) | Environment |
   |--------------|----------------------|-------------|
   | `STRIPE_SECRET_KEY` | `sk_live_...` (your live secret key) | Production |
   | `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` (your live publishable key) | Production |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_...` (your live webhook secret) | Production |

3. Click **"Save"** for each

#### Via Vercel CLI:

```bash
# Update to Live Mode keys
vercel env rm STRIPE_SECRET_KEY production
vercel env add STRIPE_SECRET_KEY production
# Paste: sk_live_...

vercel env rm STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_PUBLISHABLE_KEY production
# Paste: pk_live_...

vercel env rm STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_WEBHOOK_SECRET production
# Paste: whsec_... (live webhook secret)
```

### Step 6: Redeploy for Live Mode

```bash
git commit --allow-empty -m "Switch to Stripe live mode"
git push origin main
```

---

## ✅ Part 6: Test Live Mode (Small Real Payment)

**⚠️ You will be charged real money for this test!**

1. **Complete a test payment with a REAL card:**
   - Go to event submission page
   - Use your own credit/debit card
   - Submit a $5 paid placement event
   - Verify payment succeeds

2. **Immediately refund the test payment:**
   ```bash
   # Find the session ID from success page URL or Stripe Dashboard
   https://st-cloud-scoop.vercel.app/api/debug/test-refund?session_id=cs_live_xxxxx&mode=live&amount=5.00
   ```

3. **Verify everything works:**
   - Payment processes successfully
   - Webhook fires (check Stripe Dashboard → Webhooks → Recent events)
   - Event appears in database
   - Slack notification received
   - Refund processes successfully

---

## 📊 Quick Reference Table

| Item | Test Mode | Live Mode |
|------|-----------|-----------|
| **Secret Key** | `sk_test_...` | `sk_live_...` |
| **Publishable Key** | `pk_test_...` | `pk_live_...` |
| **Webhook Secret** | `whsec_...` (test) | `whsec_...` (live, different!) |
| **Webhook URL** | Same for both | `https://st-cloud-scoop.vercel.app/api/webhooks/stripe` |
| **Test Cards** | 4242 4242 4242 4242 | Real cards only |
| **Money** | Fake (no actual charges) | Real money charged |
| **Dashboard Toggle** | "Test Mode" | "Live Mode" |

---

## 🔐 Security Reminders

- ✅ **NEVER commit** API keys to git (they're in environment variables only)
- ✅ **NEVER expose** secret keys in client-side code
- ✅ Keep test and live keys completely separate
- ✅ Store live keys in password manager
- ✅ Enable 2FA on Stripe account
- ✅ Only switch to live mode when you're ready for real payments

---

## 🆘 Troubleshooting

### Issue: "Webhook signature verification failed"

**Cause:** Wrong webhook secret in environment variables

**Fix:**
1. Go to Stripe Dashboard → Developers → Webhooks
2. Make sure you're in the correct mode (Test/Live)
3. Click your endpoint
4. Reveal the signing secret
5. Copy it EXACTLY
6. Update `STRIPE_WEBHOOK_SECRET` in Vercel
7. Redeploy

### Issue: "No API key provided"

**Cause:** Environment variables not set or deployment didn't pick them up

**Fix:**
1. Verify variables are set: Visit `/api/debug/test-checkout`
2. If missing, add them in Vercel Dashboard
3. Redeploy application

### Issue: Webhook shows 500 error in Stripe Dashboard

**Cause:** Application error processing webhook

**Fix:**
1. Check Vercel logs for error details
2. Verify database connection (Supabase credentials)
3. Verify `pending_event_submissions` table exists
4. Manually resend webhook from Stripe Dashboard after fixing

---

## ✅ Final Checklist

### Test Mode Setup:
- [ ] Created Stripe account
- [ ] Got test mode API keys (`pk_test_...` and `sk_test_...`)
- [ ] Created test webhook endpoint in Stripe
- [ ] Got test webhook signing secret (`whsec_...`)
- [ ] Added 3 test environment variables to Vercel
- [ ] Redeployed application
- [ ] Completed successful test payment with 4242 card
- [ ] Verified webhook shows 200 OK in Stripe Dashboard
- [ ] Event appears in database

### Live Mode Setup (When Ready):
- [ ] Completed Stripe business verification
- [ ] Added bank account for payouts
- [ ] Got live mode API keys (`pk_live_...` and `sk_live_...`)
- [ ] Created live webhook endpoint in Stripe
- [ ] Got live webhook signing secret (different from test!)
- [ ] Updated 3 environment variables to live keys in Vercel
- [ ] Redeployed application
- [ ] Completed small real payment test
- [ ] Refunded test payment
- [ ] Live webhook shows 200 OK in Stripe Dashboard
- [ ] Ready for production payments

---

## 📞 Need Help?

- **Stripe Documentation:** https://stripe.com/docs
- **Stripe Support:** https://support.stripe.com
- **Vercel Support:** https://vercel.com/support
- **Existing Setup Guide:** See `STRIPE_PAYMENT_SETUP.md` for detailed integration info

---

**You're all set!** 🎉

Test mode is perfect for development. Switch to live mode only when you're ready to accept real customer payments.
