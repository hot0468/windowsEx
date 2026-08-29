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
