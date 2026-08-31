import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { useGame, allFiles, answerFits } from '../src/engine/store.js'
import { meetAskOf, peopleOf } from '../src/apps/Meet.jsx'

// 화상회의 폼. 회의 하루 전에 자료가 오고, 당일 링크가 오고, 들어가면 자료를
// 봤는지 묻는다. 질문은 주최자 스레드의 보통 질문에 meet 표식이 붙은 것이라
// 정답의 존재·유일성·도달성은 기존 검사가 그대로 본다. 여기서 보는 것은 이
// 폼만의 깨지는 방식이다 — 자료가 회의보다 늦게 오거나, 답이 자료에 없거나,
// 회의가 답을 미리 말해 버리거나, 채팅에서 답할 수 있게 되는 것.

const scenario = JSON.parse(
  readFileSync(new URL('../src/scenarios/workday.json', import.meta.url), 'utf8'))
const steps = (a) => (a ? [a, ...steps(a.then)] : [])
const files = allFiles(scenario.fs)

const dayBeats = scenario.days.flatMap((d) => (d.asks ?? []).map((beat) => ({ day: d.n, beat })))
const meetBeats = dayBeats.filter(({ beat }) => steps(beat.ask).some((a) => a.meet))
const meetSteps = meetBeats.flatMap(({ beat }) => steps(beat.ask))
const accepts = (a) => (a.accept ?? []).flat()

describe('화상회의 폼', () => {
  it('회의가 있고, 질문마다 그 회의가 실제로 있다', () => {
    expect(meetBeats.length).toBeGreaterThan(0)
    for (const { beat } of meetBeats) {
      for (const a of steps(beat.ask)) {
        const m = scenario.meetings?.[a.meet]
        expect(m, a.meet).toBeTruthy()
        // 질문을 거는 스레드가 곧 주최자다 — 회의 앱은 그 스레드의 질문을 읽는다
        expect(m.host, a.meet).toBe(beat.thread)
      }
    }
  })

  // 체인 중간에 meet 없는 단계가 끼면 그 단계는 채팅 입력칸으로 떨어진다 —
  // 회의 도중에 갑자기 톡으로 답하라는 셈이 된다.
  it('한 체인의 모든 단계가 같은 회의에 붙어 있다', () => {
    for (const { beat } of meetBeats) {
      const ids = new Set(steps(beat.ask).map((a) => a.meet))
      expect([...ids], beat.thread).toHaveLength(1)
      expect([...ids][0]).toBeTruthy()
    }
  })

  it('참석자는 실제 스레드고, 나는 맨 끝에 선다', () => {
    const threads = scenario.workMessenger.sections.flatMap((x) => x.threads).map((t) => t.id)
    for (const [id, m] of Object.entries(scenario.meetings)) {
      for (const p of m.people) expect(threads, id).toContain(p)
      expect(m.people, id).toContain(m.host)
      const ppl = peopleOf(scenario, m)
      expect(ppl[ppl.length - 1].me).toBe(true)
      expect(ppl.some((p) => p.id === m.host)).toBe(true)
    }
  })

  it('자료는 회의 전날, 같은 사람이 보낸다', () => {
    for (const { day, beat } of meetBeats) {
      const before = dayBeats.filter((x) => x.day === day - 1 && x.beat.thread === beat.thread && x.beat.attach)
      expect(before.length, `${beat.thread} day ${day}`).toBeGreaterThan(0)
      for (const { beat: b } of before) {
        const f = files.find((x) => x.id === b.attach.fileId)
        expect(f, b.attach.fileId).toBeTruthy()
        // 저장을 누르기 전에는 디스크에 없다 — 메일 첨부와 같은 규칙
        expect(f.attached).toBe(true)
        expect(f.name).toBe(b.attach.name)
      }
    }
  })

  it('답은 전부 그 자료 안에 있다 — 한 번이라도 봤으면 맞춘다', () => {
    for (const { day, beat } of meetBeats) {
      const material = dayBeats.filter((x) => x.day === day - 1 && x.beat.thread === beat.thread && x.beat.attach)
        .map(({ beat: b }) => files.find((x) => x.id === b.attach.fileId)?.content ?? '').join('\n')
      for (const a of steps(beat.ask)) {
        expect(a.accept.some((entry) => [entry].flat().every((part) => material.includes(part))),
          a.placeholder).toBe(true)
      }
    }
  })

  it('회의도 링크를 보낸 말도 답을 미리 말하지 않는다', () => {
    const said = JSON.stringify({
      lines: meetBeats.map(({ beat }) => beat.lines),
      meetings: scenario.meetings,
      titles: scenario.objectives.map((o) => o.title),
      chatter: scenario.chatter.map((c) => c.beat.lines),
      ok: meetSteps.map((a) => a.ok),
      hints: meetSteps.map((a) => a.no)
    })
    for (const a of meetSteps) for (const part of accepts(a)) expect(said, part).not.toContain(part)
  })

  it('마지막 힌트는 자료 파일을 지목한다', () => {
    for (const { day, beat } of meetBeats) {
      const names = dayBeats.filter((x) => x.day === day - 1 && x.beat.attach).map((x) => x.beat.attach.name)
      for (const a of steps(beat.ask)) {
        const last = a.no[a.no.length - 1].join(' ')
        expect(names.some((n) => last.includes(n)), a.placeholder).toBe(true)
      }
    }
  })

  it('그날의 요청 목록에 올라 있다', () => {
    for (const { day, beat } of meetBeats) {
      const g = steps(beat.ask).map((a) => a.grants).filter(Boolean)
      expect(g).toHaveLength(1)
      expect(scenario.days[day - 1].requests).toContain(g[0])
      expect(scenario.pool.fixed[String(day)]).toContain(g[0])
      expect(scenario.meetings[steps(beat.ask)[0].meet].grants).toBe(g[0])
    }
  })

  it('회의 답도 채팅 답과 같은 판정을 쓴다', () => {
    for (const a of meetSteps) {
      expect(answerFits(a, accepts(a)[0])).toBe(true)
      expect(answerFits(a, '모르겠는데요')).toBe(false)
    }
  })
})

