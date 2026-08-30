import { useEffect, useState } from 'react'
import { useGame, fileById } from '../engine/store.js'
import { isForm, parseDoc, signOff } from './docLayout.js'

const ZOOMS = [100, 125, 150]

// The columns of an approval box, the way every Korean form has one along the
// top right. Only the ones the document itself filled in are drawn.
const Stamp = ({ rows }) => (
  <table className="doc-stamp">
    <tbody>
      <tr>{rows.map((r) => <th key={r.label}>{r.label}</th>)}</tr>
      <tr>{rows.map((r) => <td key={r.label}>{r.value}</td>)}</tr>
    </tbody>
  </table>
)

// What somebody typed, drawn as the document they meant. Blocks come from
// docLayout; nothing here decides what the text says.
function Doc({ content }) {
  const blocks = parseDoc(content)
  const stamp = signOff(blocks)
  const seen = new Set()
  return (
    <div className={'doc' + (isForm(blocks) ? ' form' : '')}>
      {stamp.length > 0 && <div className="doc-topbar"><Stamp rows={stamp} /></div>}
      {blocks.map((b, i) => {
        if (b.kind === 'title') return <h1 key={i} className="doc-title">{b.text}</h1>
        if (b.kind === 'head') return <h2 key={i} className="doc-head">{b.text}</h2>
        if (b.kind === 'note') return <p key={i} className="doc-note">{b.text}</p>
        if (b.kind === 'blank') return <div key={i} className="doc-gap" />
        if (b.kind === 'bullet') {
          return <ul key={i} className="doc-list">{b.items.map((x, k) => <li key={k}>{x}</li>)}</ul>
        }
        if (b.kind === 'number') {
          return (
            <ol key={i} className="doc-list num">
              {b.items.map((x, k) => <li key={k}><i>{b.marks[k]}.</i>{x}</li>)}
            </ol>
          )
        }
        if (b.kind === 'table') {
          return (
            <table key={i} className="doc-table">
              <thead>
                <tr>{b.head.map((c, k) => <th key={k}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {/* the total is ruled off from the items above it */}
                {b.rows.map((row, k) => (
                  <tr key={k} className={/합계|총액/.test(row[0]) ? 'sum' : undefined}>
                    {row.map((c, j) => <td key={j}>{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
        if (b.kind === 'fields') {
          // a row already drawn in the approval box is not repeated below it
          const rows = b.rows.filter((r) => !(r.signed && !seen.has(r.label) && seen.add(r.label)))
          if (!rows.length) return null
          return (
            <table key={i} className="doc-fields">
              <tbody>
                {rows.map((r, k) => (
                  <tr key={k}><th>{r.label}</th><td>{r.value}</td></tr>
                ))}
              </tbody>
            </table>
          )
        }
        return <p key={i} className="doc-p">{b.text}</p>
      })}
    </div>
  )
}

export default function Hwp({ fileId }) {
  const spec = useGame((s) => s.scenario.programs.hangul)
  const installed = useGame((s) => Boolean(s.grants.hangul))
  const p = useGame((s) => s.scenario.printer)
  const [zoom, setZoom] = useState(0)
  const [printing, setPrinting] = useState(false)
  // the jam is cleared from the copier's own web page, not from here
  const mfpFixed = useGame((s) => s.mfpFixed)
  const sawMissing = useGame((s) => s.sawMissing)
  const file = useGame((s) => fileById(s, fileId))
  // Watching the document refuse to open is what gives the player something to
  // report to 정보보안팀.
  useEffect(() => { if (file && !installed) sawMissing('hangul') }, [file, installed])
  // 전 사용자의 자동복구 문서를 실제로 읽었다. 열리지 않는 창은 본 것이 아니다.
  const traces = useGame((s) => s.scenario.sites.find((x) => x.layout === 'notes')?.notes.traces)
  const sawTrace = useGame((s) => s.sawTrace)
  useEffect(() => { if (file && installed && file.id === traces?.recover) sawTrace('recover') }, [file, installed])
  if (!file) return <div className="hwp-none">문서를 열 수 없습니다.</div>

  // Windows can name the file it cannot open, and nothing else about it.
  if (!installed) {
    return (
      <div className="hwp-missing">
        <div className="hwp-missing-card">
          <div className="hwp-missing-file">{file.name}</div>
          <h2>{spec.missing.title}</h2>
          {spec.missing.lines.map((line) => <p key={line}>{line}</p>)}
          <div className="hwp-missing-code">{spec.missing.code}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="hwp">
      <div className="hwp-bar">
        <span className="hwp-name">{file.name}</span>
        <span className="hwp-badge">한글 문서</span>
        <button className="hwp-print" onClick={() => setPrinting(true)}>인쇄</button>
        <button className="hwp-zoom" onClick={() => setZoom((z) => (z + 1) % ZOOMS.length)}
                title="확대/축소">
          {ZOOMS[zoom]}%
        </button>
      </div>
      <div className="hwp-ruler" />
      <div className="hwp-canvas">
        <div className="hwp-page" style={{ width: `${ZOOMS[zoom] * 5.2}px` }}>
          <Doc content={file.content} />
          <div className="hwp-pageno">- 1 -</div>
        </div>
      </div>

      {printing && (
        <div className="pr-back" onPointerDown={() => setPrinting(false)}>
          <div className="pr" onPointerDown={(e) => e.stopPropagation()}>
            <div className="pr-head">인쇄 — {p.name}</div>
            {mfpFixed ? (
              <div className="pr-ok">
                {p.done.map((l) => <p key={l}>{l}</p>)}
                <div className="pr-receipt">접수번호 <b>{p.receipt}</b></div>
              </div>
            ) : (
              <div className="pr-err">
                <b>{p.error.code}</b> {p.error.text}
                {p.blocked.map((l) => <span key={l}>{l}</span>)}
                <span>{p.error.help}</span>
              </div>
            )}
            <button className="pr-close" onClick={() => setPrinting(false)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  )
}
