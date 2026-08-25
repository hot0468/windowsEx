import { useState } from 'react'
import { useGame, findFile } from '../engine/store.js'

const ZOOMS = [100, 125, 150]

export default function Hwp({ fileId }) {
  const fs = useGame((s) => s.scenario.fs)
  const spec = useGame((s) => s.scenario.programs.hangul)
  const installed = useGame((s) => Boolean(s.grants.hangul))
  const p = useGame((s) => s.scenario.printer)
  const [zoom, setZoom] = useState(0)
  const [printing, setPrinting] = useState(false)
  // the jam is cleared from the copier's own web page, not from here
  const mfpFixed = useGame((s) => s.mfpFixed)
  const file = findFile(fs, fileId)
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
          <pre className="hwp-text">{file.content}</pre>
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
