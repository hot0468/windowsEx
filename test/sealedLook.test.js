import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// 부고를 본 다음 화면이 어두워지는 것은 CSS 한 줄에 걸려 있다. 그 줄이 사라지면
// 아무 테스트도 실패하지 않고 연출만 조용히 없어지므로, 여기서 못 박는다.
const css = readFileSync('src/shell/shell.css', 'utf8')

describe('부고를 본 뒤의 바탕화면', () => {
  it('굳으면 바탕화면이 어두워진다', () => {
    expect(css).toMatch(/\.desktop\.sealed::before\s*\{[^}]*background:/)
  })

  it('창이 아니라 배경만 덮는다 — 굳은 창의 부고는 그대로 읽혀야 한다', () => {
    // ::before 에만 걸린다. .desktop.sealed 자체에 어두운 배경을 칠하면
    // filter 와 겹쳐 창까지 가라앉는다.
    const sealed = css.match(/\.desktop\.sealed\s*\{[^}]*\}/)[0]
    expect(sealed).not.toMatch(/rgba\(5, ?8, ?18/)
  })

  it('순간적으로 꺼지지 않는다 — 그러면 고장으로 보인다', () => {
    const before = css.match(/\.desktop::before\s*\{[^}]*\}/)[0]
    expect(before).toMatch(/transition:\s*background/)
  })
})
