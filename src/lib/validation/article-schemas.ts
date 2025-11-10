import { z } from 'zod'

/**
 * Schema for creating a manual article
 * Validates all required fields and types
 */
export const CreateManualArticleSchema = z.object({
  campaign_id: z.string().uuid('campaign_id must be a valid UUID'),
  title: z.string()
    .min(1, 'Title is required')
    .max(500, 'Title must be less than 500 characters'),
  content: z.string()
    .min(1, 'Content is required')
    .max(50000, 'Content must be less than 50,000 characters'),
  image_url: z.string()
    .url('image_url must be a valid URL')
    .optional()
    .nullable(),
  source_url: z.string()
    .url('source_url must be a valid URL')
    .optional()
    .nullable(),
  rank: z.number()
    .int('Rank must be an integer')
    .min(1, 'Rank must be at least 1')
    .max(100, 'Rank must be at most 100')
    .optional()
    .nullable()
})

/**
 * Schema for querying manual articles
 */
export const GetManualArticlesSchema = z.object({
  campaign_id: z.string().uuid('campaign_id must be a valid UUID')
})

/**
 * TypeScript types inferred from schemas
 * These automatically stay in sync with validation rules
 */
export type CreateManualArticleInput = z.infer<typeof CreateManualArticleSchema>
export type GetManualArticlesInput = z.infer<typeof GetManualArticlesSchema>
