import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import {
  goalFor, searchBlogs, searchCompanies, searchIn, searchNews, searchPlaces, searchQna,
  searchSites, searchTerms
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
    const wiki = scenario.sites.find((s) => s.layout === 'wiki')
    const portal = scenario.sites.find((s) => s.layout === 'portal')
    const answers = scenario.days.flatMap((d) => d.asks ?? []).flatMap((a) => a.ask?.accept?.flat() ?? [])
    // a shop's name is meant to be looked up in the shop listing — that is the puzzle.
    // a price, a password, an address or a colleague's mail address is not.
    const lookupOnly = answers.filter((a) => scenario.places.some((p) => p.name.includes(a)))
    const secrets = [
      ...scenario.days.flatMap((_, i) => goalFor(scenario, i + 1).requiredKeywords),
      ...answers.filter((a) => !lookupOnly.includes(a)),
      wiki.login.password, scenario.network.ip, portal.portal.footer.address
    ]

    // background reading: it may point the way, but it carries no answer at all
    const background = JSON.stringify({
      news: scenario.news, qna: scenario.qna,
      terms: scenario.terms, companies: scenario.companies
    })
    for (const secret of [...secrets, ...lookupOnly]) expect(background).not.toContain(secret)

    // the shop listing and its reviews are where a shop is found, and nothing more
    const lookup = JSON.stringify({ blogs: scenario.blogs, places: scenario.places })
    for (const secret of secrets) expect(lookup).not.toContain(secret)
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
  'AR', 'A상사', 'B물산', 'C테크',
  '날씨', '워크숍', '회식', '카페', '냉면', '순대국', '해장',
  '결재', '품의', '휴가', '연차', '보안', '피싱', '악성코드',
  'hwp', '엑셀', '파워포인트', '야근', '커피', '지하철', '주차',
  // 사무 행정
  '회의록', '보고서', '기안', '반려', '회의실', '명함', '프린터', '인쇄', '복사기',
  '비품', '경비', '법인카드', '세금계산서', '계약서', '발주', '납기',
  // IT
  '와이파이', 'wifi', 'VPN', '방화벽', '로그인', '이메일',
  '압축', 'zip', '캡처', '스크린샷', '단축키', '재부팅',
  // 회사 근처 생활
  '배달', '야식', '소주', '치킨', '편의점', '은행', '약국', '헬스장', '술',
  // 인사·복지
  '월급', '급여', '연봉', '인사', '채용', '퇴사', '이직', '복지',
  '건강검진', '재택근무', '출퇴근', '워라밸',
  // 주인공이 다녀온 휴가
  '제주도', '제주', '여행', '항공권', '렌터카', '게스트하우스', '귤', '고양이', '사진',
  // 그 밖
  '택배', '우편', '등기', '명절', '회의', '메모'
]

const found = (q) => [
  ...searchSites(scenario.sites, q),
  ...searchPlaces(scenario.places, q),
  ...searchBlogs(scenario.blogs, q),
  ...searchNews(scenario.news, q),
  ...searchQna(scenario.qna, q),
  ...searchCompanies(scenario.companies, q),
  ...searchTerms(scenario.terms, q)
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
