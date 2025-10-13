# Stripe Integration Not Working After Credential Change

**Issue:** After updating Stripe credentials:
- ❌ No Slack notifications
- ❌ Events not being added to database
- ❌ Events not showing in review queue
- ❌ Customers not receiving receipts

## Root Cause

The webhook is likely failing because the **STRIPE_WEBHOOK_SECRET** doesn't match the new Stripe account's webhook signing secret.

---

## Quick Diagnostic Steps

### Step 1: Check if payment succeeded in Stripe

1. Log into new Stripe account: https://dashboard.stripe.com
2. Go to **Payments** (left sidebar)
3. Look for recent payment
4. **If payment is there:** Payment worked, webhook failed ✅
5. **If no payment:** API keys might be wrong ❌

### Step 2: Check webhook status in Stripe

1. In Stripe Dashboard, go to **Developers → Webhooks**
2. Click your webhook endpoint
3. Scroll to **"Recent events"**
4. Look for recent `checkout.session.completed` events
5. Check the HTTP response:
   - **200 OK** = Webhook working ✅
   - **401/500/error** = Webhook failing ❌

---

## Solution: Update Webhook Secret

### The Problem

When you created the new Stripe account, you got:
- ✅ New `STRIPE_SECRET_KEY` - You updated this
- ✅ New `STRIPE_PUBLISHABLE_KEY` - You updated this
- ❌ **New webhook signing secret** - This is probably WRONG in Vercel

### Step 1: Get the correct webhook secret

**In your NEW Stripe account:**

1. Go to **Developers → Webhooks**
2. Do you see an endpoint?
   - **If YES:** Click it, reveal the signing secret
   - **If NO:** You need to create one (see Step 2)

### Step 2: Create webhook endpoint (if missing)

**Only do this if no webhook exists:**

1. In Stripe Dashboard, go to **Developers → Webhooks**
2. Click **"+ Add endpoint"**
3. Fill in:
   ```
   Endpoint URL: https://st-cloud-scoop.vercel.app/api/webhooks/stripe
   Events to send: checkout.session.completed
   ```
4. Click **"Add endpoint"**
5. Copy the **signing secret** (starts with `whsec_`)

### Step 3: Update Vercel environment variable

**Critical:** The `STRIPE_WEBHOOK_SECRET` must match your new Stripe account.

#### Via Vercel Dashboard:

1. Go to: https://vercel.com/dashboard
2. Select your project: **st-cloud-scoop**
3. Click **Settings → Environment Variables**
4. Find `STRIPE_WEBHOOK_SECRET`
5. Click **Edit** (pencil icon)
6. Paste the NEW webhook secret: `whsec_...`
7. Click **Save**

#### Via CLI:

```bash
# Remove old webhook secret
vercel env rm STRIPE_WEBHOOK_SECRET production

# Add new webhook secret
vercel env add STRIPE_WEBHOOK_SECRET production
# Paste: whsec_... (from new Stripe account)
```

### Step 4: Redeploy

**CRITICAL:** Environment variable changes require redeployment!

```bash
git commit --allow-empty -m "Trigger redeploy after webhook secret update"
git push origin main
```

Or via Vercel Dashboard:
- **Deployments** → Latest deployment → **"..."** → **"Redeploy"**

---

## Verification Checklist

After redeployment (wait 80 seconds):

### Test 1: Check environment variables

Visit this URL to verify all Stripe variables are set:
```
https://st-cloud-scoop.vercel.app/api/debug/test-checkout
```

**Expected output:**
```json
{
  "STRIPE_SECRET_KEY_SET": true,
  "STRIPE_WEBHOOK_SECRET_SET": true
}
```

### Test 2: Complete a test payment

1. Go to: https://st-cloud-scoop.vercel.app/events/submit
2. Fill out event form
3. Use test card: `4242 4242 4242 4242`
4. Complete payment
5. **Check:**
   - ✅ Redirected to success page
   - ✅ Event appears in database
   - ✅ Slack notification received
   - ✅ Webhook shows 200 OK in Stripe Dashboard

### Test 3: Check Stripe webhook logs

1. Stripe Dashboard → **Developers → Webhooks**
2. Click your endpoint
3. Check **"Recent events"**
4. Latest event should show: **200 OK**

---

## Still Not Working?

### Check All 3 Variables Match

Make sure you updated ALL THREE in Vercel:

| Variable | Starts With | Where to Find |
|----------|-------------|---------------|
| `STRIPE_SECRET_KEY` | `sk_test_` or `sk_live_` | Stripe → Developers → API Keys |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_` or `pk_live_` | Stripe → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_` | Stripe → Developers → Webhooks → Your endpoint |

### Check you're in the correct mode

- Using **test keys** (`sk_test_`)? Must be in **Test Mode** in Stripe Dashboard
- Using **live keys** (`sk_live_`)? Must be in **Live Mode** in Stripe Dashboard

### Check webhook URL is correct

In Stripe Dashboard → Developers → Webhooks:
```
URL should be: https://st-cloud-scoop.vercel.app/api/webhooks/stripe
Event: checkout.session.completed
```

### Check Vercel logs for errors

1. Go to Vercel Dashboard
2. Click **Deployments**
3. Click latest deployment
4. Click **Functions** tab
5. Look for `/api/webhooks/stripe` errors

Common errors:
- `"Invalid signature"` = Wrong webhook secret
- `"STRIPE_WEBHOOK_SECRET not configured"` = Variable not set
- `500 error` = Database or code issue

---

## Quick Fix Script

Run these commands to verify and fix:

```bash
# 1. Check current Vercel variables
vercel env ls

# 2. If webhook secret is wrong, update it
vercel env rm STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_WEBHOOK_SECRET production
# Paste new secret from Stripe

# 3. Redeploy
git commit --allow-empty -m "Update webhook secret"
git push origin main

# 4. Wait 80 seconds, then test
# Visit: https://st-cloud-scoop.vercel.app/api/debug/test-checkout
```

---

## Expected Behavior After Fix

When everything is working:

1. **Customer completes payment** → Stripe charges card
2. **Stripe sends webhook** → `checkout.session.completed` event
3. **Your app receives webhook** → Verifies signature
4. **App inserts events** → Events added to database with `status: 'pending'`
5. **App sends Slack notification** → "🎉 New Paid Event Submission!"
6. **Stripe sends receipt** → Customer receives email (if enabled in Stripe)
7. **Admin can review** → Events appear in review queue

---

## Need Help?

If still not working after these steps, check:

1. **Vercel Function Logs** - Look for webhook errors
2. **Stripe Dashboard → Events** - Check webhook delivery status
3. **Database** - Check `pending_event_submissions` table for records
4. **Webhook Test** - Send test webhook from Stripe Dashboard

---

**Most Common Fix:** Update `STRIPE_WEBHOOK_SECRET` in Vercel and redeploy!
