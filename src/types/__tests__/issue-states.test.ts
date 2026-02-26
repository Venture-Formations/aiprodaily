import { describe, it, expect } from 'vitest'
import {
  canTransition,
  assertTransition,
  isEditableStatus,
  isTerminalStatus,
  ISSUE_STATUSES,
  ISSUE_TRANSITIONS,
  ISSUE_STATUS_LABELS,
  type IssueStatus,
} from '../issue-states'

// ---------------------------------------------------------------------------
// ISSUE_STATUSES
// ---------------------------------------------------------------------------
describe('ISSUE_STATUSES', () => {
  it('contains all 7 statuses', () => {
    expect(ISSUE_STATUSES).toHaveLength(7)
  })

  it('contains the exact expected values', () => {
    expect(ISSUE_STATUSES).toEqual([
      'draft',
      'processing',
      'pending_phase2',
      'in_review',
      'changes_made',
      'sent',
      'failed',
    ])
  })

  it('matches the keys of ISSUE_TRANSITIONS', () => {
    const transitionKeys = Object.keys(ISSUE_TRANSITIONS).sort()
    const statusesSorted = [...ISSUE_STATUSES].sort()
    expect(transitionKeys).toEqual(statusesSorted)
  })
})

// ---------------------------------------------------------------------------
// ISSUE_STATUS_LABELS
// ---------------------------------------------------------------------------
describe('ISSUE_STATUS_LABELS', () => {
  it('has a label for every status', () => {
    for (const status of ISSUE_STATUSES) {
      expect(ISSUE_STATUS_LABELS[status]).toBeDefined()
      expect(typeof ISSUE_STATUS_LABELS[status]).toBe('string')
      expect(ISSUE_STATUS_LABELS[status].length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// canTransition
// ---------------------------------------------------------------------------
describe('canTransition', () => {
  // Valid transitions (sample of key ones)
  const validPairs: [IssueStatus, IssueStatus][] = [
    ['processing', 'pending_phase2'],
    ['processing', 'draft'],
    ['processing', 'failed'],
    ['pending_phase2', 'processing'],
    ['pending_phase2', 'failed'],
    ['draft', 'in_review'],
    ['draft', 'processing'],
    ['draft', 'failed'],
    ['in_review', 'changes_made'],
    ['in_review', 'sent'],
    ['in_review', 'processing'],
    ['in_review', 'failed'],
    ['changes_made', 'in_review'],
    ['changes_made', 'sent'],
    ['changes_made', 'processing'],
    ['changes_made', 'failed'],
    ['failed', 'processing'],
  ]

  it.each(validPairs)('%s -> %s is allowed', (from, to) => {
    expect(canTransition(from, to)).toBe(true)
  })

  // Invalid transitions
  const invalidPairs: [IssueStatus, IssueStatus][] = [
    ['sent', 'draft'],
    ['sent', 'processing'],
    ['sent', 'failed'],
    ['sent', 'in_review'],
    ['draft', 'sent'],
    ['draft', 'pending_phase2'],
    ['draft', 'changes_made'],
    ['processing', 'in_review'],
    ['processing', 'sent'],
    ['processing', 'changes_made'],
    ['failed', 'draft'],
    ['failed', 'sent'],
    ['failed', 'in_review'],
  ]

  it.each(invalidPairs)('%s -> %s is not allowed', (from, to) => {
    expect(canTransition(from, to)).toBe(false)
  })

  it('sent has no valid transitions (terminal)', () => {
    for (const status of ISSUE_STATUSES) {
      expect(canTransition('sent', status)).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// assertTransition
// ---------------------------------------------------------------------------
describe('assertTransition', () => {
  it('does not throw for a valid transition', () => {
    expect(() => assertTransition('draft', 'in_review')).not.toThrow()
  })

  it('throws for an invalid transition', () => {
    expect(() => assertTransition('sent', 'draft')).toThrow(
      /Invalid issue status transition: sent -> draft/
    )
  })

  it('includes allowed destinations in error message', () => {
    expect(() => assertTransition('draft', 'sent')).toThrow(
      /Allowed from draft: \[in_review, processing, failed\]/
    )
  })
})

// ---------------------------------------------------------------------------
// isEditableStatus
// ---------------------------------------------------------------------------
describe('isEditableStatus', () => {
  it('returns true for draft', () => {
    expect(isEditableStatus('draft')).toBe(true)
  })

  it('returns true for in_review', () => {
    expect(isEditableStatus('in_review')).toBe(true)
  })

  it('returns true for changes_made', () => {
    expect(isEditableStatus('changes_made')).toBe(true)
  })

  const nonEditable: IssueStatus[] = ['processing', 'pending_phase2', 'sent', 'failed']
  it.each(nonEditable)('returns false for %s', (status) => {
    expect(isEditableStatus(status)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isTerminalStatus
// ---------------------------------------------------------------------------
describe('isTerminalStatus', () => {
  it('returns true only for sent', () => {
    expect(isTerminalStatus('sent')).toBe(true)
  })

  const nonTerminal: IssueStatus[] = [
    'draft',
    'processing',
    'pending_phase2',
    'in_review',
    'changes_made',
    'failed',
  ]
  it.each(nonTerminal)('returns false for %s', (status) => {
    expect(isTerminalStatus(status)).toBe(false)
  })
})
