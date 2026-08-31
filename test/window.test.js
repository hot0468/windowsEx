import { describe, expect, it } from 'vitest'
import { KEEP, MIN_SIZE, clampPos, fitY, resizeRect, useGame } from '../src/engine/store.js'

// viewportH 900 → 852 usable above the 48px taskbar
describe('fitY', () => {
  it('leaves the cascade offset alone when the window already fits', () => {
    expect(fitY(188, 560, 900)).toBe(188)
  })

  it('pulls the window up so its bottom clears the taskbar', () => {
    expect(fitY(188, 560, 700)).toBe(92)
  })

  it('anchors to the top when the window is taller than the screen', () => {
    expect(fitY(188, 560, 500)).toBe(0)
  })

  it('never returns a negative top', () => {
    expect(fitY(60, 2000, 300)).toBe(0)
  })
})

describe('resizeRect', () => {
  const start = { x: 100, y: 80, w: 600, h: 400 }

  it('grows from the bottom-right without moving the window', () => {
    expect(resizeRect(start, 'se', 50, 30)).toEqual({ x: 100, y: 80, w: 650, h: 430 })
  })

  it('moves the corner when a left edge is dragged', () => {
    expect(resizeRect(start, 'w', -40, 0)).toEqual({ x: 60, y: 80, w: 640, h: 400 })
  })

  it('moves the corner when a top edge is dragged', () => {
    expect(resizeRect(start, 'n', 0, 25)).toEqual({ x: 100, y: 105, w: 600, h: 375 })
  })

  it('stops at the minimum size', () => {
    const r = resizeRect(start, 'se', -5000, -5000)
    expect(r.w).toBe(MIN_SIZE.w)
    expect(r.h).toBe(MIN_SIZE.h)
  })

  it('pins the far edge once a left drag hits the minimum', () => {
    const r = resizeRect(start, 'nw', 5000, 5000)
    expect(r.w).toBe(MIN_SIZE.w)
    expect(r.x).toBe(start.x + start.w - MIN_SIZE.w)   // right edge stayed put
    expect(r.y).toBe(start.y + start.h - MIN_SIZE.h)
  })

  it('leaves untouched edges alone', () => {
    expect(resizeRect(start, 'e', 20, 999)).toEqual({ x: 100, y: 80, w: 620, h: 400 })
  })
})

// 화면이 줄면 오른쪽·아래에 있던 창은 밖으로 나간다. 작업표시줄은 z만 올리므로
// 한 번 나가면 되찾을 길이 없다 — 그래서 자리는 화면 크기를 따라다녀야 한다.
describe('clampPos', () => {
  it('leaves a window that already fits where it is', () => {
    expect(clampPos(300, 200, 1440, 900)).toEqual({ x: 300, y: 200 })
  })

  it('pulls a window back when the screen shrinks under it', () => {
    const p = clampPos(1500, 700, 900, 600)
    expect(p.x).toBe(900 - KEEP.right)
    expect(p.y).toBe(600 - KEEP.bottom)
  })

  it('never lets the titlebar go above the top', () => {
    expect(clampPos(0, -80, 1440, 900).y).toBe(0)
  })

  it('still allows pushing a window off to the left', () => {
    expect(clampPos(-9000, 100, 1440, 900).x).toBe(KEEP.left)
  })
})

describe('fitWindows', () => {
  const openAt = (windows) => useGame.setState({ windows })

  it('brings every window that fell off the screen back into reach', () => {
    openAt([
      { id: 1, app: 'notepad', x: 1500, y: 760, z: 1 },
      { id: 2, app: 'notepad', x: 120, y: 80, z: 2 }
    ])
    useGame.getState().fitWindows(900, 600)
    const [a, b] = useGame.getState().windows
    expect(a.x).toBeLessThanOrEqual(900 - KEEP.right)
    expect(a.y).toBeLessThanOrEqual(600 - KEEP.bottom)
    expect(b).toEqual({ id: 2, app: 'notepad', x: 120, y: 80, z: 2 })   // 멀쩡한 창은 그대로
  })

  it('changes nothing — not even the array — when every window already fits', () => {
    const windows = [{ id: 1, app: 'notepad', x: 120, y: 80, z: 1 }]
    openAt(windows)
    useGame.getState().fitWindows(1440, 900)
    expect(useGame.getState().windows).toBe(windows)
  })
})
