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

  const [title, ...rest] = file.content.split('\n')

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
          <pre className="pdf-text">{rest.join('\n').replace(/^\n+/, '')}</pre>
          <div className="pdf-seal">직인</div>
          <div className="hwp-pageno">1 / 1</div>
        </div>
      </div>
    </div>
  )
}
