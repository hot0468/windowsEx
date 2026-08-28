import { describe, expect, it } from 'vitest'
import { pickShell } from '../src/shell/useViewport.js'

describe('셸 선택', () => {
  it('좁은 화면은 폰이다', () => {
    expect(pickShell({ width: 390, coarse: true })).toBe('phone')
  })

  it('넓은 화면은 데스크톱이다', () => {
    expect(pickShell({ width: 1440, coarse: false })).toBe('desktop')
  })

  it('경계는 820px이다', () => {
    expect(pickShell({ width: 820, coarse: false })).toBe('phone')
    expect(pickShell({ width: 821, coarse: false })).toBe('desktop')
  })

  // 태블릿·터치 노트북: 넓으면 데스크톱이 낫다. 창을 쓸 자리가 있다.
  it('넓은 터치 화면은 데스크톱이다', () => {
    expect(pickShell({ width: 1024, coarse: true })).toBe('desktop')
  })

  // 좁은 데스크톱 창(마우스)에서도 폰 셸이 맞다 — 창이 들어갈 자리가 없다.
  it('마우스여도 좁으면 폰이다', () => {
    expect(pickShell({ width: 500, coarse: false })).toBe('phone')
  })

  it('강제 지정이 판별을 이긴다', () => {
    expect(pickShell({ width: 1440, coarse: false, force: 'phone' })).toBe('phone')
    expect(pickShell({ width: 390, coarse: true, force: 'desktop' })).toBe('desktop')
  })

  it('알 수 없는 강제값은 무시한다', () => {
    expect(pickShell({ width: 1440, coarse: false, force: 'watch' })).toBe('desktop')
  })
})
