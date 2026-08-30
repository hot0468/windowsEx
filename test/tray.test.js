import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'
import { useGame } from '../src/engine/store.js'

// 트레이는 새 상태를 만들지 않는다 — 앱을 열어야 알 수 있던 것을 한 줄로 드러낼
// 뿐이다. 그래서 깨지는 방식이 둘이다. 비추던 상태의 이름이 바뀌어 아이콘이
// 영영 안 뜨거나, 반대로 트레이가 퍼즐의 답을 먼저 말해 버리거나.

const taskbar = readFileSync('src/shell/Taskbar.jsx', 'utf8')
const desktop = readFileSync('src/shell/Desktop.jsx', 'utf8')

const steps = (a) => (a ? [a, ...steps(a.then)] : [])
const asks = [
  ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => steps(a.ask))),
  ...[scenario.workMessenger, scenario.privateMessenger]
    .flatMap((m) => m.sections.flatMap((s) => s.threads))
    .flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).flatMap(steps),
  ...Object.values(scenario.overtime.days).flatMap((d) => d.asks.flatMap((a) => steps(a.ask))),
  ...scenario.pool.requests.flatMap((r) => steps(r.beat.ask))
]
const answers = [...new Set(asks.filter((a) => a?.accept).flatMap((a) => a.accept.flat()))]
  .filter((a) => a.length > 2)

// title="..." 로 붙은 말들. 트레이가 사람에게 하는 말 전부다.
const titles = [...taskbar.matchAll(/title="([^"]+)"/g)].map((m) => m[1])

describe('트레이가 비추는 상태', () => {
  it('실제로 있는 상태를 읽는다 — 이름이 어긋나면 아이콘이 영영 안 뜬다', () => {
    const state = useGame.getState()
    for (const key of ['routerDown', 'vpn', 'mining', 'cleaned']) {
      expect(key in state, key).toBe(true)
      expect(taskbar, key).toContain(`s.${key}`)
    }
  })

  it('말을 걸긴 한다', () => {
    expect(titles.length).toBeGreaterThan(2)
  })
})

describe('트레이가 답을 말하지 않는다', () => {
  it('어떤 요청의 정답도 트레이 문구에 없다', () => {
    for (const word of answers) {
      for (const title of titles) expect(title, word).not.toContain(word)
    }
  })

  it('공유기 주소를 적지도, 그 페이지를 열어 주지도 않는다', () => {
    // 그 주소를 찾아내는 것이 퍼즐이다. 아이콘을 눌러 바로 열어 주면 답이 샌다.
    const gateway = scenario.network.gateway
    expect(gateway).toBeTruthy()
    expect(taskbar).not.toContain(gateway)
    // 네트워크 표시는 button 이 아니라 span 이다 — 누를 것이 없다.
    expect(taskbar).toMatch(/<span className=\{'tb-stat'/)
  })

  it('눌러서 여는 것은 시작 메뉴에 이미 있는 앱뿐이다', () => {
    // 트레이가 여는 창이 시작 메뉴로도 갈 수 있는 곳이면 새로 열어 주는 길이 없다.
    const opened = [...taskbar.matchAll(/openWindow\('([a-z]+)'\)/g)].map((m) => m[1])
    expect(opened.length).toBeGreaterThan(0)
    for (const app of opened) expect(['vpn', 'taskmgr'], app).toContain(app)
  })
})

describe('바탕화면 오른쪽 단추', () => {
  it('숨긴 항목 스위치가 폴더 밖에도 있다', () => {
    // 힌트가 '숨긴 항목'을 말하는 요청이 있는데 스위치가 탐색기 안에만 있으면,
    // 탐색기를 안 연 사람은 그 말을 듣고도 켤 곳을 못 찾는다.
    expect('showHidden' in useGame.getState()).toBe(true)
    expect(desktop).toContain('toggleHidden')
  })

  it('숨긴 항목을 말하는 힌트가 실제로 있다 — 없으면 이 스위치는 장식이다', () => {
    const hints = asks.flatMap((a) => (a?.no ?? []).flat())
    expect(hints.some((h) => h.includes('숨긴 항목'))).toBe(true)
  })

  it('빈 바탕화면만 받는다 — 창 위에서 누르면 그 창이 가져간다', () => {
    expect(desktop).toContain('desktop-back')
  })
})
