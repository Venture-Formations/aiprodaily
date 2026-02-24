/**
 * Data Access Layer — Barrel Export
 *
 * Import DAL functions from here:
 *   import { getIssueById, createIssue } from '@/lib/dal'
 */

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
