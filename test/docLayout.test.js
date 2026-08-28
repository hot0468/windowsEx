import { describe, expect, it } from 'vitest'
import scenario from '../src/scenarios/workday.json'
import { allFiles } from '../src/engine/store.js'
import { isForm, linesOf, parseDoc, signOff } from '../src/apps/docLayout.js'

const docs = allFiles(scenario.fs).filter((f) => f.name.endsWith('.hwp') && f.content)
const doc = (name) => docs.find((f) => f.name === name)

describe('laying a document out', () => {
  it('has documents to lay out', () => {
    expect(docs.length).toBeGreaterThan(100)
  })

  // The real hazard: the viewer stops printing a line the player needs, while
  // every answer test still passes because the data never changed.
  it('gives every line of every document back, unchanged', () => {
    for (const f of docs) {
      expect(linesOf(parseDoc(f.content)).join('\n'), f.name).toBe(f.content)
    }
  })

  it('reads a form as a title, fields, and a note', () => {
    const kinds = parseDoc(doc('견적서_2023_하반기.hwp').content).map((b) => b.kind)
    // 견적서는 품목을 표로 싣는다
    expect(kinds.filter((k) => k !== 'blank')).toEqual(['title', 'fields', 'table', 'note'])
  })

  it('keeps a label with its value', () => {
    const [fields] = parseDoc(doc('휴가신청서_사본.hwp').content).filter((b) => b.kind === 'fields')
    expect(fields.rows.map((r) => r.label)).toEqual(['성명', '기간', '사유'])
    expect(fields.rows[1].value).toBe('2026-07-24 ~ 2026-08-22 (한 달)')
  })

  it('boxes a sign-off only where somebody actually signed', () => {
    expect(signOff(parseDoc(doc('휴가신청서_사본.hwp').content)).map((r) => r.value)).toEqual(['박 팀장 (승인)'])
    expect(signOff(parseDoc(doc('회의록_20231108.hwp').content))).toEqual([])
    // 작성 is who wrote the report and 담당 is the contact at the client;
    // neither is an approval, and neither gets a box
    expect(signOff(parseDoc(doc('주간보고_2023_10월_2주.hwp').content))).toEqual([])
    expect(signOff(parseDoc(doc('견적서_최종_진짜최종.hwp').content))).toEqual([])
  })

  it('boxes the approval on the documents that carry one', () => {
    const boxed = docs.filter((f) => signOff(parseDoc(f.content)).length)
    expect(boxed.length).toBeGreaterThan(5)
    for (const f of boxed) expect(f.content, f.name).toMatch(/^결재:/m)
  })

  it('numbers a numbered list and bullets a bulleted one', () => {
    const blocks = parseDoc(doc('회의록_20231108.hwp').content)
    const list = blocks.find((b) => b.kind === 'number')
    expect(list.items).toHaveLength(3)
    expect(list.marks).toEqual(['1', '2', '3'])
  })

  it('does not mistake a sentence with a colon for a form field', () => {
    const blocks = parseDoc('[메모]\n\n오늘 배운 것: 회의는 길수록 결론이 없다는 것이다. 다음부터는 30분으로 하자')
    expect(blocks.some((b) => b.kind === 'fields')).toBe(false)
  })

  it('tells a form from a report', () => {
    expect(isForm(parseDoc(doc('휴가신청서_사본.hwp').content))).toBe(true)
    expect(isForm(parseDoc(doc('견적서_2023_하반기.hwp').content))).toBe(true)
  })
})

describe('견적서의 품목 표', () => {
  const quote = () => parseDoc(doc('견적서_최종_진짜최종.hwp').content)

  it('| 로 그린 줄을 표 한 덩어리로 읽는다', () => {
    const table = quote().find((b) => b.kind === 'table')
    expect(table).toBeTruthy()
    expect(table.head).toEqual(['품목', '수량', '단가', '금액'])
    expect(table.rows.length).toBeGreaterThan(0)
    for (const row of table.rows) expect(row).toHaveLength(table.head.length)
  })

  it('아직 못 채운 칸은 빈 칸으로 남는다', () => {
    // 단가는 사내위키에서 찾아 와야 하는 답이다. 표가 생겼다고 채워지면 안 된다.
    const table = quote().find((b) => b.kind === 'table')
    const flat = table.rows.flat().join('')
    expect(flat).not.toMatch(/[0-9]{3},[0-9]{3}/)
  })

  it('표를 쓰는 문서도 한 줄도 잃지 않는다', () => {
    for (const f of docs.filter((x) => x.content.includes('|'))) {
      expect(linesOf(parseDoc(f.content)).join('\n'), f.name).toBe(f.content)
    }
  })

  it('견적서마다 품목 표가 있다', () => {
    const quotes = docs.filter((f) => /^견적서_(최종|D유통|B물산|C테크|E마트|F상사|G산업)/.test(f.name))
    expect(quotes.length).toBeGreaterThan(4)
    for (const f of quotes) {
      expect(parseDoc(f.content).some((b) => b.kind === 'table'), f.name).toBe(true)
    }
  })
})
