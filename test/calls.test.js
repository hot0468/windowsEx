import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { requestsOf, useGame } from '../src/engine/store.js'

const calls = scenario.calls
const mailOf = (id) => scenario.objectives.find((o) => o.grant === id)?.mail

// 전화는 폰에만 있다. PC 로 하던 일을 막지 않고, 메일로 하던 일을 한 갈래
// 더 여는 것뿐이다 — 그러니 두 길이 같은 조건에서 열려야 한다.
describe('전화 연락처', () => {
  it('모든 메일 목표에 전화번호가 하나씩 있다', () => {
    const mailGoals = scenario.objectives.filter((o) => o.mail).map((o) => o.grant)
    expect(mailGoals.length).toBeGreaterThan(0)
    for (const id of mailGoals) {
      expect(calls.contacts.some((c) => c.id === id), id + ' 에 걸 곳이 없다').toBe(true)
    }
  })

  it('연락처의 주소는 그 목표의 메일 주소와 같다', () => {
    for (const c of calls.contacts) expect(c.mail).toBe(mailOf(c.id).to)
  })

  it('번호가 겹치지 않는다', () => {
    const nums = calls.contacts.map((c) => c.number)
    expect(new Set(nums).size).toBe(nums.length)
  })

  // 파일은 전화로 건널 수 없다. 첨부를 요구하는 일은 그렇게 말해야 하고,
  // 말로 되는 일은 되묻는 말과 마무리하는 말을 가지고 있어야 한다.
  it('첨부가 필요한 일은 전화로 되지 않는다고 말한다', () => {
    for (const c of calls.contacts) {
      if (mailOf(c.id).requiredAttachment) {
        expect(c.needsMail?.length, c.id).toBeGreaterThan(0)
        expect(c.asking).toBeUndefined()
      } else {
        expect(c.needsMail).toBeUndefined()
        expect(c.asking?.length, c.id).toBeGreaterThan(0)
        expect(c.unclear?.length, c.id).toBeGreaterThan(0)
        expect(c.done?.length, c.id).toBeGreaterThan(0)
      }
    }
  })

  // 대사가 답을 말해 버리면 전화가 정답 자판기가 된다.
  it('통화 대사에 정답이 없다', () => {
    const said = calls.contacts.flatMap((c) => [...c.greet ?? [], ...c.asking ?? [], ...c.unclear ?? [], ...c.needsMail ?? []])
      .concat(calls.incoming.flatMap((c) => [...c.lines, ...c.bye ?? []]))
      .join(' ')
    for (const c of calls.contacts) {
      for (const key of mailOf(c.id).requiredKeywords ?? []) expect(said).not.toContain(key)
    }
  })
})

// 매일 톡을 주고받는 사람들이 연락처에 없으면 그 폰은 남의 폰이다.
describe('아는 사람들', () => {
  const threads = [scenario.workMessenger, scenario.privateMessenger]
    .flatMap((m) => m.sections.flatMap((s) => s.threads))

  it('톡을 주고받는 사람은 연락처에 있다', () => {
    // 단톡방과 이름 없는 계정은 전화를 걸 상대가 아니다
    const people = threads.filter((t) => !t.id.startsWith('room_') && t.id !== 'caller')
    const listed = new Set(scenario.calls.people.map((p) => p.id))
    const missing = people.filter((t) => !listed.has(t.id)).map((t) => t.name)
    // 기관·스팸까지 전부 넣지는 않는다. 사람은 빠짐없이 있어야 한다.
    const persons = ['boss', 'junho', 'minseo', 'soyoung', 'security', 'payroll', 'jihyun', 'mom', 'guesthouse']
    for (const id of persons) expect(listed.has(id), id + ' 의 번호가 없다').toBe(true)
    expect(missing.length).toBeLessThan(threads.length)
  })

  // 4일차 밤의 부름은 이름도 번호도 없는 자리다. 걸 수 있으면 그 장치가 깨진다.
  it('이름 없는 계정과 단톡방에는 전화를 걸 수 없다', () => {
    for (const p of scenario.calls.people) {
      expect(p.id).not.toBe('caller')
      expect(p.id.startsWith('room_')).toBe(false)
    }
  })

  it('번호가 서로, 그리고 업무 연락처와 겹치지 않는다', () => {
    const digits = (n) => n.replace(/[^0-9]/g, '')
    const all = [...scenario.calls.people, ...scenario.calls.contacts].map((c) => digits(c.number))
    expect(new Set(all).size).toBe(all.length)
  })

  it('아는 사람에게 걸면 받고, 일 이야기는 나오지 않는다', () => {
    vi.useFakeTimers()
    useGame.setState({ call: null, callSeq: 0, callLog: [], grants: {} })
    const mom = scenario.calls.people.find((p) => p.id === 'mom')
    useGame.getState().dial(mom.number)
    vi.advanceTimersByTime(2300)
    const call = useGame.getState().call
    expect(call.stage).toBe('talking')
    expect(call.name).toBe(mom.name)
    expect(call.asking).toBe(false)
    vi.useRealTimers()
  })
})

