import { useState } from 'react'
import { useGame, fileById } from '../engine/store.js'
import { docBody, docTitle } from './docLayout.js'

const ZOOMS = [100, 125, 150]

// A certificate downloaded from a government site. Read-only: the first line
// is the document's title, the rest is laid out as it was issued.
export default function Pdf({ fileId }) {
  const [zoom, setZoom] = useState(0)
  const file = useGame((s) => fileById(s, fileId))
  if (!file) return <div className="hwp-none">문서를 열 수 없습니다.</div>

  // 통보서·증명서는 줄글이 아니라 서식이다. 서식으로 적힌 문서는 칸을 그려
  // 주고, 그렇지 않은 것은 예전처럼 받은 그대로 펼친다.
  const f = file.form
  // 영수증은 표가 아니라 좁은 전표다. 칸을 그리는 대신 줄을 세운다.
  const r = file.receipt
  // 제목이 어느 모양에 적혀 있는지는 docLayout 이 안다 — 뷰어와 검사가
  // 같은 규칙을 쓴다.
  const title = docTitle(file)
  const body = docBody(file)

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
        <div className={"pdf-page" + (r ? " pdf-slip" : "")} style={{ width: `${ZOOMS[zoom] * (f ? 6.9 : r ? 3.4 : 5.2)}px` }}>
          <h1 className="pdf-title">{title}</h1>
          {r ? (
            <div className="pdf-receipt">
              {r.store.map((l) => <div key={l} className="pdf-rc-store">{l}</div>)}
              <div className="pdf-rc-rule" />
              {r.rows.map(([k, v], i) => (
                <div key={i} className={'pdf-rc-row' + (v ? '' : ' sub')}>
                  <span>{k}</span><b>{v}</b>
                </div>
              ))}
              <div className="pdf-rc-rule" />
              <div className="pdf-rc-row pdf-rc-total">
                <span>{r.total[0]}</span><b>{r.total[1]}</b>
              </div>
              <div className="pdf-rc-rule" />
              <div className="pdf-rc-head">{r.approval.title}</div>
              {r.approval.pairs.map(([k, v]) => (
                <div key={k} className="pdf-rc-row"><span>{k}</span><b>{v}</b></div>
              ))}
              <div className="pdf-rc-rule" />
              {r.notes.map((l) => <div key={l} className="pdf-rc-note">{l}</div>)}
            </div>
          ) : f ? (
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
            <pre className="pdf-text">{body}</pre>
          )}
          <div className="pdf-seal">직인</div>
          <div className="hwp-pageno">1 / 1</div>
        </div>
      </div>
    </div>
  )
}
