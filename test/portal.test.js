import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import {
  goalFor, searchBlogs, searchCompanies, searchIn, searchNews, searchPlaces, searchQna, searchSites
} from '../src/engine/store.js'

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

// Words a player is plausibly going to type. Every one of them has to bring
// back something, or the portal feels broken exactly when they are stuck.
const TERMS = [
  'IP', '아이피', 'ipconfig', '비밀번호', '사내위키', '위키', '포털',
  '견적서', '단가', '재고', '출장비', '연락처', '예약',
  '맛집', '맥주', '술집', '점심', '주소', '회사',
  'BS-200', 'BS-100', '바코드', '스캐너',
  '한빛', 'A상사', 'B물산', 'C테크',
  '날씨', '워크숍', '회식', '카페', '냉면', '순대국', '해장',
  '결재', '품의', '휴가', '연차', '보안', '피싱', '악성코드',
  'hwp', '엑셀', '파워포인트', '야근', '커피', '지하철', '주차'
]

const found = (q) => [
  ...searchSites(scenario.sites, q),
  ...searchPlaces(scenario.places, q),
  ...searchBlogs(scenario.blogs, q),
  ...searchNews(scenario.news, q),
  ...searchQna(scenario.qna, q),
  ...searchCompanies(scenario.companies, q)
]

describe('search coverage', () => {
  it('finds something for every term a player is likely to try', () => {
    const empty = TERMS.filter((t) => found(t).length === 0)
    expect(empty).toEqual([])
  })

  it('still returns nothing for something that is not in this world', () => {
    expect(found('양자컴퓨터')).toEqual([])
    expect(found('   ')).toEqual([])
  })

  it('lists every client the days actually deal with', () => {
    for (const name of ['A상사', 'B물산', 'C테크']) {
      expect(searchCompanies(scenario.companies, name).length).toBeGreaterThan(0)
    }
  })
})