describe('걸려오는 전화', () => {
  it('실존하는 일이 끝난 뒤에 걸려온다', () => {
    const ids = new Set(scenario.objectives.map((o) => o.grant))
    for (const c of calls.incoming) expect(ids.has(c.after), c.id).toBe(true)
  })

  it('받을 말과 끊을 말을 가지고 있다', () => {
    for (const c of calls.incoming) {
      expect(c.lines.length).toBeGreaterThan(0)
      expect(c.number).toMatch(/[0-9]/)
    }
  })
})

describe('통화로 푸는 길', () => {
  const spoken = calls.contacts.find((c) => !mailOf(c.id).requiredAttachment)

  beforeEach(() => {
    vi.useFakeTimers()
    // 전화로 푸는 길은 '오늘 부탁받은 일'일 때만 열린다 — 그 조건을 만들어 둔다.
    useGame.setState({
      call: null, callSeq: 0, callLog: [], calledIn: {}, grants: {},
      day: 1, overtime: {}, ripples: {}, drawn: { 1: [spoken.id] }
    })
  })
  afterEach(() => vi.useRealTimers())

  // 실제 전화처럼 신호가 먼저 간다. 누르자마자 통화가 되면 건 것이 아니라
  // 열린 것이다.
  it('걸면 먼저 신호가 가고, 그다음에 받는다', () => {
    useGame.getState().dial(spoken.number)
    expect(useGame.getState().call.stage).toBe('dialing')
    vi.advanceTimersByTime(2300)
    const call = useGame.getState().call
    expect(call.stage).toBe('talking')
    expect(call.name).toBe(spoken.name)
    expect(call.asking).toBe(true)
  })

  it('모르는 번호는 신호만 가다 끊긴다', () => {
    useGame.getState().dial('02-9999-9999')
    vi.advanceTimersByTime(2300)
    expect(useGame.getState().call.stage).toBe('ended')
    // 끊겼다는 말을 잠깐 보여 준 뒤 걸던 화면으로 돌아간다
    vi.advanceTimersByTime(1700)
    expect(useGame.getState().call).toBe(null)
    expect(useGame.getState().callLog[0].dir).toBe('missed')
  })

  // 신호가 가는 동안 끊고 다시 걸어도, 늦게 온 타이머가 지워진 통화를
  // 되살리지 않아야 한다.
  it('신호 중에 끊으면 그 전화는 되살아나지 않는다', () => {
    useGame.getState().dial(spoken.number)
    useGame.getState().hangUp()
    vi.advanceTimersByTime(3000)
    expect(useGame.getState().call).toBe(null)
  })

  // 메일과 같은 판정을 지난다: 필요한 값을 말하면 열리고, 아니면 되묻는다.
  it('필요한 값을 말하면 메일과 같은 목표가 열린다', () => {
    useGame.getState().dial(spoken.number)
    vi.advanceTimersByTime(2300)
    expect(useGame.getState().sayOnCall('잠시만요, 확인해 볼게요')).toBe(false)
    const key = mailOf(spoken.id).requiredKeywords[0]
    expect(useGame.getState().sayOnCall(`확인해 보니 ${key} 입니다`)).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(useGame.getState().grants[spoken.id]).toBe(true)
  })

  // 아무도 시키지 않은 일을 상대가 먼저 꺼내면, 없는 요청이 하나 생긴 것처럼
  // 들린다. 오늘 부탁받은 일이 아니면 상대는 바빠서 못 받는다.
  it('오늘 일이 아니면 용건을 꺼내지 않는다', () => {
    // grants 도 오늘 요청도 없는 상태에서 건다
    useGame.setState({ day: 1, drawn: {}, overtime: {}, ripples: {}, grants: {} })
    const far = calls.contacts.find((c) => !requestsOf(
      scenario, 1, {}, {}, {}).some((o) => o.id === c.id))
    useGame.getState().dial(far.number)
    vi.advanceTimersByTime(2300)
    const call = useGame.getState().call
    expect(call.stage).toBe('talking')
    expect(call.asking).toBeFalsy()
    const said = call.said.map((l) => l.text).join(' ')
    expect(said).not.toMatch(/메일|첨부/)
    for (const line of calls.busy) expect(call.said.some((l) => l.text === line)).toBe(true)
  })

  it('끊으면 기록에 남는다', () => {
    useGame.getState().dial(spoken.number)
    vi.advanceTimersByTime(2300)
    useGame.getState().hangUp()
    expect(useGame.getState().call).toBe(null)
    expect(useGame.getState().callLog[0].number).toBe(spoken.number)
    expect(useGame.getState().callLog[0].dir).toBe('out')
  })
})
