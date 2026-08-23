import { describe, expect, it } from 'vitest'
import { MIN_SIZE, fitY, resizeRect } from '../src/engine/store.js'

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
