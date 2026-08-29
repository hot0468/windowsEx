// A document on this PC is stored as the plain text somebody typed into it.
// The conventions are consistent enough to read back out — a bracketed title,
// `키: 값` lines, ■ headings, - bullets, ※ notes — so the viewer can lay a
// document out the way 한글 would instead of printing it as a wall of <pre>.
//
// Nothing here rewrites the text. Every line goes into exactly one block and
// comes back out unchanged; `linesOf` is what a test uses to prove it.

const TITLE = /^\[(.+)\]$/
const HEAD = /^■\s*(.*)$/
const NOTE = /^※\s*(.*)$/
const BULLET = /^[-·•]\s+(.*)$/
const NUMBER = /^(\d+)[.)]\s+(.*)$/
// a label short enough to be a form field, whose value is a value rather than
// prose — a sentence that happens to contain a colon keeps running afterwards,
// and that full stop mid-line is what gives it away
const FIELD = /^([^:]{1,16}):\s*(.*)$/
// A row of a table, drawn the way somebody would type one: pipes between the
// cells, with or without the outer ones. The first such row is the header. An
// empty cell stays empty — a quote whose unit price is still to be looked up
// has holes in it on purpose.
const ROW = /^\|?([^|]*\|[^|]*(?:\|[^|]*)*)\|?$/
const isRow = (t) => t.includes('|') && !TITLE.test(t) && !NOTE.test(t) && !HEAD.test(t)
const PROSE = /[.!?]\s+\S/
// The fields that mean somebody signed off. Not 작성 or 담당 — those name the
// person who wrote the report or the contact at the client, and boxing them
// would stamp an approval on a document nobody approved.
const SIGNED = /^(결재|승인|검토)$/

const kindOf = (line) => {
  const t = line.trim()
  if (!t) return 'blank'
  if (TITLE.test(t)) return 'title'
  if (HEAD.test(t)) return 'head'
  if (NOTE.test(t)) return 'note'
  if (isRow(t)) return 'row'
  if (BULLET.test(t)) return 'bullet'
  if (NUMBER.test(t)) return 'number'
  if (FIELD.test(t) && !PROSE.test(t.match(FIELD)[2])) return 'field'
  return 'text'
}

// Runs of the same kind become one block: three `키: 값` lines are one table,
// four bullets are one list. A blank line ends whatever run is open.
export function parseDoc(content = '') {
  const lines = String(content).split('\n')
  const blocks = []
  let run = null
  const close = () => { run = null }
  const push = (block) => { blocks.push(block); return block }

  lines.forEach((line, i) => {
    const t = line.trim()
    const kind = kindOf(line)

    if (kind === 'blank') { close(); return push({ kind: 'blank', line }) }

    // only the opening line of a document is its title
    if (kind === 'title' && !blocks.some((b) => b.kind === 'title') && i < 2) {
      close()
      return push({ kind: 'title', text: t.match(TITLE)[1], line })
    }

    if (kind === 'field') {
      const [, label, value] = t.match(FIELD)
      if (run?.kind !== 'fields') run = push({ kind: 'fields', rows: [], lines: [] })
      run.rows.push({ label: label.trim(), value, signed: SIGNED.test(label.trim()) })
      run.lines.push(line)
      return
    }

    if (kind === 'row') {
      // Split the line as typed, then trim each cell. A row written `a | b | `
      // ends on an empty cell — a quote still waiting on its price is exactly
      // that — so the trailing column has to survive.
      const fenced = t.startsWith('|') && t.endsWith('|')
      const body = fenced ? t.slice(1, -1) : line.replace(/^\s*\|/, '')
      const cells = body.split('|').map((c) => c.trim())
      if (run?.kind !== 'table') {
        run = push({ kind: 'table', head: cells, rows: [], lines: [line] })
        return
      }
      run.rows.push(cells)
      run.lines.push(line)
      return
    }

    if (kind === 'bullet' || kind === 'number') {
      const items = kind === 'bullet' ? [t.match(BULLET)[1]] : [t.match(NUMBER)[2]]
      const mark = kind === 'number' ? t.match(NUMBER)[1] : null
      if (run?.kind !== kind) run = push({ kind, items: [], marks: [], lines: [] })
      run.items.push(items[0])
      run.marks.push(mark)
      run.lines.push(line)
      return
    }

    close()
    if (kind === 'head') return push({ kind: 'head', text: t.match(HEAD)[1], line })
    if (kind === 'note') return push({ kind: 'note', text: t.match(NOTE)[1], line })
    push({ kind: 'text', text: line, line })
  })

  return blocks
}

// Every line the parser took in, in order. A document is laid out correctly
// only if this is the document again.
export const linesOf = (blocks) =>
  blocks.flatMap((b) => b.lines ?? [b.line])

// The sign-off rows a form carries, which are drawn as a box rather than as
// rows of the table. A document with none gets no box — this does not invent
// an approval nobody gave.
export const signOff = (blocks) =>
  blocks.filter((b) => b.kind === 'fields').flatMap((b) => b.rows).filter((r) => r.signed)

// A form is a document whose fields somebody filled in; a report is prose with
// headings. Both get the same furniture, but only a form is boxed and centred.
export const isForm = (blocks) =>
  (blocks.some((b) => b.kind === 'fields' && b.rows.length > 1) ||
    // an itemised table is form furniture too: a quote carries most of what it
    // says in the table, leaving too few `키: 값` lines to recognise it by
    (blocks.some((b) => b.kind === 'table') && blocks.some((b) => b.kind === 'fields'))) &&
  !blocks.some((b) => b.kind === 'text' && b.text.trim().length > 40)

// PDF 로 열리는 문서는 셋 중 한 모양이다: 줄글(content), 서식(form), 전표
// (receipt). 제목을 어디서 가져오는지가 모양마다 다른데, 뷰어가 그것을 제 손으로
// 고르면 새 모양이 생겼을 때 없는 곳을 읽는다 — 전자영수증을 전표로 바꾸며
// content 를 지웠을 때 그랬고, 렌더 도중 터지니 뷰어 하나가 아니라 화면
// 전체가 내려갔다. 규칙을 여기 한 곳에 두고 뷰어와 검사가 같이 쓴다.
export const docTitle = (file) =>
  file?.form?.title ?? file?.receipt?.title ?? (file?.content ?? '').split('\n')[0]

// 줄글 문서의 본문 — 제목 줄을 뺀 나머지. 서식·전표는 본문이 따로 없다.
export const docBody = (file) =>
  (file?.form || file?.receipt)
    ? ''
    : (file?.content ?? '').split('\n').slice(1).join('\n').replace(/^\n+/, '')
