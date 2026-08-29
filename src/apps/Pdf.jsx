import { useState } from 'react'
import { useGame, findFile } from '../engine/store.js'

const ZOOMS = [100, 125, 150]

// A certificate downloaded from a government site. Read-only: the first line
// is the document's title, the rest is laid out as it was issued.
export default function Pdf({ fileId }) {
  const fs = useGame((s) => s.scenario.fs)
  const [zoom, setZoom] = useState(0)
  const file = findFile(fs, fileId)
  if (!file) return <div className="hwp-none">문서를 열 수 없습니다.</div>

  // 통보서·증명서는 줄글이 아니라 서식이다. 서식으로 적힌 문서는 칸을 그려
  // 주고, 그렇지 않은 것은 예전처럼 받은 그대로 펼친다.
  const f = file.form
  const [title, ...rest] = f ? [f.title] : file.content.split('\n')

  return (
    <div className="pdf">
      <div className="hwp-bar">
        <span className="hwp-name">{file.name}</span>
        <span className="pdf-badge">PDF</span>
        <button className="hwp-zoom" onClick={() => setZoom((z) => (z + 1) % ZOOMS.length)}
                title="확대/축소">
          {ZOOMS[zoom]}%
        </button>
      </div>
      <div className="hwp-canvas">
        {/* 서식은 칸이 여럿이라 줄글보다 넓은 종이가 필요하다 — 좁으면 이름과
            날짜가 글자 단위로 접힌다. */}
        <div className="pdf-page" style={{ width: `${ZOOMS[zoom] * (f ? 6.9 : 5.2)}px` }}>
          <h1 className="pdf-title">{title}</h1>
          {f ? (
            <div className="pdf-form">
              {f.meta && (
                <div className="pdf-meta">
                  {f.meta.map((m) => <span key={m}>{m}</span>)}
                </div>
              )}
              {f.lead && <p className="pdf-lead">{f.lead}</p>}

              {f.blocks.map((b, i) => {
                if (b.pairs) {
                  return (
                    <table key={i} className="pdf-pairs">
                      <tbody>
                        {b.pairs.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
                      </tbody>
                    </table>
                  )
                }
                if (b.columns) {
                  // merge 가 가리키는 칸은 위 줄과 값이 같으면 하나로 합친다.
                  // 실제 서식이 '구분' 칸을 그렇게 묶는다.
                  const span = (r, c) => {
                    if (b.merge !== c) return 1
                    if (r > 0 && b.rows[r - 1][c] === b.rows[r][c]) return 0
                    let n = 1
                    while (b.rows[r + n] && b.rows[r + n][c] === b.rows[r][c]) n++
                    return n
                  }
                  return (
                    <table key={i} className="pdf-grid">
                      <thead>
                        <tr>{b.columns.map((c) => <th key={c}>{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {b.rows.map((row, r) => (
                          <tr key={r}>
                            {row.map((cell, c) => {
                              const n = span(r, c)
                              if (!n) return null
                              return c === b.merge
                                ? <th key={c} className="pdf-group" rowSpan={n}>{cell}</th>
                                : <td key={c} className={b.mark === c && cell ? 'pdf-mark' : ''}>{cell}</td>
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                }
                return (
                  <div key={i} className="pdf-lines">
                    {b.lines.map((l) => <div key={l}>{l}</div>)}
                  </div>
                )
              })}

              {f.notes && (
                <ol className="pdf-notes">
                  {f.notes.map((n) => <li key={n}>{n}</li>)}
                </ol>
              )}
              {f.issuer && <div className="pdf-issuer">{f.issuer}</div>}
            </div>
          ) : (
            <pre className="pdf-text">{rest.join('\n').replace(/^\n+/, '')}</pre>
          )}
          <div className="pdf-seal">직인</div>
          <div className="hwp-pageno">1 / 1</div>
        </div>
      </div>
    </div>
  )
}
