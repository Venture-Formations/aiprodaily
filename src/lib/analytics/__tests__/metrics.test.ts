import { describe, it, expect } from 'vitest'
import {
  computeIssueCTR,
  computeModuleCTR,
  computeIssueOpenRate,
  computePollResponseRate,
  computeFeedbackResponseRate,
  computeBounceRate,
  computeUnsubscribeRate,
} from '../metrics'

describe('computeIssueCTR', () => {
  it('returns unique clickers divided by delivered count', () => {
    expect(computeIssueCTR({ uniqueClickers: 50, deliveredCount: 1000 })).toBe(0.05)
  })

  it('returns 0 when deliveredCount is 0', () => {
    expect(computeIssueCTR({ uniqueClickers: 50, deliveredCount: 0 })).toBe(0)
  })

  it('returns 0 when uniqueClickers is 0', () => {
    expect(computeIssueCTR({ uniqueClickers: 0, deliveredCount: 1000 })).toBe(0)
  })

  it('throws if inputs are negative', () => {
    expect(() => computeIssueCTR({ uniqueClickers: -1, deliveredCount: 100 })).toThrow()
    expect(() => computeIssueCTR({ uniqueClickers: 1, deliveredCount: -1 })).toThrow()
  })

  it('clamps to 1.0 if unique clickers exceed delivered (data anomaly)', () => {
    expect(computeIssueCTR({ uniqueClickers: 1500, deliveredCount: 1000 })).toBe(1)
  })
})

describe('computeModuleCTR', () => {
  it('returns unique clickers divided by module recipients', () => {
    expect(computeModuleCTR({ uniqueClickers: 30, moduleRecipients: 600 })).toBe(0.05)
  })

  it('returns 0 when moduleRecipients is 0', () => {
    expect(computeModuleCTR({ uniqueClickers: 30, moduleRecipients: 0 })).toBe(0)
  })

  it('throws on negative inputs', () => {
    expect(() => computeModuleCTR({ uniqueClickers: -1, moduleRecipients: 100 })).toThrow()
  })
})

describe('computeIssueOpenRate', () => {
  it('returns unique openers divided by delivered count', () => {
    expect(computeIssueOpenRate({ uniqueOpeners: 500, deliveredCount: 1000 })).toBe(0.5)
  })

  it('returns 0 when deliveredCount is 0', () => {
    expect(computeIssueOpenRate({ uniqueOpeners: 500, deliveredCount: 0 })).toBe(0)
  })

  it('clamps to 1.0 on data anomaly', () => {
    expect(computeIssueOpenRate({ uniqueOpeners: 1500, deliveredCount: 1000 })).toBe(1)
  })
})

describe('computePollResponseRate', () => {
  it('returns unique respondents divided by delivered count', () => {
    expect(computePollResponseRate({ uniqueRespondents: 100, deliveredCount: 1000 })).toBe(0.1)
  })

  it('returns 0 when deliveredCount is 0', () => {
    expect(computePollResponseRate({ uniqueRespondents: 100, deliveredCount: 0 })).toBe(0)
  })
})

describe('computeFeedbackResponseRate', () => {
  it('returns unique respondents divided by delivered count', () => {
    expect(computeFeedbackResponseRate({ uniqueRespondents: 200, deliveredCount: 1000 })).toBe(0.2)
  })

  it('returns 0 when deliveredCount is 0', () => {
    expect(computeFeedbackResponseRate({ uniqueRespondents: 200, deliveredCount: 0 })).toBe(0)
  })
})

describe('computeBounceRate', () => {
  it('returns bounced count divided by sent count', () => {
    expect(computeBounceRate({ bouncedCount: 20, sentCount: 1000 })).toBe(0.02)
  })

  it('returns 0 when sentCount is 0', () => {
    expect(computeBounceRate({ bouncedCount: 20, sentCount: 0 })).toBe(0)
  })
})

describe('computeUnsubscribeRate', () => {
  it('returns unsubscribed count divided by delivered count', () => {
    expect(computeUnsubscribeRate({ unsubscribedCount: 5, deliveredCount: 1000 })).toBe(0.005)
  })

  it('returns 0 when deliveredCount is 0', () => {
    expect(computeUnsubscribeRate({ unsubscribedCount: 5, deliveredCount: 0 })).toBe(0)
  })
})
