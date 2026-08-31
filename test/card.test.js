import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// 경조사 안내에 붙는 모바일 청첩장·부고장. 실제로 회사 게시판에 붙는
// 그 링크다. 여기서 깨지는 방식은 셋이다 — 링크가 없는 곳을 가리키거나,
// 카드가 안내와 다른 말을 하거나, 본인 부고 링크가 죽음 확정 순서를
// 건드리는 것.

const scenario = JSON.parse(
  readFileSync(new URL('../src/scenarios/workday.json', import.meta.url), 'utf8'))

const cards = scenario.sites.filter((s) => s.layout === 'card')
const bereavement = scenario.sites.find((s) => s.layout === 'portal')
  .pages['/hr/bereavement']
const sections = bereavement.board.posts.flatMap((p) => p.sections ?? [])
const linked = sections.filter((s) => s.link)

describe('경조사 카드', () => {
  it('카드 사이트가 있다', () => {
    expect(cards.length).toBeGreaterThan(0)
  })

  it('모든 링크는 실제로 있는 주소를 가리킨다', () => {
    const urls = new Set(scenario.sites.map((s) => s.url))
    for (const sec of linked) {
      expect(urls.has(sec.link.url), `${sec.link.url} 없음`).toBe(true)
    }
  })

  it('링크에는 누를 말이 적혀 있다', () => {
    for (const sec of linked) expect(sec.link.label?.trim()).toBeTruthy()
  })

  it('카드마다 표지·안내·오는 길이 있다', () => {
    for (const c of cards) {
      expect(c.card?.cover, c.url).toBeTruthy()
      expect(c.card.info?.length, c.url).toBeGreaterThan(0)
      expect(c.card.ways?.length, c.url).toBeGreaterThan(0)
    }
  })

  it('카드는 결혼 아니면 부고다', () => {
    for (const c of cards) expect(['wedding', 'obituary']).toContain(c.card.kind)
  })

  // 카드가 게시판과 다른 날짜·장소를 말하면 플레이어가 어느 쪽을 믿을지
  // 알 수 없다. 링크를 단 섹션의 값이 카드 안에도 그대로 있어야 한다.
  it('카드는 안내와 같은 것을 말한다', () => {
    for (const sec of linked) {
      const card = cards.find((c) => c.url === sec.link.url).card
      const said = JSON.stringify(card)
      const rows = Object.fromEntries(sec.rows)
      const place = rows['장소'] ?? rows['빈소']
      if (place) expect(said, `${sec.link.url}: ${place}`).toContain(place)
    }
  })
})

describe('본인 부고장', () => {
  const mine = sections.find((s) => s.mine)

  it('본인 부고에도 부고장이 걸려 있다', () => {
    expect(mine?.link?.url).toBeTruthy()
  })

  // 죽음은 부고를 끝까지 스크롤한 순간에만 확정된다(witness). 링크는 그
  // 섹션 안에 있으므로 누르려면 이미 거기까지 내려온 뒤다 — 링크가
  // 판정을 앞당기거나 건너뛰게 만들면 안 된다.
  it('부고장이 스크롤보다 먼저 죽음을 확정하지 않는다', () => {
    const src = readFileSync(new URL('../src/apps/Card.jsx', import.meta.url), 'utf8')
    expect(src).not.toContain('witness')
  })

  it('본인 부고장은 남의 것과 같은 양식이다', () => {
    const card = cards.find((c) => c.url === mine.link.url).card
    const other = cards.find((c) => c.card.kind === 'obituary' && c.url !== mine.link.url).card
    expect(Object.keys(card).sort()).toEqual(Object.keys(other).sort())
  })
})
