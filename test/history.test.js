import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { historyChunks } from '../src/engine/history.js'

const scenario = JSON.parse(readFileSync('src/scenarios/workday.json', 'utf8'))
const allThreads = ['workMessenger', 'privateMessenger']
  .flatMap((src) => scenario[src].sections.flatMap((sec) => sec.threads))

// 지난 기록은 date를 갖고, 이번 주 메시지는 day를 갖는다.
const hist = (msgs) => msgs.filter((m) => m.day === undefined)

describe('historyChunks', () => {
  it('이번 주 메시지가 없으면 접지 않는다', () => {
    const msgs = [{ date: '7월 23일 (금)', text: 'a' }, { date: '7월 23일 (금)', text: 'b' }]
    expect(historyChunks(msgs)).toEqual([])
  })

  it('기록이 8줄 이하면 접지 않는다', () => {
    const msgs = [
      ...Array.from({ length: 8 }, (_, i) => ({ date: '7월 23일 (금)', text: 'h' + i })),
      { day: 1, text: '오늘' }
    ]
    expect(historyChunks(msgs)).toEqual([])
  })

  it('기록이 9줄이면 접는다', () => {
    const msgs = [
      ...Array.from({ length: 9 }, (_, i) => ({ date: '7월 23일 (금)', text: 'h' + i })),
      { day: 1, text: '오늘' }
    ]
    expect(historyChunks(msgs).length).toBeGreaterThan(0)
  })

  it('한 묶음이 날짜 경계를 가로지르지 않는다', () => {
    for (const t of allThreads) {
      for (const chunk of historyChunks(t.messages ?? [])) {
        const dates = new Set(chunk.map((m) => m.date ?? '(무표기)'))
        // 12줄이 넘는 단일 날짜는 통째로 올라오므로 묶음 안의 날짜는 항상 이어진다
        const seen = []
        for (const m of chunk) {
          const d = m.date ?? '(무표기)'
          if (seen[seen.length - 1] !== d) seen.push(d)
        }
        expect(seen.length, `${t.id}: 묶음이 날짜를 오간다`).toBe(dates.size)
      }
    }
  })

  it('묶음을 모두 이으면 원래 기록과 정확히 같다 — 유실도 중복도 없다', () => {
    for (const t of allThreads) {
      const msgs = t.messages ?? []
      const chunks = historyChunks(msgs)
      if (!chunks.length) continue
      expect(chunks.flat(), `${t.id}: 기록이 어긋난다`).toEqual(hist(msgs))
    }
  })

  it('한 묶음은 12줄을 넘지 않는다 — 단일 날짜가 그보다 길지 않은 한', () => {
    for (const t of allThreads) {
      for (const chunk of historyChunks(t.messages ?? [])) {
        if (chunk.length <= 12) continue
        const dates = new Set(chunk.map((m) => m.date ?? '(무표기)'))
        expect(dates.size, `${t.id}: 12줄 초과 묶음이 여러 날짜다`).toBe(1)
      }
    }
  })

  it('접히는 스레드는 정확히 이 일곱이다', () => {
    const folded = allThreads
      .filter((t) => historyChunks(t.messages ?? []).length > 0)
      .map((t) => t.id)
      .sort()
    expect(folded).toEqual(
      ['boss', 'jihyun', 'junho', 'minseo', 'mom', 'room_school', 'soyoung'].sort()
    )
  })
})
