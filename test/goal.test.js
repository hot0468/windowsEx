import { describe, expect, it } from 'vitest'
import { checkGoal } from '../src/engine/goal.js'
import scenario from '../src/scenarios/workday.json'
import { findFile } from '../src/engine/store.js'
import { parseDoc } from '../src/apps/docLayout.js'

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


// 첫날 목표가 걸린 그 파일 자체. 금액이 파일 안에 들어오면 위키를 볼 이유가
// 사라져 퍼즘이 죽고, 칸이 통째로 비면 문서가 깨진 것처럼 보인다. 둘 다 사람이
// 눈으로 보기 전까지 조용하므로 여기서 못 박는다.
describe('견적서 최종본', () => {
  const real = scenario.days[0].goal
  const file = findFile(scenario.fs, real.requiredAttachment)

  it('목표가 가리키는 파일이 실존한다', () => {
    expect(file).toBeTruthy()
  })

  it('총액을 담고 있지 않다 — 담고 있으면 위키를 찾을 이유가 없어진다', () => {
    for (const word of real.requiredKeywords) expect(file.content).not.toContain(word)
  })

  it('돈 칸이 통째로 비어 있지 않다 — 빈 칸 세 개는 미기재가 아니라 고장으로 읽힌다', () => {
    const table = parseDoc(file.content).find((b) => b.kind === 'table')
    const money = table.head.map((h, i) => [h, i]).filter(([h]) => h === '단가' || h === '금액')
    expect(money.length).toBe(2)
    // 품목 줄은 두 칸 모두, 합계 줄은 금액 칸이 채워져 있어야 한다.
    expect(table.rows[0][money[0][1]]).toBeTruthy()
    expect(table.rows[0][money[1][1]]).toBeTruthy()
    expect(table.rows[1][money[1][1]]).toBeTruthy()
  })

  it('어디서 베끼는지를 표가 직접 가리킨다', () => {
    // 맨 아래 ※ 줄은 창 높이에 따라 쟘리면 보이지 않는다.
    const page = scenario.sites.flatMap((s) => Object.values(s.wiki?.pages ?? [])).find((p) => p.title === '확정 단가표')
    expect(page, '확정 단가표 문서가 있어야 한다').toBeTruthy()
    const table = parseDoc(file.content).find((b) => b.kind === 'table')
    expect(table.rows[0].join(' ')).toContain(page.title)
  })
})
