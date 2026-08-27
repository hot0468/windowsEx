import { describe, expect, it } from 'vitest'
import { checkEtiquette } from '../src/engine/goal.js'
import scenario from '../src/scenarios/workday.json'

const rules = {
  company: 'AR 주식회사',
  name: '김한별',
  greetings: ['안녕하세요', '안녕하십니까', '수고 많으십니다'],
  closings: ['감사합니다', '드림', '올림', '부탁드립니다']
}
const ok = '안녕하세요, AR 주식회사 김한별입니다.\n\n견적서 보내드립니다.\n\n감사합니다.'
const check = (over = {}) =>
  checkEtiquette(rules, { subject: '[AR주식회사] 견적서', body: ok, outbound: true, ...over })

describe('메일 예절 검사', () => {
  it('세 항목을 갖춘 메일은 위반이 없다', () => {
    expect(check()).toEqual([])
  })

  it('제목 맨 앞의 회사 이름은 괄호 종류를 가리지 않는다', () => {
    for (const subject of ['[AR주식회사] 견적서', '(AR 주식회사) 견적서', 'AR주식회사입니다. 견적서', '【AR주식회사】견적서', 'AR 주식회사 견적서']) {
      expect(check({ subject })).toEqual([])
    }
  })

  it('회사 이름이 맨 앞이 아니면 잡는다', () => {
    expect(check({ subject: '견적서 [AR주식회사]' })).toEqual(['subject'])
    expect(check({ subject: 'RE: [AR주식회사] 견적서' })).toEqual(['subject'])
  })

  it('회사 이름을 줄여 쓰면 잡는다', () => {
    expect(check({ subject: '[AR] 견적서' })).toEqual(['subject'])
    expect(check({ subject: '견적서' })).toEqual(['subject'])
  })

  it('인사말만 있고 실명 자기소개가 없으면 잡는다', () => {
    expect(check({ body: '안녕하세요.\n\n견적서 보내드립니다.\n\n감사합니다.' })).toEqual(['greeting'])
  })

  it('플레이스홀더를 그대로 베끼면 잡는다', () => {
    expect(check({ body: '안녕하세요, AR 주식회사 ○○○입니다.\n\n견적서.\n\n감사합니다.' })).toEqual(['greeting'])
  })

  it('끝맺음에만 이름이 있으면 자기소개로 치지 않는다', () => {
    expect(check({ body: '안녕하세요.\n\n견적서 보내드립니다.\n\n김한별 드림' })).toEqual(['greeting'])
  })

  it('자기소개는 있고 인사말이 없으면 잡는다', () => {
    expect(check({ body: 'AR 주식회사 김한별입니다.\n\n견적서.\n\n감사합니다.' })).toEqual(['greeting'])
  })

  it('끝맺음말이 없으면 잡는다', () => {
    expect(check({ body: '안녕하세요, 김한별입니다.\n\n견적서 보내드립니다.' })).toEqual(['closing'])
  })

  it('답장 경로에서는 제목을 보지 않는다', () => {
    expect(check({ subject: 'RE: [C테크] 견적서 요청', outbound: false })).toEqual([])
  })

  it('여러 개를 어기면 우선순위 순으로 전부 돌려준다', () => {
    expect(check({ subject: '견적서', body: '견적서 보내드립니다.' })).toEqual(['subject', 'greeting', 'closing'])
  })
})

describe('예절 규칙 데이터', () => {
  const e = scenario.etiquette

  it('규칙과 잔소리가 모두 있다', () => {
    expect(e.greetings.length).toBeGreaterThan(1)
    expect(e.closings.length).toBeGreaterThan(1)
    for (const reason of ['subject', 'greeting', 'closing']) {
      expect(e.nags[reason]).toHaveLength(3)
    }
  })

  it('잔소리가 정답표가 되지 않는다', () => {
    const lines = Object.values(e.nags).flat().join('\n')
    expect(lines).not.toContain('[AR주식회사]')
    expect(lines).not.toContain('김한별입니다')
  })

  it('실제 시나리오 규칙으로 바른 메일이 통과한다', () => {
    const r = { ...e, company: scenario.player.company, name: scenario.player.name }
    const body = `안녕하세요, ${scenario.player.company} ${scenario.player.name}입니다.\n\n견적서 보내드립니다.\n\n감사합니다.`
    expect(checkEtiquette(r, { subject: '[AR주식회사] 견적서', body, outbound: true })).toEqual([])
  })

  it('발신 메일 규칙이 시나리오 한 곳에만 있다', () => {
    expect(scenario.days[2].fetch.greetings).toBeUndefined()
    expect(scenario.days[2].fetch.closings).toBeUndefined()
  })
})
