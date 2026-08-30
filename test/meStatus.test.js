import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'

// 내 상태메시지는 휴가 가기 전에 걸어 둔 것이다. 복귀했는데 아무도 — 나조차 —
// 고치지 않았고, 5일차(27일자로 퇴직 처리되는 날)에는 조용히 비어 있다.
// 어긋남은 말로 하지 않는다. 있던 글자가 없어질 뿐이다.
describe('내 상태메시지', () => {
  const me = scenario.workMessenger.me
  const on = (day) => me.subOn?.[day] ?? me.sub

  it('복귀 첫날에도 아직 휴가 중이다', () => {
    expect(on(1)).toContain('휴가')
    expect(on(4)).toBe(on(1))
  })

  it('5일차에는 빈칸이다', () => {
    expect(on(5)).toBe('')
  })

  it('휴가 종료일을 말하지 않는다 — 그건 회계팀이 묻는 답이다', () => {
    expect(me.sub).not.toMatch(/8\/2\d|8월 2\d일|2026-08-2\d/)
  })

  it('메신저가 날짜별 상태를 읽는다', () => {
    const src = readFileSync('src/apps/Messenger.jsx', 'utf8')
    expect(src.match(/m\.me\.subOn\?\.\[day\] \?\? m\.me\.sub/g)?.length).toBe(2)
  })

  it('톡톡의 상태는 제주 가기 전날에 멈춰 있다', () => {
    expect(scenario.privateMessenger.me.sub).toContain('D-1')
  })
})
