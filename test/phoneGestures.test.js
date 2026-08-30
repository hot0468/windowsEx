import { describe, expect, it } from 'vitest'
import { swipeStep } from '../src/apps/Viewer.jsx'
import { openTap } from '../src/shell/useViewport.js'

// 폰의 손짓 둘 — 사진을 옆으로 밀어 넘기고, 파일을 한 번 탭해 연다.
// 이 프로젝트에는 DOM 테스트 환경이 없으므로 판별만 순수 함수로 검사한다.

describe('사진을 옆으로 밀기', () => {
  it('왼쪽으로 밀면 다음, 오른쪽으로 밀면 이전', () => {
    expect(swipeStep({ dx: -120, dy: 4 })).toBe(1)
    expect(swipeStep({ dx: 120, dy: -8 })).toBe(-1)
  })

  it('짧은 끌림은 넘김이 아니다', () => {
    expect(swipeStep({ dx: -30, dy: 0 })).toBe(0)
    expect(swipeStep({ dx: 47, dy: 0 })).toBe(0)
  })

  it('세로가 더 긴 손짓은 스크롤이다', () => {
    expect(swipeStep({ dx: -60, dy: -90 })).toBe(0)
    expect(swipeStep({ dx: 60, dy: 60 })).toBe(0)
  })

  it('확대 중에는 같은 손짓이 팬이므로 넘기지 않는다', () => {
    expect(swipeStep({ dx: -200, dy: 0, zoomed: true })).toBe(0)
  })
})

describe('여는 손짓은 셸을 따른다', () => {
  const open = () => 'opened'

  it('폰에서는 한 번 탭', () => {
    const p = openTap('phone', open)
    expect(p.onClick).toBe(open)
    expect(p.onDoubleClick).toBeUndefined()
  })

  it('데스크톱에서는 더블클릭 그대로', () => {
    const p = openTap('desktop', open)
    expect(p.onDoubleClick).toBe(open)
    expect(p.onClick).toBeUndefined()
  })
})
