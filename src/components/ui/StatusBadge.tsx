import React from 'react'
import { Badge } from './Badge'

export type IssueStatus = 'draft' | 'in_review' | 'changes_made' | 'ready_to_send' | 'sent' | 'failed'

export interface StatusBadgeProps {
  status: IssueStatus
  className?: string
}

const statusConfig: Record<IssueStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  draft: { label: 'Draft', variant: 'default' },
  in_review: { label: 'In Review', variant: 'warning' },
  changes_made: { label: 'Changes Made', variant: 'info' },
  ready_to_send: { label: 'Ready to Send', variant: 'success' },
  sent: { label: 'Sent', variant: 'success' },
  failed: { label: 'Failed', variant: 'danger' },
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
