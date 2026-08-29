import { describe, expect, it } from 'vitest'
import { sentences } from '../src/shell/Ending.jsx'
import scenario from '../src/scenarios/workday.json'

// 엔딩 화면은 글을 가운데로 모은다. 한 줄에 문장이 여럿이면 줄이 문장
// 한가운데를 잘라 "이직이었습니 / 다."가 된다.
describe('엔딩의 줄은 문장에서 끊긴다', () => {
  it('마침표 다음에서 끊는다', () => {
    expect(sentences('두 사람은 나란히 퇴사했습니다. 이직이었습니다. 소문은 틀렸습니다.'))
      .toEqual(['두 사람은 나란히 퇴사했습니다.', '이직이었습니다.', '소문은 틀렸습니다.'])
  })

  it('한 문장은 그대로 둔다', () => {
    expect(sentences('유선주 사원은 병가를 냈습니다.')).toEqual(['유선주 사원은 병가를 냈습니다.'])
  })

  // 빈칸을 조건으로 두는 이유가 이것이다.
  it('숫자 사이의 점은 끊지 않는다', () => {
    expect(sentences('2026.08.27 자로 퇴직 처리되었습니다.'))
      .toEqual(['2026.08.27 자로 퇴직 처리되었습니다.'])
    expect(sentences('마지막 출근: 2026-07-23 (금) 18:42')).toHaveLength(1)
  })

  it('따옴표 안에서 끝난 문장도 끊는다', () => {
    expect(sentences('"엄마… 나 꿈 꿨어." 엄마는 한참을 울었습니다.'))
      .toEqual(['"엄마… 나 꿈 꿨어."', '엄마는 한참을 울었습니다.'])
  })

  it('말줄임표는 문장 끝이 아니다', () => {
    expect(sentences('퇴근 처리 중… 근태기록 대조 중…')).toHaveLength(1)
  })

  // 끊고 나면 어느 조각도 원문보다 길 수 없다. 조각을 이어 붙이면 원문이다.
  it('엔딩 전체를 끊어도 글자가 늘거나 줄지 않는다', () => {
    const lines = []
    const walk = (n) => {
      if (Array.isArray(n)) return n.forEach(walk)
      if (n && typeof n === 'object') {
        if (Array.isArray(n.lines)) lines.push(...n.lines)
        if (n.note) lines.push(n.note)
        Object.values(n).forEach(walk)
      }
    }
    walk(scenario.ending)
    expect(lines.length).toBeGreaterThan(50)
    for (const line of lines) {
      expect(sentences(line).join(' '), line).toBe(line)
    }
  })
})
