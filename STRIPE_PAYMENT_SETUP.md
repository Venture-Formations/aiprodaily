# Stripe Payment Integration Setup Guide

## Overview

This document outlines the complete setup process for the Stripe payment integration for public event submissions. The system ensures that **only successfully paid events** are added to the database.

---

## 📋 Table of Contents

1. [Database Setup](#database-setup)
2. [Stripe Configuration](#stripe-configuration)
3. [Environment Variables](#environment-variables)
4. [Webhook Configuration](#webhook-configuration)
5. [Testing the Integration](#testing-the-integration)
6. [Troubleshooting](#troubleshooting)

---

## 1. Database Setup

### Step 1: Create the Pending Submissions Table

Run the SQL migration file in your Supabase SQL Editor:

```bash
# File location: database_migration_pending_submissions.sql
```

This creates:
- `pending_event_submissions` table for temporary storage
- Indexes for performance
- Cleanup function for expired records

### Step 2: Verify Table Creation

```sql
SELECT * FROM pending_event_submissions LIMIT 1;
```

Expected columns:
- `id` (UUID)
- `stripe_session_id` (TEXT)
- `events_data` (JSONB)
- `submitter_email` (TEXT)
- `submitter_name` (TEXT)
- `total_amount` (DECIMAL)
- `created_at` (TIMESTAMPTZ)
- `expires_at` (TIMESTAMPTZ)
- `processed` (BOOLEAN)
- `processed_at` (TIMESTAMPTZ)

---

## 2. Stripe Configuration

### Step 1: Get Your Stripe API Keys

1. Log into [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers → API Keys**
3. Copy your keys:
   - **Publishable Key** (starts with `pk_test_` or `pk_live_`)
   - **Secret Key** (starts with `sk_test_` or `sk_live_`)

### Step 2: Create Webhook Endpoint

1. In Stripe Dashboard, go to **Developers → Webhooks**
2. Click **Add Endpoint**
3. Enter your endpoint URL:
   ```
   https://st-cloud-scoop.vercel.app/api/webhooks/stripe
   ```
4. Select events to listen for:
   - ✅ `checkout.session.completed`
5. Click **Add Endpoint**
6. Copy the **Signing Secret** (starts with `whsec_`)

### Step 3: Test Mode vs Live Mode

**For Testing:**
- Use `pk_test_...` and `sk_test_...` keys
- Use test webhook endpoint with test signing secret
- Use [Stripe Test Cards](https://stripe.com/docs/testing#cards):
  - Success: `4242 4242 4242 4242`
  - Decline: `4000 0000 0000 0002`

**For Production:**
- Switch to `pk_live_...` and `sk_live_...` keys
- Update webhook endpoint to use live mode
- Use live webhook signing secret

---

## 3. Environment Variables

Add these to your Vercel environment variables:

### Required Variables

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_xxxxx  # Or sk_live_xxxxx for production
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx  # Or pk_live_xxxxx for production

# Stripe Webhook
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # From webhook endpoint creation

# Existing Variables (already configured)
NEXT_PUBLIC_URL=https://st-cloud-scoop.vercel.app
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SLACK_WEBHOOK_URL=your_slack_webhook
CRON_SECRET=your_cron_secret
```

### Setting Variables in Vercel

```bash
# Via Vercel CLI
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production

# Or via Vercel Dashboard
# Settings → Environment Variables → Add
```

---

## 4. Webhook Configuration

### Local Testing with Stripe CLI

For local development and testing:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # Mac
# Or download from: https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# This will output a webhook signing secret starting with whsec_
# Add it to your .env.local file
```

### Production Webhook Verification

After deployment:

1. Send a test webhook from Stripe Dashboard:
   - Go to **Developers → Webhooks**
   - Click your endpoint
   - Click **Send test webhook**
   - Select `checkout.session.completed`
   - Click **Send test webhook**

2. Check Vercel logs for webhook processing:
   ```
   [Webhook] Received event: checkout.session.completed
   [Webhook] Processing checkout session: cs_test_xxxxx
   ```

---

## 5. Testing the Integration

### End-to-End Test Flow

#### Test 1: Successful Payment

1. **Navigate to event submission:**
   ```
   https://st-cloud-scoop.vercel.app/events/submit
   ```

2. **Fill out event form:**
   - Enter all required fields
   - Upload an image
   - Select "Featured Event" ($15) or "Paid Placement" ($5)
   - Click "Add to Cart"

3. **Proceed to checkout:**
   - Review cart contents
   - Click "Pay with Stripe"

4. **Complete Stripe checkout:**
   - Use test card: `4242 4242 4242 4242`
   - Any future expiry date (e.g., 12/34)
   - Any CVC (e.g., 123)
   - Any ZIP code (e.g., 12345)
   - Click "Pay"

5. **Verify success page:**
   - Should redirect to `/events/success?session_id=cs_test_xxxxx`
   - Should show success message
   - Cart should be cleared

6. **Check database:**
   ```sql
   -- Events should exist with payment_status = 'completed'
   SELECT * FROM events
   WHERE payment_intent_id LIKE 'cs_test_%'
   ORDER BY created_at DESC
   LIMIT 5;

   -- Pending submission should be marked processed
   SELECT * FROM pending_event_submissions
   WHERE processed = true
   ORDER BY processed_at DESC
   LIMIT 5;
   ```

7. **Check Slack notification:**
   - Should receive message: "🎉 New Paid Event Submission!"
   - Should show payment amount and event details

#### Test 2: Abandoned Checkout

1. Start checkout process
2. Close browser before completing payment
3. Wait 24 hours or run cleanup manually:
   ```bash
   curl https://st-cloud-scoop.vercel.app/api/cron/cleanup-pending-submissions \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
4. Verify pending submission is deleted

#### Test 3: Webhook Failure Recovery

1. Complete payment with webhook endpoint temporarily down
2. User reaches success page
3. `/api/events/verify-payment` should return status: "pending"
4. When webhook fires (can be manually resent from Stripe Dashboard):
   - Events should be inserted
   - Pending submission marked processed
   - Success page refresh shows status: "processed"

---

## 6. Troubleshooting

### Issue: Webhook signature verification failing

**Error:** `Invalid signature`

**Solution:**
- Verify `STRIPE_WEBHOOK_SECRET` matches the signing secret from Stripe Dashboard
- Ensure you're using the correct webhook endpoint (test vs live mode)
- Check that raw body is being sent to verification (not parsed JSON)

### Issue: Events not appearing after payment

**Symptoms:**
- Payment successful in Stripe
- No events in database
- No Slack notification

**Debug Steps:**

1. Check Vercel logs for webhook:
   ```
   [Webhook] Received event: checkout.session.completed
   ```

2. Check pending submissions table:
   ```sql
   SELECT * FROM pending_event_submissions
   WHERE stripe_session_id = 'cs_test_xxxxx';
   ```

3. Manually trigger webhook from Stripe Dashboard
4. Check for errors in webhook processing logs

### Issue: Duplicate events created

**Solution:**
- Check that webhook is only firing once
- Verify `processed` flag is being checked before insertion
- Check for duplicate webhook endpoint configurations

### Issue: Payment succeeded but webhook never fired

**Solution:**
- Verify webhook endpoint URL is correct and accessible
- Check Stripe Dashboard → Webhooks → Endpoint → Recent Events
- Manually resend webhook from Stripe Dashboard
- User can refresh success page - verify-payment endpoint will show pending status

---

## 🔒 Security Considerations

### ✅ Implemented Security Features

1. **Webhook Signature Verification:** All webhooks verified with HMAC SHA256
2. **Timing-Safe Comparison:** Prevents timing attacks on signature validation
3. **No Client-Side Trust:** Success page cannot trigger event insertion
4. **Idempotent Processing:** Duplicate webhooks don't create duplicate events
5. **Expiring Pending Records:** Auto-cleanup after 24 hours

### ⚠️ Important Reminders

- **Never expose** `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in client code
- **Always verify** webhook signatures before processing events
- **Never trust** client-side success callbacks for payment confirmation
- **Use live keys** only in production environment
- **Test thoroughly** in test mode before going live

---

## 📊 Monitoring & Maintenance

### Daily Monitoring

1. Check Slack for failed payment notifications
2. Review Vercel logs for webhook errors
3. Monitor pending submissions table size:
   ```sql
   SELECT COUNT(*) FROM pending_event_submissions WHERE NOT processed;
   ```

### Weekly Tasks

1. Review Stripe Dashboard for failed payments
2. Check for any unprocessed pending submissions older than 24 hours
3. Verify cleanup cron job is running (2:00 AM daily)

### Monthly Tasks

1. Review total payment volume and success rate
2. Check for any patterns in payment failures
3. Update test mode webhook if Stripe API changes

---

## 📞 Support Contacts

- **Stripe Support:** https://support.stripe.com
- **Vercel Support:** https://vercel.com/support
- **Supabase Support:** https://supabase.com/support

---

## ✅ Deployment Checklist

Before going live:

- [ ] Database migration applied (`pending_event_submissions` table created)
- [ ] All environment variables set in Vercel
- [ ] Webhook endpoint created in Stripe Dashboard
- [ ] Webhook signing secret added to environment variables
- [ ] Test payment completed successfully in test mode
- [ ] Webhook verified working (check Vercel logs)
- [ ] Slack notification received for test payment
- [ ] Events appear in database with correct payment_status
- [ ] Success page shows correct confirmation
- [ ] Cleanup cron job scheduled and tested
- [ ] Switched to live Stripe keys for production
- [ ] Created live mode webhook endpoint
- [ ] Updated environment variables with live keys
- [ ] Final test in production with real payment method

---

**Last Updated:** October 1, 2025
**Version:** 1.0.0
