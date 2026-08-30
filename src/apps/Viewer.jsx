import { useEffect, useRef, useState } from 'react'
import { useGame, dreamGallery, findFile, fsView, galleryOf } from '../engine/store.js'
import { fileImage } from '../assets/photos.js'
import { APPS } from './registry.jsx'
import { ChevronLeft, ChevronRight } from '../icons/line.jsx'

// 맞춤 first, the way a picture viewer opens: whatever the picture's shape, it
// is inside the window before it is anything else.
const ZOOMS = [1, 1.5, 2, 4]
const label = (z) => (z === 1 ? '맞춤' : `${z * 100}%`)

export default function Viewer({ fileId }) {
  const scenario = useGame((s) => s.scenario)
  const pinned = useGame((s) => s.pinned)
  const shots = useGame((s) => s.shots)
  const restored = useGame((s) => s.restored)
  const showHidden = useGame((s) => s.showHidden)
  const dreamt = useGame((s) => s.dreamt)
  const [zoom, setZoom] = useState(0)
  // which of the folder's pictures is up; the window keeps its own place
  const [shown, setShown] = useState(fileId)
  const frame = useRef(null)
  const gates = useGame((s) => s.scenario.nineGates)
  const tiles = useGame((s) => s.tiles)
  const takeTile = useGame((s) => s.takeTile)
  const placed = useGame((s) => s.placed)
  const touched = useGame((s) => s.touched)
  const [menu, setMenu] = useState(null)

  const fs = fsView(dreamGallery(scenario, scenario.fs, dreamt), { pinned, restored, tiles, placed, touched, shots, scenario })
  const gallery = galleryOf(fs, fileId, showHidden)
  const at = gallery.findIndex((f) => f.id === shown)
  const file = findFile(fs, shown)
  const src = file && fileImage(file.image)

  // Opening a picture opens the folder it is in, so the arrow keys work without
  // clicking the image first.
  useEffect(() => { frame.current?.focus() }, [])

  const step = (by) => {
    const next = gallery[at + by]
    if (!next) return
    setShown(next.id)
    setZoom(0)
  }
  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      return step(e.key === 'ArrowLeft' ? -1 : 1)
    }
    // a picture opened at 맞춤 is zoomed from the keyboard too
    if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z + 1, ZOOMS.length - 1))
    if (e.key === '-' || e.key === '0') setZoom((z) => (e.key === '0' ? 0 : Math.max(z - 1, 0)))
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
                title="확대/축소 (+ / - / 0)">
          {label(ZOOMS[zoom])}
        </button>
      </div>
      <div className="vw-canvas">
        {/* 캡처에는 그림이 없다. 그때 맨 앞에 무엇이 있었고 몇 시였는지를
            창 모양으로 그린다 — 화면을 찍었다는 사실 자체가 내용이다. */}
        {file.shot ? (
          <div className="vw-shot">
            <div className="vw-shot-bar">
              <span className="vw-shot-dots"><i /><i /><i /></span>
              {file.shot.title ? APPS[file.shot.title]?.title ?? file.shot.title : '바탕화면'}
            </div>
            <div className="vw-shot-body">
              <b>{file.shot.day}일차 {file.shot.at}</b>
              <span>{file.shot.title ? '이 창이 맨 앞에 있었습니다.' : '열려 있는 창이 없었습니다.'}</span>
            </div>
          </div>
        ) : (
        <div className="vw-stage" style={{ width: `${ZOOMS[zoom] * 100}%`, height: `${ZOOMS[zoom] * 100}%` }}>
          {/* Blown up on screen is where the tile in the corner is noticed. */}
          <img src={src} alt={file.alt ?? file.name}
               title={file.tile && !tiles.includes(file.id) ? gates?.hint : undefined}
               onContextMenu={(e) => {
                 if (!file.tile || tiles.includes(file.id)) return
                 e.preventDefault()
                 setMenu({ x: e.clientX, y: e.clientY })
               }} />
        </div>
        )}
      </div>
      {menu && (
        <>
          <div className="ctx-catch" onPointerDown={() => setMenu(null)}
               onContextMenu={(e) => { e.preventDefault(); setMenu(null) }} />
          <div className="ctx" style={{ left: menu.x, top: menu.y }}>
            <button onClick={() => { takeTile(file.id); setMenu(null) }}>{gates.copy}</button>
          </div>
        </>
      )}
    </div>
  )
}
