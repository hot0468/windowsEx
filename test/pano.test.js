import { describe, expect, it } from 'vitest'
import { FOV_H, FOV_V, VIEW, isPano, lookAt, panoFrame, reachOf } from '../src/shell/pano.js'

// 180° 파노라마를 뷰파인더에 그리는 계산. 화면 없이 검사할 수 있게 순수
// 함수로 떼어 두었다 — 여기서 어긋나면 끝까지 기울였을 때 사진 밖이 보인다.

describe('파노라마인지 가리기', () => {
  it('2:1 이면 파노라마다', () => {
    expect(isPano({ width: 1456, height: 720 })).toBe(true)
    expect(isPano({ width: 4096, height: 2048 })).toBe(true)
  })

  it('세로로 긴 평면 사진은 아니다', () => {
    expect(isPano({ width: 896, height: 1200 })).toBe(false)
    expect(isPano({ width: 1440, height: 1920 })).toBe(false)
  })

  it('가로로 길어도 2:1 이 아니면 아니다', () => {
    expect(isPano({ width: 1920, height: 1080 })).toBe(false)   // 16:9
    expect(isPano({ width: 1000, height: 1000 })).toBe(false)
  })

  it('크기를 모르면 아니다', () => {
    expect(isPano()).toBe(false)
    expect(isPano({ width: 100, height: 0 })).toBe(false)
  })
})

describe('어디를 보는가', () => {
  it('기울이지 않으면 정면이다', () => {
    expect(lookAt({ x: 0, y: 0 })).toEqual({ yaw: 0, pitch: 0 })
  })

  // 파노라마 밖을 보면 검은 자리가 생긴다. 화면 가장자리를 촘촘히 훑어서
  // 어느 한 점도 밖으로 나가지 않아야 한다 — 모서리만 재다가 위쪽 변 한가운데가
  // 나가 검은 띠가 남았다. 가장 멀리 보는 곳은 모서리가 아니다.
  it('끝까지 기울여도 화면 어느 점도 사진 밖으로 나가지 않는다', () => {
    // 셰이더가 광선을 만드는 식 그대로
    const seen = (ux, uy, view, aspect, look) => {
      const t = Math.tan(view / 2)
      let d = [ux * aspect * t, uy * t, -1]
      const n = Math.hypot(...d)
      d = d.map((v) => v / n)
      const cp = Math.cos(look.pitch); const sp = Math.sin(look.pitch)
      d = [d[0], d[1] * cp - d[2] * sp, d[1] * sp + d[2] * cp]
      const cy = Math.cos(look.yaw); const sy = Math.sin(look.yaw)
      d = [d[0] * cy + d[2] * sy, d[1], -d[0] * sy + d[2] * cy]
      return { lon: Math.atan2(d[0], -d[2]), lat: Math.asin(Math.max(-1, Math.min(1, d[1]))) }
    }
    for (const aspect of [390 / 613, 0.5, 1, 1.5, 2]) {
      for (const [x, y] of [[1, 1], [-1, -1], [1, -1], [-1, 1], [0, 1], [1, 0]]) {
        const look = lookAt({ x, y }, VIEW, aspect)
        for (let i = -20; i <= 20; i++) {
          const u = i / 20
          for (const [ux, uy] of [[u, 1], [u, -1], [1, u], [-1, u]]) {
            const p = seen(ux, uy, VIEW, aspect, look)
            expect(Math.abs(p.lon), `aspect ${aspect} uv ${ux},${uy}`).toBeLessThanOrEqual(FOV_H / 2 + 1e-9)
            expect(Math.abs(p.lat), `aspect ${aspect} uv ${ux},${uy}`).toBeLessThanOrEqual(FOV_V / 2 + 1e-9)
          }
        }
      }
    }
  })

  // 가장 멀리 보는 곳은 변의 한가운데다. 모서리는 오히려 덜 간다.
  it('가장 멀리 보는 곳을 잰다', () => {
    const aspect = 390 / 613
    const r = reachOf(VIEW, aspect)
    const t = Math.tan(VIEW / 2)
    const corner = Math.abs(Math.asin(t / Math.hypot(aspect * t, t, 1)))
    expect(r.lat).toBeGreaterThan(corner)
    expect(r.lat).toBeCloseTo(Math.atan(t), 10)
  })

  it('범위를 넘겨 넣어도 끝에서 멈춘다', () => {
    expect(lookAt({ x: 5, y: 5 })).toEqual(lookAt({ x: 1, y: 1 }))
    expect(lookAt({ x: -5, y: -5 })).toEqual(lookAt({ x: -1, y: -1 }))
  })

  it('좌우가 위아래보다 더 돈다 — 가로가 두 배 넓으므로', () => {
    const a = lookAt({ x: 1, y: 1 })
    expect(a.yaw).toBeGreaterThan(a.pitch)
  })

  // 화각이 넓어질수록 돌 자리가 줄어든다. 어떤 값을 넣어도 거꾸로 돌지는
  // 않는다 — 음수가 되면 기울인 반대쪽을 보게 된다.
  it('화각이 넓어질수록 덜 돌고, 거꾸로는 돌지 않는다', () => {
    const narrow = lookAt({ x: 1, y: 1 }, VIEW, 1)
    const wide = lookAt({ x: 1, y: 1 }, VIEW * 2, 1)
    expect(wide.yaw).toBeLessThan(narrow.yaw)
    expect(wide.pitch).toBeLessThan(narrow.pitch)
    for (const [v, a] of [[VIEW * 2.6, 1], [VIEW * 2.6, 4], [VIEW, 12]]) {
      const r = lookAt({ x: 1, y: 1 }, v, a)
      expect(r.yaw, `view ${v} aspect ${a}`).toBeGreaterThanOrEqual(0)
      expect(r.pitch, `view ${v} aspect ${a}`).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('찍은 자리 남기기', () => {
  it('정면은 한가운데다', () => {
    expect(panoFrame({ x: 0, y: 0 })).toEqual({ x: 50, y: 50 })
  })

  it('사진 안(0~100%)에 머문다', () => {
    for (const [x, y] of [[1, 1], [-1, -1], [0.5, -0.5]]) {
      const f = panoFrame({ x, y })
      expect(f.x).toBeGreaterThanOrEqual(0)
      expect(f.x).toBeLessThanOrEqual(100)
      expect(f.y).toBeGreaterThanOrEqual(0)
      expect(f.y).toBeLessThanOrEqual(100)
    }
  })

  it('기울인 쪽으로 옮겨 간다', () => {
    expect(panoFrame({ x: 1, y: 0 }).x).toBeGreaterThan(50)
    expect(panoFrame({ x: -1, y: 0 }).x).toBeLessThan(50)
    expect(panoFrame({ x: 0, y: 1 }).y).toBeGreaterThan(50)
  })
})
