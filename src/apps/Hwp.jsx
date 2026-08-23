import { useState } from 'react'
import { useGame, findFile } from '../engine/store.js'

const ZOOMS = [100, 125, 150]

export default function Hwp({ fileId }) {
  const fs = useGame((s) => s.scenario.fs)
  const [zoom, setZoom] = useState(0)
  const file = findFile(fs, fileId)
  if (!file) return <div className="hwp-none">문서를 열 수 없습니다.</div>

  return (
    <div className="hwp">
      <div className="hwp-bar">
        <span className="hwp-name">{file.name}</span>
        <span className="hwp-badge">한글 문서</span>
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
    </div>
  )
}
