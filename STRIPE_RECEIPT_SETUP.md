# Stripe Receipt Configuration Guide

**Last Updated:** October 7, 2025
**Purpose:** Enable automatic email receipts for event submission payments

---

## 📧 Overview

Stripe can automatically send professional email receipts to customers after successful payments. Your code already passes the customer's email address, so you just need to enable receipt sending in Stripe Dashboard.

---

## ✅ Current Implementation Status

Your checkout already includes:
- ✅ `customer_email` passed to Stripe (line 94 in `create-checkout/route.ts`)
- ✅ Line items with clear descriptions
- ✅ Metadata with event details

**You only need to configure Stripe to send receipts automatically.**

---

## 🔧 Part 1: Enable Automatic Receipts (Both Test & Live Mode)

### For Test Mode:

1. **Log into Stripe Dashboard**
   - Go to [https://dashboard.stripe.com](https://dashboard.stripe.com)
   - Make sure you're in **Test Mode** (toggle in top-right)

2. **Navigate to Receipt Settings**
   - Click **Settings** (gear icon in top-right)
   - Scroll down left sidebar to **Payments** section
   - Click **Emails**

3. **Enable Successful Payments Receipt**
   - Find section: **"Successful payments"**
   - Toggle **ON**: "Email customers for successful payments"
   - This sends a receipt automatically after every successful payment

4. **Configure Receipt Appearance (Optional)**
   - In the **"Successful payments"** section, click **"Customize"**
   - You can customize:
     - **From name:** "St. Cloud Scoop" (or your business name)
     - **Reply-to email:** Your support email (e.g., scoop@stcscoop.com)
     - **Receipt title:** "Thank you for your event submission!"
     - **Receipt footer:** Add custom message or contact info
   - Click **"Save"**

5. **Test Receipt Sending**
   - Complete a test payment using card `4242 4242 4242 4242`
   - Check the email address you used
   - Should receive receipt within 1-2 minutes

### For Live Mode:

**Repeat the exact same steps above, but:**
1. Toggle to **"Live Mode"** in top-right corner
2. Go to **Settings → Emails**
3. Enable **"Email customers for successful payments"**
4. Customize if desired (same settings as test mode)
5. Save changes

---

## 📋 Part 2: What the Receipt Contains

Stripe's automatic receipts include:

✅ **Transaction Details:**
- Payment amount
- Date and time
- Payment method (last 4 digits of card)

✅ **Line Items:**
- Event names (e.g., "Fall Festival - Featured Event")
- Individual prices
- Total amount

✅ **Business Information:**
- Your business name (from Stripe account settings)
- Support contact information

✅ **Receipt Number:**
- Unique receipt ID for customer records

---

## 🎨 Part 3: Customize Receipt Branding (Optional)

### Add Your Logo and Colors:

1. **Go to Branding Settings**
   - Settings → **Branding**
   - Upload logo (recommended: 512x512px PNG)
   - Choose brand color (hex code)
   - Set icon (appears in receipt header)

2. **Apply to Receipts**
   - Go back to Settings → **Emails**
   - Your branding automatically applies to all receipts

---

## 🧪 Part 4: Test Receipt in Test Mode

### Send Test Receipt:

1. **Complete a test checkout:**
   ```
   https://st-cloud-scoop.vercel.app/events/submit
   ```

2. **Use test card:**
   ```
   Card: 4242 4242 4242 4242
   Email: YOUR_REAL_EMAIL@example.com (use real email to receive it!)
   ```

3. **Check your email** (within 1-2 minutes)

### What You Should See:

**Subject:** "Receipt from [Your Business Name]"

**Content:**
```
Receipt for [Your Business Name]
Amount paid: $15.00
Date: October 7, 2025

ITEMS
Fall Festival - Featured Event    $15.00
────────────────────────────────────────
Total                              $15.00

Paid with Visa •••• 4242

Receipt #: 1234-5678
```

---

## ⚙️ Part 5: Advanced Configuration (Optional)

### Option 1: Customize Email Language

**Settings → Emails → Successful payments → Customize**
- **Custom message:** Add text above line items
- **Footer text:** Add disclaimer or contact info
- **Button text:** (N/A for receipts)

Example custom message:
```
Thank you for submitting your event to St. Cloud Scoop!
Your event will be reviewed by our team within 24-48 hours.

Questions? Email us at scoop@stcscoop.com
```

### Option 2: Include PDF Receipt

**Settings → Emails → Successful payments**
- Toggle **ON**: "Attach a receipt PDF to the email"
- Customers get both HTML email + PDF attachment

### Option 3: Send Receipt Copy to Your Team

**Settings → Emails → Successful payments**
- Toggle **ON**: "Send a copy to your business"
- Enter email: `scoop@stcscoop.com` (or your admin email)
- You'll get a copy of every receipt sent

---

## 🔍 Part 6: Verify Receipts Are Sending

### Check Stripe Logs:

1. **Go to Stripe Dashboard → Events**
2. Filter by event type: `charge.succeeded`
3. Click on a recent charge
4. Scroll to **"Email Receipts"** section
5. Should show: ✅ "Receipt sent to customer@email.com"

### If Receipt Wasn't Sent:

**Possible reasons:**
- ❌ Email receipts not enabled (go back to Settings → Emails)
- ❌ Customer email invalid or bounced
- ❌ Email caught in spam filter (check customer's spam folder)

---

## 📊 Part 7: Receipt Settings Summary

| Setting | Location | Recommended Value |
|---------|----------|-------------------|
| **Auto Receipts** | Settings → Emails | ✅ ON |
| **From Name** | Settings → Emails → Customize | "St. Cloud Scoop" |
| **Reply-to Email** | Settings → Emails → Customize | scoop@stcscoop.com |
| **Custom Message** | Settings → Emails → Customize | Thank you message |
| **PDF Attachment** | Settings → Emails | Optional (ON if customers request) |
| **Copy to Business** | Settings → Emails | Optional (ON for record-keeping) |
| **Branding** | Settings → Branding | Upload logo, set colors |

---

## ✅ Quick Setup Checklist

### Test Mode:
- [ ] Logged into Stripe Dashboard (Test Mode)
- [ ] Enabled "Email customers for successful payments"
- [ ] Customized from name and reply-to email
- [ ] Added custom message (optional)
- [ ] Uploaded logo and set brand colors (optional)
- [ ] Completed test payment with real email address
- [ ] Received test receipt in inbox

### Live Mode:
- [ ] Switched to Live Mode in Stripe Dashboard
- [ ] Enabled "Email customers for successful payments"
- [ ] Applied same customizations as test mode
- [ ] Verified settings match test mode
- [ ] Ready to send receipts to real customers

---

## 🆘 Troubleshooting

### Issue: Customer didn't receive receipt

**Check these:**
1. ✅ Receipts enabled in Stripe (Settings → Emails)
2. ✅ Customer entered valid email address
3. ✅ Check customer's spam/junk folder
4. ✅ Verify in Stripe Dashboard → Events that receipt was sent
5. ✅ Test with different email provider (Gmail, Outlook, etc.)

### Issue: Receipt has wrong business name

**Fix:**
1. Go to Settings → **Business details**
2. Update **"Business name"**
3. Save changes
4. Future receipts will use new name

### Issue: Want to resend a receipt manually

**Steps:**
1. Go to Stripe Dashboard → **Payments**
2. Find the payment
3. Click the payment ID
4. Click **"Actions"** button (top-right)
5. Select **"Resend receipt"**
6. Enter email address
7. Click **"Send"**

---

## 📞 Resources

- **Stripe Receipt Docs:** https://stripe.com/docs/receipts
- **Email Settings Guide:** https://support.stripe.com/questions/email-customers-for-successful-payments
- **Customize Emails:** https://stripe.com/docs/receipts/customize

---

## ✨ What Customers Will Receive

**Email Example:**

```
From: St. Cloud Scoop <receipts@stripe.com>
Reply-To: scoop@stcscoop.com
Subject: Receipt from St. Cloud Scoop

[Your Logo]

Receipt
───────────────────────────────────

Thank you for submitting your event to St. Cloud Scoop!
Your event will be reviewed by our team within 24-48 hours.

Amount paid: $15.00
Date: October 7, 2025 at 2:35 PM

ITEMS
Fall Festival - Featured Event     $15.00
──────────────────────────────────────
Total                               $15.00

Paid with Visa ending in 4242

Receipt #: 1234-5678

Questions? Email us at scoop@stcscoop.com

───────────────────────────────────
St. Cloud Scoop
St. Cloud, MN
```

---

**That's it!** Receipts are now automatic. No code changes needed. ✅
