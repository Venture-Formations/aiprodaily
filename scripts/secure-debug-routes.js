/**
 * Script to add authentication to all debug routes that perform mutations
 * Run with: node scripts/secure-debug-routes.js
 */

const fs = require('fs')
const path = require('path')

// List of mutation routes that need security
const mutationRoutes = [
  'activate-events',
  'add-custom-default-column',
  'add-poll-section',
  'add-road-work-section',
  'add-skip-column',
  'apply-position-migration',
  'clear-campaign-events',
  'clear-road-work',
  'fix-all-prompts',
  'fix-rating-constraint',
  'fix-tomorrow-campaign',
  'fix-wordle-data',
  'force-weather-regen',
  'manual-populate-events',
  'migrate-images-schema',
  'migrate-newsletter-sections',
  'populate-campaign-events',
  'populate-weather',
  'populate-wordle',
  'regenerate-dining',
  'reset-daily-flags',
  'setup-road-work-database',
  'test-status-update',
  'update-weather-manual',
  'update-wordle-manual',
  'update-wordle-direct'
]

const debugDir = path.join(__dirname, '..', 'src', 'app', 'api', 'debug')

let secured = 0
let skipped = 0
let errors = 0

mutationRoutes.forEach(routeName => {
  const routePath = path.join(debugDir, routeName, 'route.ts')

  if (!fs.existsSync(routePath)) {
    console.log(`⏭️  Skipped ${routeName} - file not found`)
    skipped++
    return
  }

  try {
    let content = fs.readFileSync(routePath, 'utf-8')

    // Check if already secured
    if (content.includes('validateDebugAuth') || content.includes('validateDebugSecret')) {
      console.log(`✅ Already secured: ${routeName}`)
      return
    }

    // Add import
    if (!content.includes("from '@/lib/debug-auth'")) {
      content = content.replace(
        /^(import .* from ['"]next\/server['"])/m,
        `$1\nimport { validateDebugAuth } from '@/lib/debug-auth'`
      )
    }

    // Add auth check to each handler function (GET, POST, PATCH, DELETE)
    const handlers = ['GET', 'POST', 'PATCH', 'DELETE', 'PUT']
    handlers.forEach(method => {
      const testRegex = new RegExp(`export async function ${method}\\(request[^)]*\\) \\{`)
      if (testRegex.test(content)) {
        const replaceRegex = new RegExp(`export async function ${method}\\(request[^)]*\\) \\{`)
        content = content.replace(
          replaceRegex,
          `export async function ${method}(request: NextRequest) {\n  // Validate authentication\n  const authResult = validateDebugAuth(request)\n  if (!authResult.authorized) {\n    return authResult.response\n  }\n`
        )
      }
    })

    // Write back
    fs.writeFileSync(routePath, content, 'utf-8')
    console.log(`🔒 Secured: ${routeName}`)
    secured++
  } catch (error) {
    console.error(`❌ Error securing ${routeName}:`, error.message)
    errors++
  }
})

console.log(`\n📊 Summary:`)
console.log(`   🔒 Secured: ${secured} routes`)
console.log(`   ⏭️  Skipped: ${skipped} routes`)
console.log(`   ❌ Errors: ${errors} routes`)
console.log(`\n💡 Next steps:`)
console.log(`   1. Set DEBUG_SECRET in Vercel environment variables`)
console.log(`   2. Test routes with: curl -H "Authorization: Bearer YOUR_SECRET" https://your-app.com/api/debug/route-name`)
console.log(`   3. In development, routes work without auth\n`)
