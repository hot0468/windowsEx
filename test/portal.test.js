import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { goalFor, searchIn, searchNews, searchQna, searchSites } from '../src/engine/store.js'

describe('searchIn', () => {
  const items = [{ a: '가나다', tags: ['라마'] }, { a: '바사', tags: [] }]

  it('looks only at the fields it is given', () => {
    expect(searchIn(items, '가나', ['a'])).toHaveLength(1)
    expect(searchIn(items, '라마', ['a'])).toHaveLength(0)
    expect(searchIn(items, '라마', ['a', 'tags'])).toHaveLength(1)
  })

  it('returns nothing for a blank term or missing list', () => {
    expect(searchIn(items, '   ', ['a'])).toEqual([])
    expect(searchIn(undefined, '가', ['a'])).toEqual([])
  })
})

describe('portal news and Q&A', () => {
  it('answers the terms a stuck player is likely to try', () => {
    expect(searchQna(scenario.qna, 'ip').length).toBeGreaterThan(0)
    expect(searchQna(scenario.qna, '견적서').length).toBeGreaterThan(0)
    expect(searchNews(scenario.news, '보안').length).toBeGreaterThan(0)
    expect(searchNews(scenario.news, '날씨').length).toBeGreaterThan(0)
  })

  it('gives every article a byline and something to read', () => {
    for (const a of scenario.news) {
      expect(a.press && a.date && a.reporter && a.summary).toBeTruthy()
      expect(a.body.length).toBeGreaterThan(2)
    }
  })

  it('gives every question an answer worth reading', () => {
    for (const k of scenario.qna) {
      expect(k.q && k.asker && k.date).toBeTruthy()
      expect(k.a.length).toBeGreaterThan(30)
    }
  })

  it('points the way without handing over any answer', () => {
    const text = JSON.stringify({ news: scenario.news, qna: scenario.qna })
    const wiki = scenario.sites.find((s) => s.layout === 'wiki')
    const portal = scenario.sites.find((s) => s.layout === 'portal')
    const secrets = [
      ...scenario.days.flatMap((_, i) => goalFor(scenario, i + 1).requiredKeywords),
      wiki.login.password, scenario.network.ip, portal.portal.footer.address
    ]
    for (const secret of secrets) expect(text).not.toContain(secret)
  })

  it('still keeps the contents of a locked site out of results', () => {
    const wiki = scenario.sites.find((s) => s.layout === 'wiki')
    for (const k of goalFor(scenario, 1).requiredKeywords) {
      expect(searchSites(scenario.sites, k)).toEqual([])
    }
    expect(searchSites(scenario.sites, wiki.title)).toHaveLength(1)
  })
})
