# Google Cloud Setup Checklist

## 🚨 **Most Likely Issues**

### 1. **APIs Not Enabled**
Go to: https://console.cloud.google.com/apis/dashboard?project=st-cloud-scoop

**Required APIs to enable:**
- ✅ Cloud Vision API
- ⚠️ **Web Detection API** (this might be the missing piece)
- ⚠️ **Cloud Search API** (for better web results)

**How to enable:**
1. Go to APIs & Services → Library
2. Search for "Vision API" and "Web Detection"
3. Click "Enable" on each

### 2. **Billing Issues**
Go to: https://console.cloud.google.com/billing?project=st-cloud-scoop

**Check:**
- ✅ Billing account linked to project
- ⚠️ **Sufficient credits/budget**
- ⚠️ **No quota limits reached**

Web Detection specifically may have lower quotas or require billing.

### 3. **Vision API Quotas**
Go to: https://console.cloud.google.com/iam-admin/quotas?project=st-cloud-scoop

**Check quotas for:**
- Vision API requests per minute
- **Web Detection requests** (separate quota)
- Image analysis requests

### 4. **Service Account Permissions**

Go to: https://console.cloud.google.com/iam-admin/iam?project=st-cloud-scoop

**Check that the service account has:**
- Cloud Vision API User role
- **Web Detection permissions**

## 🔍 **Quick Diagnostic**

1. **Check Project in Console**: https://console.cloud.google.com/home/dashboard?project=st-cloud-scoop
2. **Verify billing is active**
3. **Enable all Vision APIs**
4. **Check quotas aren't exceeded**

## 🧪 **Expected Results**

When working correctly, Vision API's Web Detection should return:
- `pagesWithMatchingImages`: 10-50+ results
- `webEntities`: 5-20+ entities
- `visuallySimilarImages`: 10+ similar images

If you're only getting 1 result, it's likely an API configuration issue rather than a code issue.