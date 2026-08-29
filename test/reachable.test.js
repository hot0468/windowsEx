import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'

// `attached: true` 는 "무엇인가 꺼내 주기 전에는 어디에도 없다" 는 뜻이다
// (fsView 가 그렇게 지운다). 메일 첨부를 저장하거나 사이트에서 내려받으면
// 나타난다. 그런데 아무도 꺼내 주지 않는 파일이면 영영 안 보인다 — 화면에는
// 아무 일도 안 일어나므로, 그 안에 답이 있어야 비로소 알게 된다.
// 전자영수증_다온쇼핑_0722.pdf 가 그랬다: 힌트가 그 파일을 정확히 지목하는데
// 파일이 나타나지 않아 러닝화 값을 끝내 못 찾는다.
const raw = readFileSync('src/scenarios/workday.json', 'utf8')

const attached = []
const walk = (list, path) => {
  for (const c of list) {
    if (c.attached) attached.push({ ...c, path: [...path, c.name].join('/') })
    if (c.children) walk(c.children, [...path, c.name])
  }
}
for (const [root, list] of Object.entries(scenario.fs)) walk(list, [root])

// id 가 제 정의 말고 어딘가에 또 나오면 누군가 그것을 꺼내 준다는 뜻이다.
const revealed = (f) => raw.split(`"${f.id}"`).length - 1 >= 2
const hidden = attached.filter((f) => !revealed(f))

const accepts = new Set()
const gather = (n) => {
  if (Array.isArray(n)) return n.forEach(gather)
  if (n && typeof n === 'object') {
    for (const a of [].concat(n.accept ?? [])) if (typeof a === 'string') accepts.add(a)
    Object.values(n).forEach(gather)
  }
}
gather(scenario)

describe('꺼내 줄 사람이 없는 파일', () => {
  it('첨부로 숨겨 둔 파일이 실제로 있다', () => {
    expect(attached.length).toBeGreaterThan(0)
  })

  it('답을 품고 있지 않다', () => {
    for (const f of hidden) {
      const text = (f.content ?? '') + (f.alt ?? '')
      const leaked = [...accepts].filter((a) => text.includes(a))
      expect(leaked, `${f.path} 는 아무도 꺼내 주지 않는데 답을 갖고 있다`).toEqual([])
    }
  })

  it('힌트가 이름으로 부르지 않는다', () => {
    for (const f of hidden) {
      // 파일 정의 자체에 한 번은 나온다. 그것 말고 또 나오면 누군가 부르는 것이다.
      expect(raw.split(f.name).length - 1, `${f.path} 를 부르는 곳이 있는데 파일이 나타나지 않는다`).toBe(1)
    }
  })
})
