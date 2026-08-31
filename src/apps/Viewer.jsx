import { useEffect, useRef, useState } from 'react'
import { useGame, dreamGallery, findFile, fsView, galleryOf } from '../engine/store.js'
import { cameraShot, fileImage } from '../assets/photos.js'
import { APPS } from './registry.jsx'
import { ChevronLeft, ChevronRight } from '../icons/line.jsx'

// 맞춤 first, the way a picture viewer opens: whatever the picture's shape, it
// is inside the window before it is anything else.
const ZOOMS = [1, 1.5, 2, 4]
const label = (z) => (z === 1 ? '맞춤' : `${z * 100}%`)

// 손가락으로 옆으로 밀면 몇 장 넘어가는가. 확대 중에는 0 — 같은 손짓이
// 사진을 끄는(팬) 데 쓰이고 있으므로, 그때 장을 넘기면 사진을 살펴보다가
// 옆 사진으로 튕겨 나간다. 짧은 끌림과 세로 스크롤도 넘김이 아니다.
export function swipeStep({ dx, dy, zoomed = false }, threshold = 48) {
  if (zoomed) return 0
  if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return 0
  return dx < 0 ? 1 : -1
}

export default function Viewer({ fileId }) {
  const scenario = useGame((s) => s.scenario)
  const pinned = useGame((s) => s.pinned)
  const shots = useGame((s) => s.shots)
  const photos = useGame((s) => s.photos)
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

  const fs = fsView(dreamGallery(scenario, scenario.fs, dreamt), { pinned, restored, tiles, placed, touched, shots, photos, scenario })
  const gallery = galleryOf(fs, fileId, showHidden)
  const at = gallery.findIndex((f) => f.id === shown)
  const file = findFile(fs, shown)
  // 카메라로 찍은 것은 렌즈에 보이던 사진(있으면)을 그대로 쓴다.
  const src = file && (fileImage(file.image) ?? cameraShot(file.shot?.lens))

  // Opening a picture opens the folder it is in, so the arrow keys work without
  // clicking the image first.
  useEffect(() => { frame.current?.focus() }, [])

  const step = (by) => {
    const next = gallery[at + by]
    if (!next) return
    setShown(next.id)
    setZoom(0)
  }

  // 폰의 손짓: 양옆으로 밀어 앞뒤 사진으로. preventDefault를 부르지 않으므로
  // 확대 중의 네이티브 팬 스크롤은 그대로 산다 — 그때는 swipeStep이 0을 준다.
  const touch = useRef(null)
  const onTouchStart = (e) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    const from = touch.current
    touch.current = null
    if (!from) return
    const t = e.changedTouches[0]
    const by = swipeStep({ dx: t.clientX - from.x, dy: t.clientY - from.y, zoomed: zoom > 0 })
    if (by) step(by)
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
      <div className="vw-canvas" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* 캡처에는 그림이 없다. 그때 맨 앞에 무엇이 있었고 몇 시였는지를
            창 모양으로 그린다 — 화면을 찍었다는 사실 자체가 내용이다. */}
        {file.shot && !src ? (
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
               style={file.shot?.frame
                 ? { objectFit: 'cover', objectPosition: `${file.shot.frame.x}% ${file.shot.frame.y}%` }
                 : undefined}
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
