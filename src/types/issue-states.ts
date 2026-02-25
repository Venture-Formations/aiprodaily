/**
 * Issue Status State Machine
 *
 * Single source of truth for issue-level status values, transitions,
 * and validation helpers. Mirrors the pattern in workflow-states.ts.
 *
 * DB constraint allows: draft, processing, pending_phase2, in_review,
 * changes_made, ready_to_send, sent, failed
 *
 * `ready_to_send` is excluded from the canonical type — no code path
 * ever sets it and it exists only as a legacy DB enum value.
 */

export type IssueStatus =
  | 'draft'
  | 'processing'
  | 'pending_phase2'
  | 'in_review'
  | 'changes_made'
  | 'sent'
  | 'failed'

/** Runtime array for Zod enums and validation loops */
export const ISSUE_STATUSES: readonly IssueStatus[] = [
  'draft',
  'processing',
  'pending_phase2',
  'in_review',
  'changes_made',
  'sent',
  'failed',
] as const

/** Valid transitions: from -> allowed destinations */
export const ISSUE_TRANSITIONS: Record<IssueStatus, readonly IssueStatus[]> = {
  processing:     ['pending_phase2', 'draft', 'failed'],
  pending_phase2: ['processing', 'failed'],
  draft:          ['in_review', 'processing', 'failed'],
  in_review:      ['changes_made', 'sent', 'processing', 'failed'],
  changes_made:   ['in_review', 'sent', 'processing', 'failed'],
  sent:           [],                   // terminal
  failed:         ['processing'],
}

/** Human-readable labels for UI display */
export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  draft:          'Draft',
  processing:     'Processing',
  pending_phase2: 'Pending Phase 2',
  in_review:      'In Review',
  changes_made:   'Changes Made',
  sent:           'Sent',
  failed:         'Failed',
}

/** Check whether a transition from `from` to `to` is allowed */
export function canTransition(from: IssueStatus, to: IssueStatus): boolean {
  return ISSUE_TRANSITIONS[from].includes(to)
}

/** Throws if the transition is not allowed */
export function assertTransition(from: IssueStatus, to: IssueStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid issue status transition: ${from} -> ${to}. ` +
      `Allowed from ${from}: [${ISSUE_TRANSITIONS[from].join(', ')}]`
    )
  }
}

/** Statuses where the issue content is user-editable */
export function isEditableStatus(status: IssueStatus): boolean {
  return status === 'draft' || status === 'in_review' || status === 'changes_made'
}

/** Whether the status is terminal (no further transitions) */
export function isTerminalStatus(status: IssueStatus): boolean {
  return status === 'sent'
}
