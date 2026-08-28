import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'

// 요청을 받고도 어디서부터 봐야 할지 모를 때, 입력줄 위의 버튼으로 되물어
// 1번 힌트를 듣는다. 버튼은 화면에 그냥 떠 있으므로 그 문구 자체가 답이나
// 힌트를 흘리면 안 된다 — 누르지도 않았는데 힌트를 준 셈이 된다.
const asks = []
const walk = (n) => {
  if (Array.isArray(n)) return n.forEach(walk)
  if (n && typeof n === 'object') {
    if (n.no?.length && (n.accept || n.files || n.free)) asks.push(n)
    Object.values(n).forEach(walk)
  }
}
walk(scenario)

const loose = (v) => String(v).replace(/\s/g, '').toLowerCase()

describe('되묻기 버튼', () => {
  it('되물을 수 있는 요청이 있다', () => {
    expect(asks.length).toBeGreaterThan(100)
  })

  it('문구를 안 적어 둔 요청도 쓸 말이 있다', () => {
    const src = readFileSync('src/apps/Messenger.jsx', 'utf8')
    expect(src).toContain('const HINT_ASK =')
    expect(src).toContain('ask.hintAsk ?? HINT_ASK')
  })

  it('버튼 문구가 정답을 흘리지 않는다', () => {
    for (const ask of asks.filter((a) => a.hintAsk)) {
      for (const a of [].concat(ask.accept ?? [])) {
        if (typeof a !== 'string') continue
        expect(loose(ask.hintAsk), `${ask.hintAsk} ← ${a}`).not.toContain(loose(a))
      }
    }
  })

  it('버튼 문구가 첫 힌트를 미리 말해 버리지 않는다', () => {
    for (const ask of asks.filter((a) => a.hintAsk)) {
      for (const line of [].concat(ask.no[0] ?? [])) {
        expect(loose(ask.hintAsk), ask.hintAsk).not.toBe(loose(line))
      }
    }
  })

  // 되묻기는 틀린 답이 아니다. slip() 은 오답률을 쌓아 정리해고 엔딩을 부르므로,
  // 물어봤다고 해고당하면 안 된다.
  it('되묻기가 오답으로 세지 않는다', () => {
    const src = readFileSync('src/apps/Messenger.jsx', 'utf8')
    const at = src.indexOf('const askHint = () => {')
    expect(at, 'askHint 가 없다').toBeGreaterThan(-1)
    const body = src.slice(at, src.indexOf('\n  }', at))
    expect(body.includes('slip()'), '되묻기가 slip() 을 부른다').toBe(false)
    expect(body).toContain('nextHint()')
  })
})
