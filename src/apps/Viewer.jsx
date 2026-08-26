import { useEffect, useRef, useState } from 'react'
import { useGame, dreamGallery, findFile, fsView, galleryOf } from '../engine/store.js'
import { fileImage } from '../assets/photos.js'
import { ChevronLeft, ChevronRight } from '../icons/line.jsx'

const ZOOMS = [1, 1.5, 2]

export default function Viewer({ fileId }) {
  const scenario = useGame((s) => s.scenario)
  const pinned = useGame((s) => s.pinned)
  const restored = useGame((s) => s.restored)
  const showHidden = useGame((s) => s.showHidden)
  const dreamt = useGame((s) => s.dreamt)
  const [zoom, setZoom] = useState(0)
  // which of the folder's pictures is up; the window keeps its own place
  const [shown, setShown] = useState(fileId)
  const frame = useRef(null)

  const fs = fsView(dreamGallery(scenario, scenario.fs, dreamt), { pinned, restored })
  const gallery = galleryOf(fs, fileId, showHidden)
  const at = gallery.findIndex((f) => f.id === shown)
  const file = findFile(fs, shown)
  const src = file && fileImage(file.image)

  // Opening a picture opens the folder it is in, so the arrow keys work without
  // clicking the image first.
  useEffect(() => { frame.current?.focus() }, [])

  const step = (by) => {
    const next = gallery[at + by]
    if (next) setShown(next.id)
  }
  const onKeyDown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    step(e.key === 'ArrowLeft' ? -1 : 1)
  }

  if (!src) return <div className="vw-none">이미지를 열 수 없습니다.</div>

  return (
    <div className="vw" ref={frame} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="vw-bar">
        <span className="vw-name">{file.name}</span>
        {gallery.length > 1 && (
          <span className="vw-count">
            <button disabled={at <= 0} onClick={() => step(-1)} title="이전 사진 (←)">
              <ChevronLeft size={15} strokeWidth={2.2} />
            </button>
            {at + 1} / {gallery.length}
            <button disabled={at < 0 || at >= gallery.length - 1} onClick={() => step(1)} title="다음 사진 (→)">
              <ChevronRight size={15} strokeWidth={2.2} />
            </button>
          </span>
        )}
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
