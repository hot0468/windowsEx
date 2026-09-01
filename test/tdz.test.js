import { describe, expect, it } from 'vitest'
import { globSync, readFileSync } from 'node:fs'

// 렌더 도중 터지면 에러 경계가 없어 화면이 통째로 하얘진다 — "폰에서 메신저를
// 눌렀는데 빈 페이지" 가 그것이었다. 원인은 늘 같은 모양이다: 컴포넌트 본문
// 위쪽에서 아래에 선언된 const 를 읽는 것(TDZ). 함수 안에서 읽는 것은 호출이
// 늦으므로 괜찮고, 즉시 계산되는 초기식만 터진다 — 그것만 본다.
const files = globSync('src/**/*.{js,jsx}')

const DECL = /^(\s*)(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=(.*)$/
const NAME = /[A-Za-z_$][\w$]*/g
// 이름이 아닌 것들: 주석 · 문자열 · 정규식의 \d 같은 이스케이프 · .속성
const NOT_NAME = [/\/\/.*$/g, /'[^']*'|"[^"]*"|`[^`]*`/g, /\\[A-Za-z]/g, /\.\s*[A-Za-z_$][\w$]*/g]

export const scan = (src) => {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const bad = []
  lines.forEach((line, i) => {
    const m = DECL.exec(line)
    if (!m || /=>|\bfunction\b/.test(m[3])) return
    const init = NOT_NAME.reduce((s, re) => s.replace(re, ''), m[3])
    const names = new Set(init.match(NAME) ?? [])
    for (let j = i + 1; j < lines.length; j++) {
      // 들여쓰기가 얕아지면 그 블록은 끝났다 — 그 뒤의 같은 이름은 남의 것이다.
      if (lines[j].trim() && /^\s*/.exec(lines[j])[0].length < m[1].length) break
      const d = DECL.exec(lines[j])
      if (d && d[1] === m[1] && names.has(d[2])) bad.push(`${i + 1}행 ${m[2]} → ${d[2]} (${j + 1}행 선언)`)
    }
  })
  return bad
}

describe('아래에서 선언한 값을 위에서 읽지 않는다', () => {
  it('검사가 실제로 TDZ 를 잡는다', () => {
    expect(scan('  const a = !b\n  const b = 1\n')).toEqual(['1행 a → b (2행 선언)'])
    expect(scan('  const a = () => b\n  const b = 1\n')).toEqual([])   // 호출은 나중
    expect(scan("  const a = x('b:')\n  const b = 1\n")).toEqual([])   // 문자열 속
    expect(scan('  const a = x.b\n  const b = 1\n')).toEqual([])       // 속성 이름
    expect(scan('  { const a = 1 }\n  const b = a\n')).toEqual([])     // 다른 블록
  })
  for (const f of files) {
    it(f, () => expect(scan(readFileSync(f, 'utf8'))).toEqual([]))
  }
})
