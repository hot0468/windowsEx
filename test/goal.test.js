import { describe, expect, it } from 'vitest'
import { checkGoal } from '../src/engine/goal.js'

const goal = {
  requiredAttachment: 'file_quote_final',
  requiredKeywords: ['3,450,000'],
  wrongAttachmentReply: 'WRONG_ATT',
  missingKeywordReply: 'MISSING_KW',
  successReply: 'SUCCESS'
}

describe('checkGoal', () => {
  it('rejects a wrong attachment', () => {
    expect(checkGoal(goal, { attachmentId: 'file_quote_v2', body: '3,450,000원입니다' }))
      .toEqual({ ok: false, reply: 'WRONG_ATT' })
  })

  it('rejects a missing attachment', () => {
    expect(checkGoal(goal, { attachmentId: null, body: '3,450,000원입니다' }).ok).toBe(false)
  })

  it('rejects a body without the keyword', () => {
    expect(checkGoal(goal, { attachmentId: 'file_quote_final', body: '견적서 보냅니다' }))
      .toEqual({ ok: false, reply: 'MISSING_KW' })
  })

  it('accepts correct attachment and keyword', () => {
    expect(checkGoal(goal, { attachmentId: 'file_quote_final', body: '총액 3,450,000원입니다' }))
      .toEqual({ ok: true, reply: 'SUCCESS' })
  })

  it('ignores commas and spaces when matching keywords', () => {
    expect(checkGoal(goal, { attachmentId: 'file_quote_final', body: '총액은 345 0000 원' }).ok).toBe(true)
  })
})
