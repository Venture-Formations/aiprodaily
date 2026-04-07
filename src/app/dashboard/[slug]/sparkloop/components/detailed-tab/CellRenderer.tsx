'use client'

import type { Recommendation } from './types'
import { fmtDollars, getSourceColor, getPopupExclusionReason } from './utils'

interface CellRendererProps {
  rec: Recommendation
  columnKey: string
  dateRangeActive: boolean
  onToggleModuleEligible: (rec: Recommendation) => void
}

export function CellRenderer({ rec, columnKey, dateRangeActive, onToggleModuleEligible }: CellRendererProps) {
  return <>{renderCellContent(rec, columnKey, dateRangeActive, onToggleModuleEligible)}</>
}

function renderCellContent(
  rec: Recommendation,
  columnKey: string,
  dateRangeActive: boolean,
  onToggleModuleEligible: (rec: Recommendation) => void,
): React.ReactNode {
  switch (columnKey) {
    case 'publication_name': {
      const popupExcluded = getPopupExclusionReason(rec) !== null
      return (
        <div className="flex items-center gap-2">
          {rec.publication_logo && (
            <img src={rec.publication_logo} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
          )}
          <span className="truncate">
            {popupExcluded && <span className="text-gray-400" title="Not in popup">*</span>}
            {rec.publication_name}
          </span>
        </div>
      )
    }

    case 'status': {
      if (rec.excluded) {
        return <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700">{rec.excluded_reason || 'excluded'}</span>
      }
      if (rec.status === 'paused') {
        return <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-yellow-100 text-yellow-700">{rec.paused_reason || 'paused'}</span>
      }
      if (rec.status === 'archived') {
        return <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600">Archived</span>
      }
      if (rec.status === 'awaiting_approval') {
        return <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700">Awaiting Approval</span>
      }
      const popupReason = getPopupExclusionReason(rec)
      return (
        <div>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-green-100 text-green-700">Active</span>
          {popupReason && (
            <div className="text-[9px] text-gray-400 mt-0.5">({popupReason})</div>
          )}
        </div>
      )
    }

    case 'cpa':
      return rec.cpa !== null ? `$${fmtDollars(rec.cpa / 100)}` : '-'

    case 'max_payout':
      return rec.max_payout !== null ? `$${fmtDollars(rec.max_payout / 100)}` : '-'

    case 'screening_period':
      return rec.screening_period ? `${rec.screening_period}d` : '-'

    case 'sparkloop_rcr':
      if (rec.sparkloop_rcr === null) return '-'
      if (rec.rcr_source === 'override_with_sl') {
        return <span className="text-red-600 font-medium line-through" title={`Override (${rec.effective_rcr.toFixed(0)}%) is replacing this SL RCR`}>{rec.sparkloop_rcr.toFixed(0)}%</span>
      }
      return `${rec.sparkloop_rcr.toFixed(0)}%`

    case 'our_rcr':
      return rec.our_rcr !== null
        ? <span className="text-blue-600 font-medium">{rec.our_rcr.toFixed(1)}%</span>
        : '-'

    case 'rcr_14d':
      return rec.rcr_14d !== null
        ? <span className="text-green-600 font-medium" title={`${rec.confirms_gained_14d} confirms / ${rec.sends_14d} sends in 14D window`}>{rec.rcr_14d.toFixed(1)}%</span>
        : <span className="text-gray-400" title="Insufficient data (need 14+ days of snapshots and 5+ sends)">-</span>

    case 'rcr_30d':
      return rec.rcr_30d !== null
        ? <span className="text-green-600 font-medium" title={`${rec.confirms_gained_30d} confirms / ${rec.sends_30d} sends in 30D window`}>{rec.rcr_30d.toFixed(1)}%</span>
        : <span className="text-gray-400" title="Insufficient data (need 30+ days of snapshots and 5+ sends)">-</span>

    case 'slippage_14d': {
      if (rec.slippage_14d === null) return <span className="text-gray-400" title="Insufficient data">-</span>
      const color14 = rec.slippage_14d < 15 ? 'text-green-600' : rec.slippage_14d < 30 ? 'text-yellow-600' : 'text-red-600'
      return <span className={`${color14} font-medium`} title={`${rec.sends_14d} sends - ${rec.confirms_gained_14d} confirms = unaccounted subs in 14D`}>{rec.slippage_14d.toFixed(1)}%</span>
    }

    case 'slippage_30d': {
      if (rec.slippage_30d === null) return <span className="text-gray-400" title="Insufficient data">-</span>
      const color30 = rec.slippage_30d < 15 ? 'text-green-600' : rec.slippage_30d < 30 ? 'text-yellow-600' : 'text-red-600'
      return <span className={`${color30} font-medium`} title={`${rec.sends_30d} sends - ${rec.confirms_gained_30d} confirms = unaccounted subs in 30D`}>{rec.slippage_30d.toFixed(1)}%</span>
    }

    case 'alltime_slip': {
      if (rec.matured_sends === 0) return <span className="text-gray-400" title="No matured sends (all within screening period)">-</span>
      const colorAt = rec.effective_slip < 15 ? 'text-green-600' : rec.effective_slip < 30 ? 'text-yellow-600' : 'text-red-600'
      const isOverride = rec.slip_source === 'override' || rec.slip_source === 'override_with_data'
      const overrideColor = rec.slip_source === 'override_with_data' ? 'text-red-600' : rec.slip_source === 'override' ? 'text-orange-600' : ''
      return (
        <div>
          <span className={`${isOverride ? overrideColor : colorAt} font-medium`} title={`Matured sends: ${rec.matured_sends} (sent >${rec.screening_period || 14}d ago), Confirmed: ${rec.sparkloop_confirmed}, Rejected: ${rec.sparkloop_rejected}. Slip = Matured - (Confirmed + Rejected). Effective: ${rec.effective_slip.toFixed(1)}% (${rec.slip_source})`}>
            {rec.effective_slip.toFixed(1)}%
          </span>
          {isOverride && <span className="text-[9px] ml-0.5" title={`Calculated: ${rec.alltime_slip.toFixed(1)}%`}>ovr</span>}
        </div>
      )
    }

    case 'effective_rcr':
      return <span className={getSourceColor(rec.rcr_source)}>{rec.effective_rcr.toFixed(1)}%</span>

    case 'rcr_source':
      if (rec.rcr_source === 'override_with_sl') return <span className="text-red-600" title="Override active — SL RCR available">override*</span>
      if (rec.rcr_source === 'override') return <span className="text-orange-600">override</span>
      if (rec.rcr_source === 'ours') return <span className="text-blue-600">ours</span>
      if (rec.rcr_source === 'sparkloop') return 'SL'
      return 'default'

    case 'our_cr':
      return rec.our_cr !== null
        ? <span className={`font-medium ${dateRangeActive ? 'text-purple-600' : 'text-blue-600'}`}>{rec.our_cr.toFixed(1)}%</span>
        : '-'

    case 'page_cr':
      return rec.page_cr !== null
        ? <span className={`font-medium ${dateRangeActive ? 'text-purple-600' : 'text-teal-600'}`}>{rec.page_cr.toFixed(1)}%</span>
        : '-'

    case 'effective_cr':
      return <span className={getSourceColor(rec.cr_source)}>{rec.effective_cr.toFixed(1)}%</span>

    case 'cr_source':
      if (rec.cr_source === 'override_with_data') return <span className="text-red-600" title="Override active — Our CR available">override*</span>
      if (rec.cr_source === 'override') return <span className="text-orange-600">override</span>
      if (rec.cr_source === 'ours') return <span className="text-blue-600">ours</span>
      return 'default'

    case 'calculated_score': {
      const crOvr = rec.override_cr !== null && rec.override_cr !== undefined
      const rcrOvr = rec.override_rcr !== null && rec.override_rcr !== undefined
      const slipOvr = rec.override_slip !== null && rec.override_slip !== undefined
      const parts: string[] = []
      if (crOvr) parts.push(`CR:${rec.override_cr}%`)
      if (rcrOvr) parts.push(`RCR:${rec.override_rcr}%`)
      if (slipOvr) parts.push(`Slip:${rec.override_slip}%`)
      const hasRedOverride = rec.rcr_source === 'override_with_sl' || rec.cr_source === 'override_with_data' || rec.slip_source === 'override_with_data'
      return (
        <div>
          <span className="font-mono font-medium">${rec.calculated_score.toFixed(4)}</span>
          {parts.length > 0 && (
            <div className={`text-[9px] mt-0.5 ${hasRedOverride ? 'text-red-500' : 'text-orange-500'}`}>{parts.join(' ')}</div>
          )}
        </div>
      )
    }

    case 'impressions':
      return dateRangeActive
        ? <span className="text-purple-600">{rec.impressions}</span>
        : rec.impressions

    case 'submissions':
      return dateRangeActive
        ? <span className="text-purple-600">{rec.submissions}</span>
        : rec.submissions

    case 'page_impressions':
      return dateRangeActive
        ? <span className="text-purple-600">{rec.page_impressions}</span>
        : rec.page_impressions

    case 'page_submissions':
      return dateRangeActive
        ? <span className="text-purple-600">{rec.page_submissions}</span>
        : rec.page_submissions

    case 'our_confirms':
      return <span className={`font-medium ${dateRangeActive ? 'text-purple-600' : 'text-green-600'}`}>{rec.our_confirms}</span>

    case 'our_rejections':
      return <span className={dateRangeActive ? 'text-purple-600' : 'text-red-600'}>{rec.our_rejections}</span>

    case 'our_pending':
      return <span className={dateRangeActive ? 'text-purple-600' : 'text-yellow-600'}>{rec.our_pending}</span>

    case 'sparkloop_confirmed':
      return <span className="text-green-600/60">{rec.sparkloop_confirmed}</span>

    case 'sparkloop_rejected':
      return <span className="text-red-600/60">{rec.sparkloop_rejected}</span>

    case 'sparkloop_pending':
      return <span className="text-yellow-600/60">{rec.sparkloop_pending}</span>

    case 'sparkloop_earnings':
      return rec.sparkloop_earnings ? `$${fmtDollars(rec.sparkloop_earnings / 100)}` : '-'

    case 'sparkloop_net_earnings':
      return rec.sparkloop_net_earnings ? `$${fmtDollars(rec.sparkloop_net_earnings / 100)}` : '-'

    case 'remaining_budget_dollars':
      if (rec.remaining_budget_dollars === null || rec.remaining_budget_dollars === undefined) return '-'
      return `$${fmtDollars(rec.remaining_budget_dollars)}`

    case 'excluded':
      return rec.excluded ? 'Yes' : 'No'

    case 'eligible_for_module':
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleModuleEligible(rec) }}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            rec.eligible_for_module ? 'bg-indigo-600' : 'bg-gray-300'
          }`}
          title={rec.eligible_for_module ? 'Eligible for newsletter module' : 'Not in newsletter module'}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
              rec.eligible_for_module ? 'translate-x-4.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      )

    case 'last_synced_at':
      if (!rec.last_synced_at) return '-'
      return new Date(rec.last_synced_at).toLocaleDateString()

    case 'type':
      return rec.type === 'paid' ? (
        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700">Paid</span>
      ) : (
        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-700">Free</span>
      )

    default: {
      const value = rec[columnKey as keyof Recommendation]
      if (value === null || value === undefined) return '-'
      if (typeof value === 'number') return value.toLocaleString()
      return String(value)
    }
  }
}
