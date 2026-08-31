import { describe, expect, it } from 'vitest'
import { infoPull, swipeStep } from '../src/apps/Viewer.jsx'
import { settleBack } from '../src/shell/PhoneApp.jsx'
import { pullDir } from '../src/shell/useViewport.js'
import { fileCreated, fmtStampLong } from '../src/engine/store.js'
import { readFileSync } from 'node:fs'
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

// 보기 방식을 바꿔도 손짓은 같아야 한다. 아이콘 뷰만 한 번 탭이고 자세히
// 보기는 더블클릭이면, 폰에서 보기를 바꾼 순간 파일이 열리지 않는다.
describe('여는 손짓은 보기 방식과 무관하다', () => {
  const src = readFileSync(new URL('../src/apps/FileExplorer.jsx', import.meta.url), 'utf8')

  it('FileExplorer 안에 여는 onDoubleClick 이 남아 있지 않다', () => {
    const lines = src.split(/\r?\n/)
      .filter((l) => l.includes('onDoubleClick'))
      .filter((l) => !l.includes('stopPropagation'))
    expect(lines).toEqual([])
  })

  it('여는 자리는 모두 openTap 을 거친다', () => {
    // 폴더로 들어가는 곳과 파일을 여는 곳 — 아이콘 뷰와 자세히 보기 둘 다.
    expect((src.match(/openTap\(/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })
})

// 사진 정보는 아래에서 위로 밀어 올린다 — 안드로이드 갤러리의 그 손짓.
// 이미 있는 손짓 둘(옆으로 밀어 넘기기, 확대 중의 팬)과 겹치면 안 된다.
describe('사진 정보 밀어 올리기', () => {
  it('위로 충분히 밀면 정보가 열린다', () => {
    expect(infoPull({ dx: 4, dy: -90 })).toBe(1)
  })

  it('아래로 충분히 밀면 정보가 닫힌다', () => {
    expect(infoPull({ dx: 0, dy: 90, open: true })).toBe(-1)
  })

  it('짧게 스친 것은 손짓이 아니다', () => {
    expect(infoPull({ dx: 0, dy: -30 })).toBe(0)
    expect(infoPull({ dx: 0, dy: 40, open: true })).toBe(0)
  })

  // 가로가 더 길면 그건 사진을 넘기는 손짓이다. 두 손짓이 같은 화면에
  // 있으므로 여기서 갈라 두지 않으면 대각선에서 둘 다 발동한다.
  it('가로가 더 긴 손짓은 넘김이지 정보가 아니다', () => {
    expect(infoPull({ dx: -120, dy: -60 })).toBe(0)
    expect(swipeStep({ dx: -120, dy: -60 })).toBe(1)
  })

  // 확대 중의 세로 손짓은 사진을 위아래로 끄는 팬이다.
  it('확대 중에는 정보를 열지 않는다', () => {
    expect(infoPull({ dx: 0, dy: -140, zoomed: true })).toBe(0)
  })

  // 닫혀 있을 때 아래로 밀어도 더 닫을 것이 없고, 열려 있을 때 위로 밀어도
  // 더 열 것이 없다. 같은 손짓이 두 번 먹으면 화면이 덜컹인다.
  it('이미 그 상태면 아무 일도 없다', () => {
    expect(infoPull({ dx: 0, dy: 90 })).toBe(0)
    expect(infoPull({ dx: 0, dy: -90, open: true })).toBe(0)
  })
})

// 사진 정보가 실제로 무언가를 말해 주는가. 시트를 띄워 놓고 날짜 칸이
// 비어 있으면 손짓만 있고 알맹이가 없는 것이다.
describe('사진 정보에 찍은 날짜가 있다', () => {
  const scenario = JSON.parse(
    readFileSync(new URL('../src/scenarios/workday.json', import.meta.url), 'utf8'))

  const walk = (entries, trail, out = []) => {
    for (const e of entries) {
      if (e.children) walk(e.children, [...trail, e.name], out)
      else out.push({ file: e, path: trail })
    }
    return out
  }
  const all = Object.entries(scenario.fs).flatMap(([root, es]) => walk(es, [root]))
  const gallery = all.filter(({ file, path }) => file.image && path.includes('갤러리'))

  it('갤러리에 사진이 있다', () => {
    expect(gallery.length).toBeGreaterThan(0)
  })

  it('갤러리 사진은 모두 찍은 때를 읽을 수 있다', () => {
    for (const { file, path } of gallery) {
      const st = fileCreated(file, path)
      expect(st, file.name).toBeTruthy()
      expect(fmtStampLong(scenario, st)).toMatch(/\d{4}년 \d+월 \d+일 .요일/)
    }
  })

  // 정보 시트는 fileCreated 를 쓴다. 그 값이 파일마다 다르지 않으면
  // 사진을 넘겨도 같은 날짜가 나와 정보가 없는 것과 같다.
  it('사진마다 찍힌 때가 다르다', () => {
    const stamps = gallery.map(({ file, path }) => JSON.stringify(fileCreated(file, path)))
    expect(new Set(stamps).size).toBeGreaterThan(1)
  })
})

// 손을 뗀 순간 뒤로 갈지 제자리로 돌아갈지. 실제 폰은 거리만 보지 않는다 —
// 짧아도 빠르게 튕기면 넘어가고, 길어도 느리게 끌다 멈추면 돌아온다.
describe('뒤로 스와이프를 놓을 때', () => {
  it('충분히 끌었으면 뒤로 간다', () => {
    expect(settleBack({ dx: 120, vx: 0, width: 390 })).toBe(true)
  })

  it('조금 끌다 놓으면 제자리로 돌아온다', () => {
    expect(settleBack({ dx: 30, vx: 0, width: 390 })).toBe(false)
  })

  // 빠르게 튕기는 손짓(플릭)은 거리가 짧아도 넘어간다.
  it('짧아도 빠르게 튕기면 뒤로 간다', () => {
    expect(settleBack({ dx: 42, vx: 1.2, width: 390 })).toBe(true)
  })

  // 왼쪽으로 되돌리는 속도면 마음이 바뀐 것이다.
  it('되돌리는 속도면 돌아온다', () => {
    expect(settleBack({ dx: 120, vx: -1.4, width: 390 })).toBe(false)
  })

  // 화면이 넓으면 같은 픽셀도 덜 끈 것이다 — 비율로 본다.
  it('기준은 화면 폭에 따라 달라진다', () => {
    expect(settleBack({ dx: 120, vx: 0, width: 390 })).toBe(true)
    expect(settleBack({ dx: 120, vx: 0, width: 1200 })).toBe(false)
  })
})

// 위아래로 미는 손짓 하나로 앱 서랍을 여닫고 설정창을 내린다. 판별을 한 곳에
// 두지 않으면 화면마다 기준이 달라져, 어떤 데서는 되고 어떤 데서는 안 된다.
describe('위아래로 미는 손짓', () => {
  it('위로 충분히 밀면 -1, 아래로 밀면 1', () => {
    expect(pullDir({ dy: -80, dx: 4 })).toBe(-1)
    expect(pullDir({ dy: 80, dx: -4 })).toBe(1)
  })

  it('짧게 스친 것은 손짓이 아니다', () => {
    expect(pullDir({ dy: -20, dx: 0 })).toBe(0)
    expect(pullDir({ dy: 30, dx: 0 })).toBe(0)
  })

  // 가로가 더 길면 그건 옆으로 넘기는 손짓이다 — 대각선에서 둘 다 발동하면
  // 서랍이 열리면서 화면이 넘어간다.
  it('가로가 더 긴 손짓은 받지 않는다', () => {
    expect(pullDir({ dy: -80, dx: 120 })).toBe(0)
    expect(pullDir({ dy: 60, dx: -90 })).toBe(0)
  })

  // 설정창은 더 짧게 밀어도 닫힌다 — 이미 열려 있는 것을 내리는 손짓이라
  // 여는 것만큼 확실할 필요가 없다.
  it('기준 거리를 낮춰 부를 수 있다', () => {
    expect(pullDir({ dy: -30, dx: 0 })).toBe(0)
    expect(pullDir({ dy: -30, dx: 0 }, 24)).toBe(-1)
  })
})
