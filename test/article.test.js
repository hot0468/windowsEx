import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { filedAt, relatedTo } from '../src/apps/News.jsx'
import { visibleByDay } from '../src/engine/store.js'

const paper = scenario.sites.find((s) => s.layout === 'news')
const presses = [...new Set(scenario.news.map((n) => n.press))]

// 기사 상세는 단서를 담는 화면이다. 깨지는 방식은 셋 — 지면 이름이 어긋나거나,
// 입력 시각이 열 때마다 달라지거나, 관련 기사가 아직 안 쓰인 기사를 물어 오거나.

describe('기사가 걸리는 지면', () => {
  it('제휴 언론사가 전부 지면을 갖는다', () => {
    for (const p of presses) expect(paper.news.sections[p], p).toBeTruthy()
  })

  it('그 지면이 실제 메뉴에 있다 — 없는 지면을 가리키면 상단에 아무것도 안 켜진다', () => {
    for (const [press, section] of Object.entries(paper.news.sections)) {
      expect(paper.news.menu, press).toContain(section)
    }
  })
})

describe('입력 시각', () => {
  it('같은 기사는 늘 같은 시각이다 — 열 때마다 바뀌면 그게 더 가짜다', () => {
    for (const a of scenario.news) expect(filedAt(a.id)).toBe(filedAt(a.id))
  })

  it('업무 시간 안에 든다', () => {
    for (const a of scenario.news) {
      const [h, m] = filedAt(a.id).split(':').map(Number)
      expect(h, a.id).toBeGreaterThanOrEqual(8)
      expect(h, a.id).toBeLessThanOrEqual(18)
      expect(m, a.id).toBeLessThan(60)
    }
  })

  it('요일은 쓰지 않는다 — 이 게임의 달력은 실제 2026년과 다르다', () => {
    for (const a of scenario.news) expect(filedAt(a.id)).toMatch(/^\d{2}:\d{2}$/)
  })
})

describe('관련 기사', () => {
  it('자기 자신은 안 나온다', () => {
    for (const a of scenario.news) {
      expect(relatedTo(scenario.news, a).map((x) => x.id)).not.toContain(a.id)
    }
  })

  it('태그가 겹치는 것만 나온다', () => {
    for (const a of scenario.news) {
      const tags = new Set(a.tags ?? [])
      for (const x of relatedTo(scenario.news, a)) {
        expect((x.tags ?? []).some((t) => tags.has(t)), `${a.id} → ${x.id}`).toBe(true)
      }
    }
  })

  it('셋을 넘지 않는다', () => {
    for (const a of scenario.news) expect(relatedTo(scenario.news, a).length).toBeLessThanOrEqual(3)
  })

  it('아직 쓰이지 않은 기사로 새지 않는다', () => {
    // 넘겨받는 목록이 그날 보이는 것만 담고 있으면, 관련 기사도 거기서만 나온다.
    // 이게 깨지면 1일차에 5일차 기사가 관련 기사로 걸려 나온다.
    for (let d = 1; d <= scenario.days.length; d++) {
      const today = visibleByDay(scenario.news, d)
      const ids = new Set(today.map((a) => a.id))
      for (const a of today) {
        for (const x of relatedTo(today, a)) expect(ids.has(x.id), `${d}일차 ${x.id}`).toBe(true)
      }
    }
  })

  it('실제로 이어지는 기사가 있다 — 관련 기사 칸이 늘 비면 만든 보람이 없다', () => {
    const linked = scenario.news.filter((a) => relatedTo(scenario.news, a).length > 0)
    expect(linked.length).toBeGreaterThan(scenario.news.length / 2)
  })
})
