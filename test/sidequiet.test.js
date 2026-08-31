import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { stepsOf, WALK_LAST } from '../src/apps/Steps.jsx'

// 게임 진행과 상관없이 그냥 있는 것들 — 만보기, 회사 사람이 남긴 맛집 후기,
// 복지포인트. 퍼즐이 아니므로 여기서 깨지는 방식은 하나다: 아무 말도 하지
// 않게 되는 것. 숫자가 다 같거나, 이름이 아무도 아니거나, 날짜가 없으면
// 있으나 마나다.

const scenario = JSON.parse(
  readFileSync(new URL('../src/scenarios/workday.json', import.meta.url), 'utf8'))

describe('만보기', () => {
  const days = stepsOf(scenario)

  it('며칠치가 있다', () => {
    expect(days.length).toBeGreaterThanOrEqual(14)
  })

  it('날마다 걸음 수가 다르다', () => {
    const walked = days.filter((d) => d.steps > 0).map((d) => d.steps)
    expect(new Set(walked).size).toBeGreaterThan(3)
  })

  // 7월 24일 아침 공항 가는 길에 사고가 났다. 그날 이후로 이 폰은
  // 주머니에 있지 않았다 — 걸음이 0인 것이 이 앱이 하는 유일한 말이다.
  it('사고 다음부터는 걸음이 없다', () => {
    const after = days.filter((d) => d.date > WALK_LAST)
    expect(after.length).toBeGreaterThan(0)
    for (const d of after) expect(d.steps, d.date).toBe(0)
  })

  it('사고 전에는 걸었다', () => {
    const before = days.filter((d) => d.date <= WALK_LAST)
    expect(before.some((d) => d.steps > 0)).toBe(true)
  })

  // 앱이 스스로 결론을 말해 버리면 플레이어가 알아챌 자리가 없어진다.
  it('앱이 대신 설명하지 않는다', () => {
    const src = readFileSync(new URL('../src/apps/Steps.jsx', import.meta.url), 'utf8')
    for (const word of ['사고', '병원', '의식', '혼수', '별세']) {
      expect(src, word).not.toContain(word)
    }
  })
})

describe('맛집에 남은 회사 사람들', () => {
  const named = scenario.places.flatMap((p) => (p.posts ?? []).map(([who]) => who))

  it('아는 이름이 후기에 섞여 있다', () => {
    // 사내 메신저에 실제로 있는 사람이어야 한다. 모르는 닉네임만 있으면
    // 그냥 포털의 남의 후기와 다를 것이 없다.
    const people = [scenario.workMessenger, scenario.privateMessenger]
      .flatMap((m) => m.sections.flatMap((s) => s.threads))
      .map((t) => t.name)
      .filter(Boolean)
    const hit = named.filter((who) => people.some((n) => who.includes(n)))
    expect(hit.length).toBeGreaterThan(0)
  })

  it('후기는 별점과 함께 온다', () => {
    for (const p of scenario.places) {
      for (const post of p.posts ?? []) {
        expect(post.length, p.name).toBe(3)
        expect(Number(post[1]), p.name).toBeGreaterThanOrEqual(1)
        expect(Number(post[1]), p.name).toBeLessThanOrEqual(5)
      }
    }
  })
})

describe('복지포인트', () => {
  const w = scenario.sites.find((x) => x.layout === 'portal').pages['/hr/welfare'].welfare

  it('잔액과 소멸일이 있다', () => {
    expect(w).toBeTruthy()
    expect(w.balance).toBeGreaterThan(0)
    expect(w.expires).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('쓴 내역이 있다', () => {
    expect(w.used.length).toBeGreaterThan(2)
    for (const row of w.used) {
      expect(row.date).toMatch(/\d{4}-\d{2}-\d{2}/)
      expect(row.what?.trim()).toBeTruthy()
      expect(row.point).toBeGreaterThan(0)
    }
  })

  // 마지막으로 쓴 날이 사고 전이어야 한다. 그 뒤로 아무것도 안 샀다는
  // 사실이 이 화면이 하는 말이다.
  it('마지막으로 쓴 날 이후로는 내역이 없다', () => {
    const last = w.used.map((r) => r.date).sort().pop()
    expect(last <= WALK_LAST).toBe(true)
  })

  it('잔액과 내역의 합이 지급액과 맞는다', () => {
    const spent = w.used.reduce((n, r) => n + r.point, 0)
    expect(w.granted).toBe(w.balance + spent)
  })
})
