/**
 * Migration Script: Copy images to new public/images/ folder structure
 *
 * This script copies existing images from old GitHub paths to new paths.
 * Old files are NOT deleted - they remain for backwards compatibility.
 *
 * Usage:
 *   npx ts-node scripts/migrate-images-to-public.ts
 *
 * Or with tsx:
 *   npx tsx scripts/migrate-images-to-public.ts
 *
 * Required environment variables:
 *   - GITHUB_TOKEN
 *   - GITHUB_OWNER (or defaults to 'Venture-Formations')
 *   - GITHUB_REPO (or defaults to 'aiprodaily')
 */

import { Octokit } from '@octokit/rest'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config()

interface MigrationMapping {
  oldPath: string
  newPath: string
  description: string
}

const MIGRATION_MAPPINGS: MigrationMapping[] = [
  {
    oldPath: 'advertisements',
    newPath: 'public/images/advertisements',
    description: 'Advertisement images'
  },
  {
    oldPath: 'business',
    newPath: 'public/images/business',
    description: 'Business branding images'
  },
  {
    oldPath: 'newsletter-images',
    newPath: 'public/images/newsletter',
    description: 'Newsletter article images'
  },
  {
    oldPath: 'images/library',
    newPath: 'public/images/library',
    description: 'Image library variants'
  },
  {
    oldPath: 'apps/marketing/public',
    newPath: 'public/images/accounting_website',
    description: 'Marketing/accounting website assets'
  }
]

// Social media icons at root level
const ROOT_SOCIAL_ICONS = [
  'facebook_light.png',
  'instagram_light.png',
  'linkedin_light.png',
  'twitter_light.png'
]

class ImageMigration {
  private octokit: Octokit
  private owner: string
  private repo: string
  private stats = {
    copied: 0,
    skipped: 0,
    errors: 0
  }

  constructor() {
    const token = process.env.GITHUB_TOKEN
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required')
    }

    this.octokit = new Octokit({ auth: token })
    this.owner = process.env.GITHUB_OWNER || 'Venture-Formations'
    this.repo = process.env.GITHUB_REPO || 'aiprodaily'

    // Handle repo format like "Owner/Repo"
    if (this.repo.includes('/')) {
      const parts = this.repo.split('/')
      this.owner = parts[0]
      this.repo = parts[1]
    }

    console.log(`\n📦 GitHub Repository: ${this.owner}/${this.repo}\n`)
  }

  async run(): Promise<void> {
    console.log('🚀 Starting image migration to public/images/ structure...\n')
    console.log('=' .repeat(60))

    // Migrate folder-based images
    for (const mapping of MIGRATION_MAPPINGS) {
      await this.migrateFolder(mapping)
    }

    // Migrate root-level social icons
    await this.migrateSocialIcons()

    // Print summary
    this.printSummary()
  }

  private async migrateFolder(mapping: MigrationMapping): Promise<void> {
    console.log(`\n📁 ${mapping.description}`)
    console.log(`   From: ${mapping.oldPath}/`)
    console.log(`   To:   ${mapping.newPath}/`)
    console.log('-'.repeat(60))

    try {
      // Get files from old path
      const files = await this.listFiles(mapping.oldPath)

      if (files.length === 0) {
        console.log('   ⚠️  No files found in source folder')
        return
      }

      console.log(`   Found ${files.length} files to migrate`)

      for (const file of files) {
        await this.copyFile(
          `${mapping.oldPath}/${file.name}`,
          `${mapping.newPath}/${file.name}`,
          file.sha
        )
      }

    } catch (error: any) {
      if (error.status === 404) {
        console.log('   ⚠️  Source folder does not exist, skipping')
      } else {
        console.error(`   ❌ Error: ${error.message}`)
        this.stats.errors++
      }
    }
  }

  private async migrateSocialIcons(): Promise<void> {
    console.log(`\n📁 Social media icons`)
    console.log(`   From: / (root level)`)
    console.log(`   To:   public/images/social/`)
    console.log('-'.repeat(60))

    for (const filename of ROOT_SOCIAL_ICONS) {
      try {
        // Get file from root
        const { data } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: filename
        })

        if ('sha' in data) {
          await this.copyFile(
            filename,
            `public/images/social/${filename}`,
            data.sha
          )
        }
      } catch (error: any) {
        if (error.status === 404) {
          console.log(`   ⚠️  ${filename} not found, skipping`)
        } else {
          console.error(`   ❌ Error copying ${filename}: ${error.message}`)
          this.stats.errors++
        }
      }
    }
  }

  private async listFiles(path: string): Promise<Array<{ name: string; sha: string }>> {
    const { data } = await this.octokit.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path
    })

    if (!Array.isArray(data)) {
      return []
    }

    // Filter for files only (not directories), and image files
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
    return data
      .filter(item => {
        if (item.type !== 'file') return false
        const ext = item.name.toLowerCase().slice(item.name.lastIndexOf('.'))
        return imageExtensions.includes(ext)
      })
      .map(item => ({ name: item.name, sha: item.sha }))
  }

  private async copyFile(oldPath: string, newPath: string, sha: string): Promise<void> {
    const filename = oldPath.split('/').pop() || oldPath

    try {
      // Check if file already exists at new path
      try {
        await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: newPath
        })
        console.log(`   ⏭️  ${filename} (already exists)`)
        this.stats.skipped++
        return
      } catch (error: any) {
        if (error.status !== 404) {
          throw error
        }
        // File doesn't exist, proceed with copy
      }

      // Get the file content from old path
      const { data: fileData } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: oldPath
      })

      if (!('content' in fileData)) {
        throw new Error('Could not get file content')
      }

      // Create file at new path
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: newPath,
        message: `Migrate image to public/images/: ${filename}`,
        content: fileData.content.replace(/\n/g, '') // Remove newlines from base64
      })

      console.log(`   ✅ ${filename}`)
      this.stats.copied++

      // Small delay to avoid rate limiting
      await this.delay(100)

    } catch (error: any) {
      console.error(`   ❌ ${filename}: ${error.message}`)
      this.stats.errors++
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(60))
    console.log('📊 Migration Summary')
    console.log('='.repeat(60))
    console.log(`   ✅ Copied:  ${this.stats.copied} files`)
    console.log(`   ⏭️  Skipped: ${this.stats.skipped} files (already exist)`)
    console.log(`   ❌ Errors:  ${this.stats.errors} files`)
    console.log('='.repeat(60))

    if (this.stats.errors > 0) {
      console.log('\n⚠️  Some files failed to migrate. Check the errors above.')
    } else if (this.stats.copied > 0) {
      console.log('\n✅ Migration completed successfully!')
      console.log('   Old files remain in place for backwards compatibility.')
      console.log('   New uploads will use the public/images/ paths.')
    } else {
      console.log('\n✅ All files were already migrated!')
    }
  }
}

// Run migration
async function main() {
  try {
    const migration = new ImageMigration()
    await migration.run()
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

main()
