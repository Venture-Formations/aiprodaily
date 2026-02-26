import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiHandler } from '@/lib/api-handler'
import { provisionPublication } from '@/lib/provisioner'

const provisionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  subdomain: z.string().max(100).optional(),
  contactEmail: z.string().email('Invalid email'),
  senderName: z.string().min(1).max(100),
  fromEmail: z.string().email('Invalid email'),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a hex color like #1C293D'),
  websiteDomain: z.string().min(1, 'Website domain is required').max(200),
  logoUrl: z.string().max(500).optional().default(''),
  headerImageUrl: z.string().max(500).optional().default(''),
  facebookEnabled: z.boolean().optional().default(false),
  facebookUrl: z.string().max(500).optional().default(''),
  twitterEnabled: z.boolean().optional().default(false),
  twitterUrl: z.string().max(500).optional().default(''),
  linkedinEnabled: z.boolean().optional().default(false),
  linkedinUrl: z.string().max(500).optional().default(''),
  instagramEnabled: z.boolean().optional().default(false),
  instagramUrl: z.string().max(500).optional().default(''),
  mailerliteMainGroupId: z.string().max(200).optional().default(''),
  mailerliteReviewGroupId: z.string().max(200).optional().default(''),
  mailerliteTestGroupId: z.string().max(200).optional().default(''),
  mailerliteSignupGroupId: z.string().max(200).optional().default(''),
})

type ProvisionInput = z.infer<typeof provisionSchema>

export const POST = withApiHandler<ProvisionInput>(
  { authTier: 'authenticated', inputSchema: provisionSchema, logContext: 'publications/provision' },
  async ({ input, logger }) => {
    logger.info({ slug: input.slug }, 'Provisioning new publication')

    const result = await provisionPublication(input)

    logger.info({ publicationId: result.publicationId, slug: result.slug }, 'Publication provisioned')

    return NextResponse.json({ success: true, ...result })
  }
)
