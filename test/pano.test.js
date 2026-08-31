import { describe, expect, it } from 'vitest'
import { FOV_H, FOV_V, VIEW, isPano, lookAt, panoFrame } from '../src/shell/pano.js'

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

  // 파노라마 밖을 보면 검은 자리가 생긴다. 끝까지 기울여도 남은 각도만큼만
  // 돌아야 가장자리가 비지 않는다.
  it('끝까지 기울여도 사진 밖으로 나가지 않는다', () => {
    const half = VIEW / 2
    for (const [x, y] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const { yaw, pitch } = lookAt({ x, y })
      expect(Math.abs(yaw) + half).toBeLessThanOrEqual(FOV_H / 2 + 1e-9)
      expect(Math.abs(pitch) + half).toBeLessThanOrEqual(FOV_V / 2 + 1e-9)
    }
  })

  it('범위를 넘겨 넣어도 끝에서 멈춘다', () => {
    expect(lookAt({ x: 5, y: 5 })).toEqual(lookAt({ x: 1, y: 1 }))
    expect(lookAt({ x: -5, y: -5 })).toEqual(lookAt({ x: -1, y: -1 }))
  })

  it('좌우가 위아래보다 더 돈다 — 가로가 두 배 넓으므로', () => {
    const a = lookAt({ x: 1, y: 1 })
    expect(a.yaw).toBeGreaterThan(a.pitch)
  })

  // 화각이 파노라마만큼 넓으면 돌 자리가 없다. 음수가 되어 거꾸로 돌면 안 된다.
  it('화각이 파노라마보다 넓으면 돌지 않는다', () => {
    expect(lookAt({ x: 1, y: 1 }, FOV_H * 2)).toEqual({ yaw: 0, pitch: 0 })
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
