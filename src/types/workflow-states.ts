/**
 * Workflow state machine for RSS processing
 * Each state represents a stage in the workflow
 */

export type WorkflowState =
  | 'pending_archive'      // Initial state, ready to start
  | 'archiving'            // Archive step in progress
  | 'pending_fetch_feeds'  // Ready to fetch RSS feeds
  | 'fetching_feeds'       // Fetch feeds step in progress
  | 'pending_extract'      // Ready to extract articles
  | 'extracting'           // Extract articles step in progress
  | 'pending_score'        // Ready to score posts
  | 'scoring'              // Score posts step in progress
  | 'pending_generate'     // Ready to generate articles
  | 'generating'           // Generate articles step in progress
  | 'pending_finalize'     // Ready to finalize
  | 'finalizing'           // Finalize step in progress
  | 'complete'             // Workflow completed successfully
  | 'failed'               // Workflow failed

/**
 * State transition map - defines valid next states
 */
export const STATE_TRANSITIONS: Record<WorkflowState, WorkflowState> = {
  'pending_archive': 'archiving',
  'archiving': 'pending_fetch_feeds',
  'pending_fetch_feeds': 'fetching_feeds',
  'fetching_feeds': 'pending_extract',
  'pending_extract': 'extracting',
  'extracting': 'pending_score',
  'pending_score': 'scoring',
  'scoring': 'pending_generate',
  'pending_generate': 'generating',
  'generating': 'pending_finalize',
  'pending_finalize': 'finalizing',
  'finalizing': 'complete',
  'complete': 'complete',
  'failed': 'failed'
}

/**
 * Step endpoints for each pending state
 */
export const STEP_ENDPOINTS: Record<string, string> = {
  'pending_archive': '/api/rss/steps/archive',
  'pending_fetch_feeds': '/api/rss/steps/fetch-feeds',
  'pending_extract': '/api/rss/steps/extract-articles',
  'pending_score': '/api/rss/steps/score-posts',
  'pending_generate': '/api/rss/steps/generate-articles',
  'pending_finalize': '/api/rss/steps/finalize'
}

/**
 * Human-readable step names
 */
export const STEP_NAMES: Record<WorkflowState, string> = {
  'pending_archive': 'Ready to Archive',
  'archiving': 'Archiving Old Data',
  'pending_fetch_feeds': 'Ready to Fetch Feeds',
  'fetching_feeds': 'Fetching RSS Feeds',
  'pending_extract': 'Ready to Extract Articles',
  'extracting': 'Extracting Article Text',
  'pending_score': 'Ready to Score Posts',
  'scoring': 'Scoring Posts with AI',
  'pending_generate': 'Ready to Generate Articles',
  'generating': 'Generating Newsletter Articles',
  'pending_finalize': 'Ready to Finalize',
  'finalizing': 'Finalizing issue',
  'complete': 'Complete',
  'failed': 'Failed'
}
