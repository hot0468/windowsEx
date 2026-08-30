import { describe, expect, it } from 'vitest'
import { MIN_SIZE, SNAP_EDGE, snapRect, snapZone } from '../src/engine/store.js'

// 창을 가장자리로 밀면 반쪽에 눕는다. 깨지는 방식은 둘 — 가장자리가 아닌데
// 물어서 옮기려던 창이 튀거나, 반쪽 둘이 화면을 정확히 못 덮어 틈이 남거나.

const VW = 1600
const VH = 900
const BAR = 48

describe('어디서 물리나', () => {
  it('가장자리에서만 물린다', () => {
    expect(snapZone(2, 400, VW, VH)).toBe('left')
    expect(snapZone(VW - 2, 400, VW, VH)).toBe('right')
    expect(snapZone(800, 1, VW, VH)).toBe('max')
    expect(snapZone(800, 400, VW, VH)).toBe(null)
  })

  it('가장자리 폭 바로 안팎에서 갈린다', () => {
    expect(snapZone(SNAP_EDGE, 400, VW, VH)).toBe('left')
    expect(snapZone(SNAP_EDGE + 1, 400, VW, VH)).toBe(null)
  })

  it('위쪽이 좌우보다 먼저다 — 구석에서는 최대화가 이긴다', () => {
    expect(snapZone(1, 1, VW, VH)).toBe('max')
  })
})

describe('어디에 눕나', () => {
  it('반쪽 둘이 화면을 빈틈없이 덮는다', () => {
    const l = snapRect('left', VW, VH, BAR)
    const r = snapRect('right', VW, VH, BAR)
    expect(l.x).toBe(0)
    expect(l.x + l.w).toBe(r.x)          // 사이에 틈이 없다
    expect(r.x + r.w).toBe(VW)           // 오른쪽 끝까지 닿는다
    expect(l.h).toBe(VH - BAR)
    expect(r.h).toBe(VH - BAR)
  })

  it('홀수 폭에서도 틈이 없다', () => {
    const l = snapRect('left', 1281, VH, BAR)
    const r = snapRect('right', 1281, VH, BAR)
    expect(l.w + r.w).toBe(1281)
  })

  it('아주 좁은 화면에서도 창이 최소 크기 아래로 눌리지 않는다', () => {
    const l = snapRect('left', 300, 200, BAR)
    expect(l.w).toBeGreaterThanOrEqual(MIN_SIZE.w)
    expect(l.h).toBeGreaterThanOrEqual(MIN_SIZE.h)
  })

  it('최대화는 자리가 아니라 상태다 — 여기서 사각형을 주지 않는다', () => {
    expect(snapRect('max', VW, VH, BAR)).toBe(null)
    expect(snapRect(null, VW, VH, BAR)).toBe(null)
  })
})
