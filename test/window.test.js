import { describe, expect, it } from 'vitest'
import { fitY } from '../src/shell/Window.jsx'

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
