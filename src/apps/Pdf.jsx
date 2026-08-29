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
        <div className="pdf-page" style={{ width: `${ZOOMS[zoom] * 5.2}px` }}>
          <h1 className="pdf-title">{title}</h1>
          {f ? (
            <div className="pdf-form">
              <table className="pdf-head">
                <tbody>
                  {f.head.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
                </tbody>
              </table>

              <table className="pdf-grid">
                <thead>
                  <tr><th>구분</th><th>검사항목</th><th>검사결과</th><th>판정</th></tr>
                </thead>
                <tbody>
                  {f.groups.flatMap((g) => g.rows.map(([item, value, mark], i) => (
                    <tr key={g.title + item}>
                      {i === 0 && <th className="pdf-group" rowSpan={g.rows.length}>{g.title}</th>}
                      <td>{item}</td>
                      <td>{value}</td>
                      <td className={mark ? 'pdf-mark' : ''}>{mark}</td>
                    </tr>
                  )))}
                </tbody>
              </table>

              <table className="pdf-grid pdf-verdict">
                <tbody>
                  <tr><th>{f.verdict.label}</th><td>{f.verdict.value}</td></tr>
                  <tr>
                    <th>{f.opinion.label}</th>
                    <td>{f.opinion.lines.map((l) => <div key={l}>{l}</div>)}</td>
                  </tr>
                </tbody>
              </table>

              <table className="pdf-head pdf-foot">
                <tbody>
                  {f.foot.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
                </tbody>
              </table>
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
