import React from 'react'
import { Badge } from './Badge'
import type { IssueStatus } from '@/types/issue-states'
import { ISSUE_STATUS_LABELS } from '@/types/issue-states'

export type { IssueStatus }

export interface StatusBadgeProps {
  status: IssueStatus
  className?: string
}

const statusConfig: Record<IssueStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  draft: { label: ISSUE_STATUS_LABELS.draft, variant: 'default' },
  processing: { label: ISSUE_STATUS_LABELS.processing, variant: 'info' },
  pending_phase2: { label: ISSUE_STATUS_LABELS.pending_phase2, variant: 'info' },
  in_review: { label: ISSUE_STATUS_LABELS.in_review, variant: 'warning' },
  changes_made: { label: ISSUE_STATUS_LABELS.changes_made, variant: 'info' },
  sent: { label: ISSUE_STATUS_LABELS.sent, variant: 'success' },
  failed: { label: ISSUE_STATUS_LABELS.failed, variant: 'danger' },
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const config = statusConfig[status] || statusConfig.draft

  return (
    <Badge
      variant={config.variant}
      className={className}
      aria-label={`issue status: ${config.label}`}
    >
      {config.label}
    </Badge>
  )
}
