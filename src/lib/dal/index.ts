/**
 * Data Access Layer — Barrel Export
 *
 * Import DAL functions from here:
 *   import { getIssueById, createIssue } from '@/lib/dal'
 */

// Issues DAL
export {
  getIssueById,
  getIssueByDate,
  listIssues,
  getIssueWithArticles,
  getIssuePublicationId,
  createIssue,
  updateIssueStatus,
  updateWorkflowState,
  failWorkflowState,
  markIssueSent,
  updateWelcomeSection,
  updateSubjectLine,
} from './issues'

// Analytics DAL
export {
  getDeliveryCounts,
  getUniqueClickers,
  getIssueEngagement,
  getModuleEngagement,
} from './analytics'

// Posts DAL — rss_posts + post_ratings
export {
  POST_WITH_RATINGS_BRIEF,
  getExistingExternalIds,
  listPostsByIssue,
  listPostsForScoring,
  listAssignedPostsForModule,
  listExtractedPostsByIds,
  listPendingExtractionPosts,
  listPostsForExtractionByIssue,
  getRatedPostIds,
  insertPost,
  updatePostExtraction,
  assignPostsToIssue,
  unassignPosts,
  applyExtractionResult,
  insertPostRating,
} from './posts'

// Articles DAL — module_articles + manual_articles
export {
  MODULE_ARTICLE_COLUMNS,
  MODULE_ARTICLE_BODY_GEN_SELECT,
  MODULE_ARTICLE_FACT_CHECK_SELECT,
  MANUAL_ARTICLE_COLUMNS,
  MANUAL_ARTICLE_WITH_CATEGORY_SELECT,
  listModuleArticlesByIssue,
  moduleArticleExists,
  listArticlesNeedingBody,
  listArticlesNeedingFactCheck,
  insertModuleArticle,
  updateModuleArticleContent,
  updateModuleArticleFactCheck,
  listRecentlyFeaturedTickers,
  listManualArticlesByPublication,
  findNextAvailableSlug,
  insertManualArticle,
  updateManualArticle,
  deleteManualArticle,
} from './articles'
export type { NewModuleArticle, ManualArticleRow, NewManualArticle } from './articles'

// Dedup DAL — duplicate_groups + duplicate_posts
export {
  isIssueDeduplicated,
  listDuplicateGroupIdsByIssue,
  listDuplicatePostIdsByGroups,
  listDuplicatePostsForGroup,
  createDuplicateGroup,
  addDuplicatePostToGroup,
  storeDeduplicationResult,
} from './dedup'
export type { NewDuplicatePost, DeduplicationResultInput, DeduplicationResultOutput } from './dedup'

// Excluded IPs DAL — bot/honeypot exclusion list
export { getExcludedIPs } from './excluded-ips'

// Pagination helper — most callers want fetchAllPaginated directly
export { fetchAllPaginated } from './paginate'
export type { FetchAllPaginatedOptions } from './paginate'
