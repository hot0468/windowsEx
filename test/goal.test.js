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
      .toEqual({ ok: false, reason: 'attachment', reply: 'WRONG_ATT' })
  })

  it('rejects a missing attachment', () => {
    expect(checkGoal(goal, { attachmentId: null, body: '3,450,000원입니다' }).ok).toBe(false)
  })

  it('rejects a body without the keyword', () => {
    expect(checkGoal(goal, { attachmentId: 'file_quote_final', body: '견적서 보냅니다' }))
      .toEqual({ ok: false, reason: 'keyword', reply: 'MISSING_KW' })
  })

  it('accepts correct attachment and keyword', () => {
    expect(checkGoal(goal, { attachmentId: 'file_quote_final', body: '총액 3,450,000원입니다' }))
      .toEqual({ ok: true, reason: null, reply: 'SUCCESS' })
  })

  it('ignores commas and spaces when matching keywords', () => {
    expect(checkGoal(goal, { attachmentId: 'file_quote_final', body: '총액은 345 0000 원' }).ok).toBe(true)
  })
})

// the reason picks which complaint the boss sends, so it has to be exact
describe('failure reason', () => {
  it('names the attachment when the wrong file went out', () => {
    expect(checkGoal(goal, { attachmentId: 'nope', body: '3,450,000' }).reason).toBe('attachment')
  })

  it('names the keyword when the file was right but the figure was missing', () => {
    expect(checkGoal(goal, { attachmentId: 'file_quote_final', body: '' }).reason).toBe('keyword')
  })
})
