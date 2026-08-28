import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'
import { hintKey, hintReply } from '../src/engine/store.js'

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
    expect(body).toContain('hintReply(')
  })
})

// 되묻기에 돌려주는 말은 오답에 돌려주는 말과 다르다. no 의 각 단계는 대개
// [틀렸다는 말, 실제 힌트] 인데, 답을 낸 적도 없는 사람에게 "그 날짜가 아닌
// 것 같은데요"로 답하면 대화가 이어지지 않는다.
describe('되묻기에 돌아오는 말', () => {
  it('퇴짜를 떼고 힌트만 준다', () => {
    const ask = { no: [['그 날짜가 아닌데요.', '제품 라인업 문서요.'], ['위키에 있어요.']] }
    expect(hintReply(ask, 0)).toEqual({ lines: ['제품 라인업 문서요.'], step: 1 })
  })

  it('퇴짜뿐인 단계는 건너뛴다', () => {
    const ask = { no: [['그 번호 아닌데요.'], ['아직 아니에요.', '위키 영업1팀 섹션이요.']] }
    expect(hintReply(ask, 0)).toEqual({ lines: ['위키 영업1팀 섹션이요.'], step: 2 })
  })

  it('줄 게 정말 없으면 마지막 단계를 그대로 준다', () => {
    const ask = { no: [['그거 아닌데'], ['아니야']] }
    expect(hintReply(ask, 0).lines).toEqual(['아니야'])
  })

  it('오답을 낸 뒤에 되물으면 그 자리에서 이어진다', () => {
    const ask = { no: [['틀렸어', '1번 힌트'], ['아직', '2번 힌트'], ['아니', '3번 힌트']] }
    expect(hintReply(ask, 1)).toEqual({ lines: ['2번 힌트'], step: 2 })
  })

  // 실제 시나리오에서도 되물었을 때 돌려줄 말이 남아야 한다.
  it('모든 요청이 되묻기에 답할 말을 갖고 있다', () => {
    for (const ask of asks) {
      const { lines } = hintReply(ask, 0)
      expect(lines.length, JSON.stringify(ask.no[0])).toBeGreaterThan(0)
    }
  })
})

// 한 번 물으면 버튼이 사라진다. 대화 하나가 하루에 요청을 둘 이상 맡으므로
// 대화 id 만으로 세면 두 번째 요청에서 버튼이 처음부터 안 뜬다.
describe('되묻기는 요청마다 한 번', () => {
  const a = { placeholder: '날짜를 입력해 주세요', accept: ['2026-05-30'], no: [['x', 'y']] }
  const b = { placeholder: '금액을 입력해 주세요', accept: ['1,410,000'], no: [['x', 'y']] }

  it('같은 요청은 같은 열쇠', () => {
    expect(hintKey('boss', a)).toBe(hintKey('boss', { ...a }))
  })

  it('같은 대화의 다른 요청은 다른 열쇠', () => {
    expect(hintKey('boss', a)).not.toBe(hintKey('boss', b))
  })

  it('다른 대화의 같은 요청은 다른 열쇠', () => {
    expect(hintKey('boss', a)).not.toBe(hintKey('junho', a))
  })

  it('물은 기록은 세이브에 남는다 — 창을 닫았다 열어도 버튼이 돌아오지 않는다', () => {
    const src = readFileSync('src/engine/store.js', 'utf8')
    const listed = src.match(/export const PROGRESS = \[([\s\S]*?)\]/)[1]
    expect(listed).toContain('hinted')
  })
})
