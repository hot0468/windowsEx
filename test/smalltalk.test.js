import { describe, expect, it } from 'vitest'
import { plain, replyTo, topicOf } from '../src/engine/smalltalk.js'
import scenario from '../src/scenarios/workday.json'

// 잡담은 퍼즐이 아니다 — 그래서 더더욱 규칙이 단순해야 한다. 여기서 어긋나면
// 상대가 딴소리를 하거나 같은 말을 되풀이한다.
const talk = {
  topics: [
    { when: ['밥', '점심'], lines: ['밥은 먹었고'] },
    { when: ['퇴근', '야근'], lines: ['오늘도 늦지'] }
  ],
  any: ['그래', '음', '그렇구나'],
  again: ['아까도 그 말 했잖아']
}

describe('말 다듬기', () => {
  it('띄어쓰기와 물음표는 세지 않는다', () => {
    expect(plain(' 밥 먹었어? ')).toBe('밥먹었어')
    expect(plain('밥먹었어')).toBe(plain('밥 먹었어!'))
  })
})

describe('화제 알아듣기', () => {
  it('낱말이 들어 있으면 그 화제다', () => {
    expect(topicOf(talk, '점심 뭐 먹었어').lines[0]).toBe('밥은 먹었고')
    expect(topicOf(talk, '오늘 야근함?').lines[0]).toBe('오늘도 늦지')
  })

  it('모르는 말에는 화제가 없다', () => {
    expect(topicOf(talk, '주말에 뭐해')).toBe(null)
    expect(topicOf(talk, '   ')).toBe(null)
  })

  // 먼저 적힌 화제가 그 사람에게 더 가깝다 — 둘 다 걸리면 앞엣것.
  it('여러 화제가 걸리면 앞엣것을 쓴다', () => {
    expect(topicOf(talk, '퇴근하고 밥 먹자').lines[0]).toBe('밥은 먹었고')
  })
})

describe('대답 고르기', () => {
  it('화제를 알아들으면 그 말을 한다', () => {
    expect(replyTo(talk, '밥 먹었어?').kind).toBe('topic')
  })

  it('모르는 말에는 맞장구를 돌려 가며 친다', () => {
    expect(replyTo(talk, '아무말', { n: 0 }).lines).toEqual(['그래'])
    expect(replyTo(talk, '아무말', { n: 1 }).lines).toEqual(['음'])
    expect(replyTo(talk, '아무말', { n: 3 }).lines).toEqual(['그래'])
  })

  // 같은 말을 또 걸면 상대도 그걸 안다.
  it('아까 한 말을 또 하면 짚는다', () => {
    const said = ['밥 먹었어?']
    expect(replyTo(talk, '밥먹었어', { said }).kind).toBe('again')
  })

  it('잡담을 모르는 상대에게는 아무 말도 하지 않는다', () => {
    expect(replyTo(null, '안녕')).toBe(null)
    expect(replyTo({}, '안녕')).toBe(null)
  })
})

// ── 시나리오에 실린 잡담 ──────────────────────────────────
// 잡담은 퍼즐 밖의 것이다. 답을 흘리거나 새 일을 시키면 그 순간 퍼즐이 된다.
describe('잡담 대사', () => {
  const talk = scenario.smalltalk ?? {}
  const people = Object.keys(talk)
  const everyLine = people.flatMap((id) => [
    ...(talk[id].topics ?? []).flatMap((t) => t.lines),
    ...(talk[id].any ?? []),
    ...(talk[id].again ?? [])
  ])

  it('톡을 주고받는 사람들이 잡담을 안다', () => {
    for (const id of ['boss', 'junho', 'minseo', 'soyoung', 'jihyun', 'mom']) {
      expect(people, id + ' 에게 말을 걸 수 없다').toContain(id)
    }
  })

  it('화제와 맞장구와 되풀이가 모두 있다', () => {
    for (const id of people) {
      expect(talk[id].topics?.length, id).toBeGreaterThan(0)
      expect(talk[id].any?.length, id).toBeGreaterThan(1)
      expect(talk[id].again?.length, id).toBeGreaterThan(0)
      for (const t of talk[id].topics) {
        expect(t.when?.length, id).toBeGreaterThan(1)
        expect(t.lines?.length, id).toBeGreaterThan(0)
        // 한 글자 낱말은 다른 말 속에 숨어 엉뚱하게 걸린다 — '냥'은 '그냥'에,
        // '술'은 '기술'에. 채팅에서 그럴 일이 거의 없는 몇 개만 남긴다.
        const SAFE = ['밥', '먹', '몸', '귤', '덥']
        for (const w of t.when) {
          if (w.length === 1) expect(SAFE, id + ' / ' + w).toContain(w)
          else expect(w.length).toBeGreaterThan(1)
        }
      }
    }
  })

  // 잡담이 정답을 말해 버리면 퍼즐이 죽는다.
  it('어떤 요청의 정답도 말하지 않는다', () => {
    const said = everyLine.join(' ')
    const accepts = []
    const walk = (o) => {
      if (!o || typeof o !== 'object') return
      if (Array.isArray(o)) return o.forEach(walk)
      if (o.accept) accepts.push(...[o.accept].flat(2).filter((a) => typeof a === 'string'))
      Object.values(o).forEach(walk)
    }
    walk(scenario)
    for (const a of accepts) {
      if (a.length < 4) continue           // 너무 짧은 것은 우연히 겹친다
      expect(said, a + ' 가 잡담에 있다').not.toContain(a)
    }
  })

  // 잡담이 일을 시키면 플레이어는 그것을 요청으로 읽는다.
  it('새 일을 시키지 않는다', () => {
    for (const line of everyLine) {
      expect(line).not.toMatch(/해 주세요|보내 주세요|부탁드립니다|확인해 주세요/)
      expect(line.length).toBeLessThan(45)
    }
  })

  // 단톡방과 이름 없는 계정에는 말을 걸 자리가 없다.
  it('단톡방과 이름 없는 계정은 잡담하지 않는다', () => {
    for (const id of people) {
      expect(id.startsWith('room_')).toBe(false)
      expect(id).not.toBe('caller')
    }
  })
})
