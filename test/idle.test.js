import { describe, expect, it } from 'vitest'
import { ACTIVITY, watchActivity } from '../src/shell/idle.js'

// 4분 방치하면 화면이 잠긴다. 무엇을 '방치가 아니다'로 치는지가 이 파일의 전부다 —
// 키와 클릭만 세던 때에는 긴 글을 휠로 읽는 동안 화면이 잠겨, 끝까지 내려야
// 열리는 것들(여행 블로그, 부고)이 읽는 도중에 끊겼다.
const fakeTarget = () => {
  const on = []
  return {
    on,
    off: [],
    addEventListener(ev, fn, opts) { this.on.push({ ev, fn, opts }) },
    removeEventListener(ev, fn, opts) { this.off.push({ ev, fn, opts }) }
  }
}

describe('무엇이 방치를 되감는가', () => {
  it('읽기만 하는 동작도 사람이 있다는 신호로 센다', () => {
    for (const ev of ['wheel', 'scroll', 'touchmove']) expect(ACTIVITY).toContain(ev)
  })

  it('키와 클릭도 그대로 센다', () => {
    for (const ev of ['keydown', 'pointerdown']) expect(ACTIVITY).toContain(ev)
  })

  it('스크롤은 캡처로 듣는다 — 버블링하지 않으므로 창에서는 그래야 보인다', () => {
    const t = fakeTarget()
    watchActivity(t, () => {})
    const scroll = t.on.find((x) => x.ev === 'scroll')
    expect(scroll.opts.capture).toBe(true)
  })

  it('어느 것도 기본 동작을 막지 않는다', () => {
    const t = fakeTarget()
    watchActivity(t, () => {})
    for (const x of t.on) expect(x.opts.passive).toBe(true)
  })

  it('걷어낼 때 건 것을 그대로 뗀다', () => {
    const t = fakeTarget()
    const arm = () => {}
    watchActivity(t, arm)()
    expect(t.off.map((x) => x.ev)).toEqual(t.on.map((x) => x.ev))
    for (const x of t.off) expect(x.fn).toBe(arm)
  })
})
