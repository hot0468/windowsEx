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

// 눌러 본 사람에게만 열리는 번호들. 목록에 없고, 아무것도 주지 않는다 —
// 웃거나 서늘하면 그것으로 끝이다.
describe('전화번호 이스터에그', () => {
  const eggs = scenario.calls.eggs

  it('연락처에는 없다', () => {
    const listed = new Set([...calls.contacts, ...calls.people].map((c) => c.number))
    for (const e of eggs) expect(listed.has(e.number), e.name + ' 이 목록에 있다').toBe(false)
  })

  it('아무것도 주지 않는다', () => {
    for (const e of eggs) {
      expect(e.grants).toBeUndefined()
      expect(e.ask).toBeUndefined()
      expect(e.lines.length).toBeGreaterThan(0)
    }
  })

  // 정답을 흘리면 이스터에그가 아니라 지름길이 된다.
  it('정답을 말하지 않는다', () => {
    const said = eggs.flatMap((e) => [...e.lines, e.bye ?? '']).join(' ')
    for (const c of calls.contacts) {
      for (const key of mailOf(c.id).requiredKeywords ?? []) expect(said).not.toContain(key)
    }
  })

  it('걸면 받고, 말이 한 줄씩 온다', () => {
    vi.useFakeTimers()
    useGame.setState({ call: null, callSeq: 0, callLog: [], grants: {} })
    const hq = eggs.find((e) => e.id === 'egg_hq')
    useGame.getState().dial(hq.number)
    vi.advanceTimersByTime(2300)
    expect(useGame.getState().call.name).toBe(hq.name)
    expect(useGame.getState().call.said).toHaveLength(0)
    vi.advanceTimersByTime(1200)
    expect(useGame.getState().call.said).toHaveLength(1)
    expect(useGame.getState().call.asking).toBe(false)
    vi.useRealTimers()
  })

  // 없는 층의 내선은 저쪽에서 끊는다 — 사람이 받은 것이 아니기 때문이다.
  it('끊는 말을 가진 번호는 스스로 끊는다', () => {
    vi.useFakeTimers()
    useGame.setState({ call: null, callSeq: 0, callLog: [], grants: {} })
    const floor8 = eggs.find((e) => e.bye)
    useGame.getState().dial(floor8.number)
    vi.advanceTimersByTime(2300 + 30000)
    expect(useGame.getState().call).toBe(null)
    expect(useGame.getState().callLog[0].number).toBe(floor8.number)
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

// 스팸은 대본이 아니라 확률로 온다. 오는 것 자체가 장면이므로 아무것도
// 주지 않고, 하루에 한 번을 넘지 않아야 방해가 아니라 생활이 된다.
describe('스팸 전화', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ call: null, callSeq: 0, callLog: [], calledIn: {}, spammedOn: 0, day: 1 })
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('스팸에는 목표도 정답도 없다', () => {
    expect(scenario.calls.spam.length).toBeGreaterThan(0)
    for (const c of scenario.calls.spam) {
      expect(c.lines.length).toBeGreaterThan(0)
      expect(c.grants).toBeUndefined()
      expect(c.ask).toBeUndefined()
    }
  })

  it('번호가 다른 연락처와 겹치지 않는다', () => {
    const digits = (n) => n.replace(/[^0-9]/g, '')
    const all = [...scenario.calls.spam, ...scenario.calls.people, ...scenario.calls.contacts]
      .map((c) => digits(c.number))
    expect(new Set(all).size).toBe(all.length)
  })

  it('하루에 한 번을 넘지 않는다', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)      // 늘 걸리는 날
    expect(useGame.getState().maybeSpam()).toBe(true)
    expect(useGame.getState().maybeSpam()).toBe(false)
    useGame.setState({ day: 2 })
    expect(useGame.getState().maybeSpam()).toBe(true)
  })

  it('같은 곳이 두 번 걸지 않는다', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    useGame.getState().maybeSpam()
    vi.advanceTimersByTime(11000)
    const first = useGame.getState().call.id
    useGame.getState().declineCall()
    useGame.setState({ day: 2 })
    useGame.getState().maybeSpam()
    vi.advanceTimersByTime(11000)
    expect(useGame.getState().call.id).not.toBe(first)
  })

  // 받지 않으면 벨이 영원히 울리는 대신 끊기고 부재중으로 남는다.
  it('안 받으면 끊기고 부재중으로 남는다', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    useGame.getState().maybeSpam()
    vi.advanceTimersByTime(11000)
    expect(useGame.getState().call.stage).toBe('ringing')
    vi.advanceTimersByTime(15000)
    expect(useGame.getState().call).toBe(null)
    expect(useGame.getState().callLog[0].dir).toBe('missed')
  })

  // 받으면 제 할 말을 하고 스스로 끊는다 — 말 상대가 필요한 전화가 아니다.
  it('받으면 말하고 스스로 끊는다', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    useGame.getState().maybeSpam()
    vi.advanceTimersByTime(11000)
    useGame.getState().answerCall()
    expect(useGame.getState().call.stage).toBe('talking')
    expect(useGame.getState().call.asking).toBeFalsy()
    vi.advanceTimersByTime(20000)
    expect(useGame.getState().call).toBe(null)
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
    expect(useGame.getState().call.stage).toBe('talking')
    expect(useGame.getState().call.name).toBe(spoken.name)
    // 상대가 말하는 동안에는 말할 칸이 열리지 않는다 — 끼어드는 자리가 아니다.
    expect(useGame.getState().call.asking).toBe(false)
    vi.advanceTimersByTime(20000)
    expect(useGame.getState().call.asking).toBe(true)
  })

  // 말이 한 번에 쏟아지면 사람이 한 말로 읽히지 않는다.
  it('상대의 말은 한 줄씩 도착한다', () => {
    useGame.getState().dial(spoken.number)
    vi.advanceTimersByTime(2300)
    expect(useGame.getState().call.said).toHaveLength(0)
    expect(useGame.getState().call.speaking).toBe(true)
    vi.advanceTimersByTime(1200)
    expect(useGame.getState().call.said).toHaveLength(1)
    vi.advanceTimersByTime(1200)
    expect(useGame.getState().call.said).toHaveLength(2)
    vi.advanceTimersByTime(20000)
    expect(useGame.getState().call.speaking).toBe(false)
  })

  // 끊었는데 남은 말이 계속 도착하면, 다음 통화에 남의 말이 섞인다.
  it('끊으면 남은 말은 오지 않는다', () => {
    useGame.getState().dial(spoken.number)
    vi.advanceTimersByTime(2300 + 1200)
    useGame.getState().hangUp()
    vi.advanceTimersByTime(20000)
    expect(useGame.getState().call).toBe(null)
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
    vi.advanceTimersByTime(2300 + 20000)          // 상대가 할 말을 마칠 때까지
    expect(useGame.getState().sayOnCall('잠시만요, 확인해 볼게요')).toBe(false)
    // 되묻는 말이 끝나야 다시 말할 수 있다 — 상대가 말하는 중에는 못 끼어든다.
    vi.advanceTimersByTime(20000)
    const key = mailOf(spoken.id).requiredKeywords[0]
    expect(useGame.getState().sayOnCall(`확인해 보니 ${key} 입니다`)).toBe(true)
    vi.advanceTimersByTime(1000)
    vi.advanceTimersByTime(20000)
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
    vi.advanceTimersByTime(2300 + 20000)          // 인사부터 끝인사까지 다 듣는다
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