describe('회의 앱이 읽는 질문', () => {
  const meeting = { host: 'boss', people: ['boss'] }

  it('이 회의에 붙은 질문만 고른다', () => {
    expect(meetAskOf({ boss: { meet: 'kickoff', placeholder: 'q' } }, meeting, 'kickoff')?.placeholder).toBe('q')
    // 같은 사람이 다른 일로 물어 둔 것은 회의 화면에 새지 않는다
    expect(meetAskOf({ boss: { placeholder: 'q' } }, meeting, 'kickoff')).toBe(null)
    expect(meetAskOf({ boss: { meet: 'other', placeholder: 'q' } }, meeting, 'kickoff')).toBe(null)
    expect(meetAskOf({}, meeting, 'kickoff')).toBe(null)
    expect(meetAskOf({ boss: { meet: 'kickoff' } }, null, 'kickoff')).toBe(null)
  })
})

describe('채팅은 회의 질문에 입력칸을 내주지 않는다', () => {
  it('meet 분기가 입력칸보다 먼저 온다', () => {
    const src = readFileSync(new URL('../src/apps/Messenger.jsx', import.meta.url), 'utf8')
    const branch = src.indexOf('ask?.meet')
    const input = src.indexOf('className="quick-input"')
    expect(branch).toBeGreaterThan(-1)
    expect(input).toBeGreaterThan(-1)
    expect(branch).toBeLessThan(input)
  })
})

describe('beat 끝에 붙은 파일', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ extraMessages: {}, beatQueue: [], beatAsk: null, pendingAsks: {}, windows: [] })
  })
  afterEach(() => vi.useRealTimers())

  it('대화를 보고 있지 않아도 도착한다', () => {
    useGame.getState().queueBeats([{
      source: 'workMessenger', thread: 'boss', from: '박 팀장', lines: ['자료 보내요.'],
      attach: { name: 'x.pdf', size: '1MB', fileId: 'file_kickoff_deck' }
    }], 0)
    vi.runAllTimers()
    const got = useGame.getState().extraMessages.boss ?? []
    expect(got.some((m) => m.text === '자료 보내요.')).toBe(true)
    const card = got.find((m) => m.fileId === 'file_kickoff_deck')
    expect(card).toBeTruthy()
    expect(card.file).toBe('x.pdf')
    expect(card.size).toBe('1MB')
  })

  it('파일 없는 beat 는 예전과 똑같다', () => {
    useGame.getState().queueBeats([{ source: 'workMessenger', thread: 'boss', from: '박 팀장', lines: ['안녕'] }], 0)
    vi.runAllTimers()
    const got = useGame.getState().extraMessages.boss ?? []
    expect(got).toHaveLength(1)
    expect(got[0].fileId).toBeUndefined()
  })
})
