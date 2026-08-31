import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// touch-action 은 실기기에서만 드러나는 종류의 고장을 만든다. 마우스는 이
// 속성을 보지 않으므로 PC 에서는 멀쩡하고 폰에서만 손짓이 죽는다 — 실제로
// 홈에서 위로 밀어 앱 서랍을 여는 손짓이 그렇게 죽어 있었다. 앞에서 none 을
// 주고 뒤에서 pan-y 로 덮었는데, 뒤가 이긴다.
//
// 규칙은 하나다: 세로 손짓을 앱이 쓰는 자리에는 pan-y 를 주면 안 된다.
// pan-y 는 세로를 브라우저 스크롤에 양보한다는 뜻이라, 그 자리의 세로
// 손짓은 앱에 오지 않는다.

const css = readFileSync(new URL('../src/shell/phone.css', import.meta.url), 'utf8')
const lines = css.split(/\r?\n/)

// 어느 선택자에 **마지막으로** 적용되는 touch-action 값. 구체도가 같으면
// 뒤에 오는 규칙이 이기므로, 마지막 것이 실제로 먹는 값이다.
const lastTouchAction = (selector) => {
  let value = null
  for (let i = 0; i < lines.length; i++) {
    const hit = /touch-action:\s*([a-z-]+)/.exec(lines[i])
    if (!hit) continue
    // 이 줄이 속한 규칙의 여는 줄을 위로 거슬러 찾는다. (@media 안에 규칙이
    // 중첩돼 있어 파일 전체에 정규식을 걸면 경계를 잘못 잡는다.)
    let head = ''
    for (let j = i; j >= 0; j--) {
      if (lines[j].includes('{')) { head = lines[j]; break }
    }
    const sels = head.split('{')[0].split(',').map((x) => x.trim())
    if (sels.some((x) => x === selector || x.endsWith(` ${selector}`))) value = hit[1]
  }
  return value
}

describe('세로 손짓을 앱이 쓰는 자리', () => {
  // 홈: 위로 밀면 앱 서랍이 열린다. 서랍: 아래로 밀면 닫힌다.
  it('홈과 서랍은 세로를 브라우저에 넘기지 않는다', () => {
    expect(lastTouchAction('.ph-home')).toBe('none')
    expect(lastTouchAction('.ph-drawer')).toBe('none')
  })

  // 상태바를 끌어내려 설정창을 연다.
  it('상태바도 그렇다', () => {
    expect(lastTouchAction('.ph-drag')).toBe('none')
  })

  // 카메라 뷰파인더는 끌어서 파노라마를 둘러본다.
  it('카메라 뷰파인더도 그렇다', () => {
    expect(lastTouchAction('.cam-view')).toBe('none')
  })

  // 반대로 목록은 스크롤이 손가락에 붙어야 한다 — 앱이 가로채면 뻑뻑해진다.
  it('스크롤하는 목록은 세로를 브라우저에 맡긴다', () => {
    expect(lastTouchAction('.phone-body')).toBe('pan-y')
    expect(lastTouchAction('.ph-todo')).toBe('pan-y')
  })
})
