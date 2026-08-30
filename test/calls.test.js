import { beforeEach, describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { useGame } from '../src/engine/store.js'

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
  beforeEach(() => useGame.setState({ call: null, callLog: [], calledIn: {}, grants: {} }))

  const spoken = calls.contacts.find((c) => !mailOf(c.id).requiredAttachment)

  it('아는 번호로 걸면 그 사람이 받는다', () => {
    useGame.getState().dial(spoken.number)
    const call = useGame.getState().call
    expect(call.name).toBe(spoken.name)
    expect(call.asking).toBe(true)
    expect(call.said.length).toBeGreaterThan(0)
  })

  it('모르는 번호로 걸면 아무도 받지 않는다', () => {
    useGame.getState().dial('02-9999-9999')
    expect(useGame.getState().call.asking).toBeFalsy()
  })

  // 메일과 같은 판정을 지난다: 필요한 값을 말하면 열리고, 아니면 되묻는다.
  it('필요한 값을 말하면 메일과 같은 목표가 열린다', async () => {
    useGame.getState().dial(spoken.number)
    expect(useGame.getState().sayOnCall('잠시만요, 확인해 볼게요')).toBe(false)
    const key = mailOf(spoken.id).requiredKeywords[0]
    expect(useGame.getState().sayOnCall(`확인해 보니 ${key} 입니다`)).toBe(true)
    await new Promise((r) => setTimeout(r, 1100))
    expect(useGame.getState().grants[spoken.id]).toBe(true)
  })

  it('끊으면 기록에 남는다', () => {
    useGame.getState().dial(spoken.number)
    useGame.getState().hangUp()
    expect(useGame.getState().call).toBe(null)
    expect(useGame.getState().callLog[0].number).toBe(spoken.number)
  })
})
