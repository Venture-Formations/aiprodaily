/**
 * Analytics library — barrel export.
 * Consumers import from '@/lib/analytics'.
 */

export {
  computeIssueCTR,
  computeModuleCTR,
  computeIssueOpenRate,
  computePollResponseRate,
  computeFeedbackResponseRate,
  computeBounceRate,
  computeUnsubscribeRate,
} from './metrics'

export {
  ExcludedIpSet,
  isClickCountable,
  loadExcludedIps,
} from './bot-policy'

export type {
  DeliveryCounts,
  IssueEngagement,
  ModuleEngagement,
  LinkClickRow,
  ExcludedIpRow,
} from './types'
