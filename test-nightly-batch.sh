#!/bin/bash

# Test Nightly Batch Script
# Usage: ./test-nightly-batch.sh

echo "======================================"
echo "Testing Nightly Batch (Hybrid Mode)"
echo "======================================"
echo ""

# Configuration
DOMAIN="https://aiaccountingdaily.com"
CRON_SECRET="${CRON_SECRET:-YOUR_CRON_SECRET_HERE}"

echo "Step 1: Check for unassigned posts in pool"
echo "--------------------------------------------"
echo "Run this SQL in Supabase:"
echo "SELECT COUNT(*) FROM rss_posts WHERE campaign_id IS NULL;"
echo ""
read -p "Press Enter when you've verified there are unassigned posts..."

echo ""
echo "Step 2: Triggering nightly batch..."
echo "--------------------------------------------"
RESPONSE=$(curl -s -X POST "$DOMAIN/api/rss/process" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json")

echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

echo "Step 3: Check Vercel logs"
echo "--------------------------------------------"
echo "Go to: https://vercel.com/your-team/your-project/logs"
echo "Look for:"
echo "  - [Step 10] Stage 1 unassignment logs"
echo "  - Article generation completion"
echo "  - No timeout errors"
echo ""

echo "Step 4: Verify in database"
echo "--------------------------------------------"
echo "Run these SQL queries in Supabase:"
echo ""
echo "-- Check campaign was created:"
echo "SELECT * FROM newsletter_campaigns ORDER BY created_at DESC LIMIT 1;"
echo ""
echo "-- Check articles were generated:"
echo "SELECT COUNT(*) FROM articles WHERE campaign_id = (SELECT id FROM newsletter_campaigns ORDER BY created_at DESC LIMIT 1);"
echo "SELECT COUNT(*) FROM secondary_articles WHERE campaign_id = (SELECT id FROM newsletter_campaigns ORDER BY created_at DESC LIMIT 1);"
echo ""
echo "-- Check Stage 1 unassignment worked (should see ~12 posts back in pool):"
echo "SELECT COUNT(*) FROM rss_posts WHERE campaign_id IS NULL;"
echo ""
echo "======================================"
echo "Test Complete!"
echo "======================================"
