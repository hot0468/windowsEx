import { useState } from 'react'
import { useGame, findFile } from '../engine/store.js'
import { fileImage } from '../assets/photos.js'

const ZOOMS = [1, 1.5, 2]

export default function Viewer({ fileId }) {
  const fs = useGame((s) => s.scenario.fs)
  const [zoom, setZoom] = useState(0)
  const file = findFile(fs, fileId)
  const src = file && fileImage(file.image)
  if (!src) return <div className="vw-none">이미지를 열 수 없습니다.</div>

  return (
    <div className="vw">
      <div className="vw-bar">
        <span className="vw-name">{file.name}</span>
        <button className="vw-zoom" onClick={() => setZoom((z) => (z + 1) % ZOOMS.length)}
                title="확대/축소">
          {Math.round(ZOOMS[zoom] * 100)}%
        </button>
      </div>
      <div className="vw-canvas">
        <img src={src} alt={file.alt ?? file.name} style={{ width: `${ZOOMS[zoom] * 100}%` }} />
      </div>
    </div>
  )
}
