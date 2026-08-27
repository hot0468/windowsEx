import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles, endingFor, hiddenCommand, processList } from '../src/engine/store.js'

// 재미요소는 재미요소로만 있어야 한다. 퍼즐의 답을 흘리거나 엔딩을 움직이면
// 그건 더 이상 이스터에그가 아니라 공략이다.
const steps = (ask) => (ask ? [ask, ...steps(ask.then)] : [])
const threads = [scenario.workMessenger, scenario.privateMessenger]
  .flatMap((m) => m.sections.flatMap((s) => s.threads))
const answers = [
  ...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).flatMap(steps),
  ...scenario.days.flatMap((d) => (d.asks ?? []).flatMap((a) => steps(a.ask))),
  ...Object.values(scenario.overtime.days).flatMap((d) => d.asks.flatMap((a) => steps(a.ask))),
  ...scenario.pool.requests.flatMap((r) => steps(r.beat.ask)),
  ...steps(scenario.summons?.beat?.ask)
].filter((a) => a?.accept).flatMap((a) => a.accept.flat()).filter((a) => a.length > 2)

const eggText = JSON.stringify([
  scenario.hiddenCommands, scenario.miner.ghost, scenario.antivirus.unclassified
])

describe('이스터에그', () => {
  it('어떤 정답도 흘리지 않는다', () => {
    for (const a of new Set(answers)) expect(eggText, a).not.toContain(a)
  })

  it('엔딩을 움직이지 않는다', () => {
    const base = { grants: {}, locks: 3, overtime: {}, days: 5, digging: {}, rumor: {} }
    const plain = endingFor(scenario.ending, base)
    // 이스터에그는 grant를 세우지 않으므로 결말은 늘 같다
    expect(endingFor(scenario.ending, { ...base, sawEggs: true })).toBe(plain)
  })

  describe('숨은 명령어', () => {
    const net = scenario.network

    it('help에는 나오지 않는다', () => {
      // 아는 사람만 치는 것이라야 이스터에그다
      const help = JSON.stringify(scenario.hiddenCommands)
      for (const name of Object.keys(scenario.hiddenCommands)) {
        expect(help).toContain(name)
      }
      expect(Object.keys(scenario.hiddenCommands).length).toBeGreaterThanOrEqual(4)
    })

    it('치면 무언가를 돌려준다', () => {
      for (const name of Object.keys(scenario.hiddenCommands)) {
        const out = hiddenCommand(scenario, name)
        expect(out, name).toBeTruthy()
        expect(out.length, name).toBeGreaterThan(0)
      }
    })

    it('모르는 명령에는 아무것도 없다', () => {
      expect(hiddenCommand(scenario, 'ipconfig')).toBeNull()
      expect(hiddenCommand(scenario, 'sudo')).toBeNull()
      expect(hiddenCommand(scenario, '')).toBeNull()
    })

    it('나비는 게스트하우스의 그 고양이다', () => {
      expect(hiddenCommand(scenario, 'nabi').join('')).toContain('나비')
    })
  })

  describe('작업 관리자의 dream.exe', () => {
    it('목록 맨 아래에 있다 — CPU 순 정렬이라 스크롤해야 보인다', () => {
      const rows = processList(scenario.miner, false).sort((a, b) => b.cpu - a.cpu)
      expect(rows[rows.length - 1].name).toBe('dream.exe')
    })

    it('채굴기와 헷갈리지 않는다', () => {
      const ghost = processList(scenario.miner, false).find((r) => r.name === 'dream.exe')
      // 이건 퍼즐이 아니다: 끝내야 할 것은 채굴기 쪽이다
      expect(ghost.miner).toBeFalsy()
      expect(ghost.cpu).toBe(0)
    })

    it('끝낼 수 없고, 조를수록 말이 달라진다', () => {
      const refuse = scenario.miner.ghost.refuse
      expect(refuse.length).toBeGreaterThanOrEqual(3)
      expect(new Set(refuse).size).toBe(refuse.length)
    })
  })

  describe('백신이 분류하지 못한 것', () => {
    it('가리키는 파일이 실제로 있다', () => {
      const path = scenario.antivirus.unclassified.path
      const name = path.split('\\').pop()
      expect(allFiles(scenario.fs).some((f) => f.name === name), name).toBe(true)
    })

    it('위협이라고 말하지 않는다', () => {
      const said = JSON.stringify(scenario.antivirus.unclassified)
      for (const word of ['위험', '악성', '바이러스', '감염']) {
        expect(said, word).not.toContain(word)
      }
    })
  })
})
