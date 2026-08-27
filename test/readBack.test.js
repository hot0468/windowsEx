import { describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { PROGRESS, endingFor, useGame } from '../src/engine/store.js'
import { historyChunks } from '../src/engine/history.js'

const mom = scenario.privateMessenger.sections
  .flatMap((s) => s.threads).find((t) => t.id === 'mom')

// 사고(7/24) 이후 엄마가 건 말들. 이 장면이 서 있는 이유 자체라, 이야기가
// 바뀌어 이 침묵이 사라지면 이스터에그도 같이 의미를 잃는다.
const AFTER = ['7월 24일 (토)', '7월 26일 (월)', '8월 5일 (목)', '8월 12일 (목)', '8월 22일 (일)']

describe('거슬러 올라간 사람만 아는 것', () => {
  it('7월 24일 이후 엄마 대화에는 내가 보낸 말이 없다', () => {
    const after = (mom.messages ?? []).filter((m) => AFTER.includes(m.date))
    expect(after.length).toBeGreaterThan(6)
    expect(after.filter((m) => m.me)).toEqual([])
  })

  it('엄마 기록은 여러 번 눌러야 끝까지 열린다', () => {
    // 오늘 메시지가 풀린 뒤의 대화 — 큐에 묶여 있는 동안에는 접히지 않는다.
    expect(historyChunks(mom.messages).length).toBeGreaterThan(1)
  })

  it('끝까지 펼친 사람에게만, 한 번만 말한다', () => {
    vi.useFakeTimers()
    try {
      // 엄마 대화가 큐에서 풀린 뒤라야 접히고, 그래야 여기까지 온다.
      useGame.setState({ readBack: false, extraMessages: {}, toast: null, day: 3, openThread: {} })
      useGame.getState().readAllBack()
      useGame.getState().readAllBack()
      expect(useGame.getState().readBack).toBe(true)
      vi.runAllTimers()

      const note = scenario.readBack
      // 몇 번을 다시 펼치든 말은 한 번이다
      expect(useGame.getState().extraMessages[note.thread].map((m) => m.text)).toEqual(note.lines)
      expect(useGame.getState().toast.thread).toBe(note.thread)
      expect(PROGRESS).toContain('readBack')
    } finally {
      vi.useRealTimers()
    }
  })

  it('죽음을 한 마디도 말하지 않는다', () => {
    const said = scenario.readBack.lines.join(' ')
    // 부고를 보지 않은 플레이어에게는 엄마가 착각한 것으로 읽혀야 한다.
    for (const word of ['부고', '죽', '사망', '장례', '병원', '사고', '의식', '영안', '빈소']) {
      expect(said, word).not.toContain(word)
    }
  })

  it('엄마 스레드에서, 엄마의 말로 온다', () => {
    const note = scenario.readBack
    expect(note.thread).toBe('mom')
    expect(note.source).toBe('privateMessenger')
    expect(note.from).toBe('엄마')
    expect(note.lines.length).toBeGreaterThan(0)
    // 관측을 알아채는 다른 두 장면과 같은 뜸을 들인다
    expect(note.delay).toBe(scenario.dream.notice.delay)
  })

  it('엔딩에는 영향이 없다', () => {
    const base = { grants: {}, locks: 3, overtime: {}, days: 5, digging: {}, rumor: {} }
    // 이 장면을 봤든 못 봤든 그 주의 결말은 같다
    expect(endingFor(scenario.ending, base)).toBe(endingFor(scenario.ending, base))
    expect(endingFor(scenario.ending, { ...base, readBack: true }))
      .toBe(endingFor(scenario.ending, { ...base, readBack: false }))
  })
})
