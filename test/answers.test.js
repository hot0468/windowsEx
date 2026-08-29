import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { answerFits } from '../src/engine/store.js'

const steps = (ask) => (ask ? [ask, ...steps(ask.then)] : [])
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))

// every question the player can ever be asked, wherever it lives
const asks = [
  ...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).flatMap(steps),
  ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => steps(a.ask))),
  ...Object.values(scenario.overtime.days).flatMap((d) => d.asks.flatMap((a) => steps(a.ask))),
  ...scenario.pool.requests.flatMap((r) => steps(r.beat.ask)),
  // the caller's questions are questions too
  ...steps(scenario.summons?.beat?.ask)
].filter((a) => a?.accept)

const answers = [...new Set(asks.flatMap((a) => a.accept.flat()))]

describe('answerFits', () => {
  it('forgives spacing and case, the way it always has', () => {
    expect(answerFits({ accept: ['AR-PC-2104'] }, ' ar-pc-2104 ')).toBe(true)
    expect(answerFits({ accept: ['3,450,000'] }, '총액은 3,450,000 원입니다')).toBe(true)
    expect(answerFits({ accept: [['연장근로수당', '1,240,000']] }, '연장근로수당 1,240,000')).toBe(true)
    expect(answerFits({ accept: [['연장근로수당', '1,240,000']] }, '연장근로수당만')).toBe(false)
  })

  it('makes a number stand on its own', () => {
    // typing the extension 1180 used to answer a question whose answer is 180
    expect(answerFits({ accept: ['180'] }, '1180')).toBe(false)
    expect(answerFits({ accept: ['180'] }, '1805')).toBe(false)
    expect(answerFits({ accept: ['180'] }, '180')).toBe(true)
    expect(answerFits({ accept: ['180'] }, '재고는 180대입니다')).toBe(true)
    expect(answerFits({ accept: ['1180'] }, '180')).toBe(false)
  })

  it('still lets a word answer sit inside a longer word', () => {
    // 연장근로 is deliberately accepted as a prefix of 연장근로수당
    expect(answerFits({ accept: ['연장근로'] }, '연장근로수당')).toBe(true)
  })
})

describe('the answers the game actually asks for', () => {
  it('never lets one number be swallowed by another', () => {
    // Two numeric answers where one contains the other used to be answerable
    // with the wrong one. Words are different: 역전할머니맥주 is meant to answer
    // whether or not the player adds 강남점, and 연장근로 whether or not they
    // add 수당. Only digits get the boundary, so only digits are checked here.
    const numeric = answers.filter((a) => /^[\d,.-]+$/.test(a.replace(/\s/g, '')))
    expect(numeric.length).toBeGreaterThan(20)
    for (const answer of numeric) {
      for (const other of numeric) {
        if (answer === other || !other.includes(answer)) continue
        expect(answerFits({ accept: [answer] }, other), `"${other}" answers "${answer}"`).toBe(false)
      }
    }
  })

  it('accepts every answer as written, at every question that wants it', () => {
    for (const ask of asks) {
      for (const entry of ask.accept) {
        const typed = (Array.isArray(entry) ? entry : [entry]).join(' ')
        expect(answerFits(ask, typed), `${ask.placeholder} :: ${typed}`).toBe(true)
      }
    }
  })
})

// 숫자 답에 구분 기호까지 맞춰 치라고 요구하면, 제대로 아는 사람이 퇴짜를
// 맞는다. 전화번호를 하이픈 없이, 금액을 쉼표 없이, 날짜를 점으로 적는 것은
// 다른 답이 아니라 같은 답이다.
describe('숫자 답의 구분 기호', () => {
  const ask = (...accept) => ({ accept })

  it('전화번호는 하이픈이 있든 없든 같다', () => {
    const a = ask('010-0000-8102')
    for (const t of ['010-0000-8102', '01000008102', '010 0000 8102', '010.0000.8102']) {
      expect(answerFits(a, t), t).toBe(true)
    }
  })

  it('금액은 쉼표가 있든 없든 같다', () => {
    const a = ask('59,400')
    for (const t of ['59,400', '59400', '59,400원']) expect(answerFits(a, t), t).toBe(true)
  })

  it('날짜는 하이픈이든 점이든 같다', () => {
    const a = ask('2026-05-30')
    for (const t of ['2026-05-30', '2026.05.30', '20260530']) expect(answerFits(a, t), t).toBe(true)
  })

  // 기호를 떼고 나서도 자릿수 경계는 지킨다 — 내선 1180 이 재고 180 의
  // 답이 되면 안 된다.
  it('그래도 다른 숫자 안에 묻혀 있으면 답이 아니다', () => {
    expect(answerFits(ask('180'), '1180')).toBe(false)
    expect(answerFits(ask('180'), '180개')).toBe(true)
    expect(answerFits(ask('010-0000-8102'), '010-0000-81021')).toBe(false)
  })

  it('글자가 섞인 답은 예전처럼 그대로 본다', () => {
    expect(answerFits(ask('00-1A-7D-4C-9E-21'), '001A7D4C9E21')).toBe(false)
    expect(answerFits(ask('00-1A-7D-4C-9E-21'), '00-1A-7D-4C-9E-21')).toBe(true)
  })
})

// 시각은 적는 방법이 여럿인데 정답은 한 가지 표기로만 적혀 있다. 물어본 대로
// 답한 사람이 표기 때문에 틀렸다는 말을 들으면 안 된다.
describe('시각 표기', () => {
  const ask = (...accept) => ({ accept })

  it('13:40 을 "13시 40분" 으로 답해도 같다', () => {
    const a = ask('13:40')
    for (const t of ['13:40', '13시 40분', '13시40분', '오후 1시 40분 아니고 13:40']) {
      expect(answerFits(a, t), t).toBe(true)
    }
  })

  it('한 자리 시각은 0을 채우든 안 채우든 같다', () => {
    expect(answerFits(ask('08:20'), '8:20')).toBe(true)
    expect(answerFits(ask('08:20'), '8시 20분')).toBe(true)
  })

  it('한글로 적힌 정답도 숫자로 답할 수 있다', () => {
    expect(answerFits(ask('오전 8시 30분'), '오전 08:30')).toBe(true)
    expect(answerFits(ask('오전 8시 30분'), '오전 8:30')).toBe(true)
  })

  it('분이 다르면 여전히 틀린 답이다', () => {
    expect(answerFits(ask('13:40'), '13시 30분')).toBe(false)
    expect(answerFits(ask('13:40'), '14:40')).toBe(false)
  })

  it('시각이 아닌 숫자는 건드리지 않는다', () => {
    expect(answerFits(ask('1,410,000'), '1410000')).toBe(true)
    expect(answerFits(ask('180'), '1180')).toBe(false)
  })
})
