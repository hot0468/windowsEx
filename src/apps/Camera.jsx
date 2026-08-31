import { useEffect, useRef, useState } from 'react'
import { gameClock, useGame } from '../engine/store.js'
import { cameraShot } from '../assets/photos.js'
import { framePct, shiftPct, tiltNote, useTilt } from '../shell/tilt.js'
import { isPano, makePano, panoFrame } from '../shell/pano.js'
import { Camera as CameraIcon, Image } from '../icons/line.jsx'

// 폰 카메라. 실제 렌즈가 없으므로 '무엇을 찍었는지'를 남긴다 — PC 의 화면
// 캡처와 같은 방식이다. 이 앱의 요점은 찍는 것이 아니라, 찍은 것을 톡으로
// 보낼 수 있는 파일로 만드는 데 있다.
// 무엇을 찍는가. id 는 뷰파인더에 깔 사진의 이름이기도 하다 —
// src/assets/camera/<id>.webp 를 넣어 두면 그 사진이 렌즈에 보이고, 찍은
// 사진에도 그대로 들어간다. 없으면 어두운 화면으로 남는다(둘 다 동작한다).
// 사진은 뷰파인더보다 이만큼 크다. 사방으로 30%씩 둘러볼 여유가 생긴다.
const OVER = 1.6

const SUBJECTS = [
  ['desk', '책상 위'],
  ['screen', '모니터 화면'],
  ['paper', '서류'],
  ['window', '창밖']
]

// 180° 파노라마를 그리는 뷰파인더. 사진을 구 안쪽에 발라 놓고 그 한가운데서
// 둘러보는 것과 같은 그림이다 — 기울이면 원근이 실제로 바뀐다(가운데는 적게,
// 가장자리는 많이 움직인다). 평면 사진을 밀 때는 없던 것이다.
//
// WebGL 이 없는 환경에서는 아무것도 그리지 않는다. 부르는 쪽이 그때 평면으로
// 되돌리므로 화면이 비지는 않는다.
function PanoView({ src, pan, onFail }) {
  const canvas = useRef(null)
  const view = useRef(null)
  const at = useRef(pan)
  at.current = pan

  useEffect(() => {
    let alive = true
    let raf = 0
    const img = new window.Image()
    img.onload = () => {
      if (!alive || !canvas.current) return
      let made = null
      try {
        made = makePano(canvas.current, img)
      } catch {
        made = null
      }
      if (!made) return onFail?.()
      view.current = made
      // 기울기는 매 프레임 바뀐다. 그릴 것이 한 장뿐이라 루프가 싸다.
      const loop = () => {
        if (!alive) return
        view.current?.draw(at.current)
        raf = requestAnimationFrame(loop)
      }
      loop()
    }
    img.onerror = () => onFail?.()
    img.src = src
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      view.current?.dispose()
      view.current = null
    }
  }, [src])

  return <canvas className="cam-pano" ref={canvas} />
}

export default function Camera() {
  const scenario = useGame((s) => s.scenario)
  const day = useGame((s) => s.day)
  const overtime = useGame((s) => s.overtime)
  const dayAt = useGame((s) => s.dayAt)
  const takePhoto = useGame((s) => s.takePhoto)
  const openWindow = useGame((s) => s.openWindow)
  const pushScreen = useGame((s) => s.pushScreen)
  const photos = useGame((s) => s.photos)
  const [subject, setSubject] = useState(SUBJECTS[0][0])
  const [shot, setShot] = useState(null)
  // 사진은 뷰파인더보다 크다. 기기를 기울이면 그 안을 둘러본다 — 센서가 없거나
  // 권한을 안 준 자리에서는 손으로 끌어서 같은 일을 한다.
  const { pan, setPan, state: tilt, ask, needsAsk } = useTilt()
  const grab = useRef(null)
  // 사진이 파노라마(2:1)인지는 실제로 읽어 봐야 안다. 넷 중 일부만 파노라마일
  // 수 있으므로 대상마다 따로 기억한다 — 평면 사진이 구에 발리면 어색해진다.
  const [pano, setPano] = useState({})
  const clock = gameClock(scenario, { day, overtime, dayAt })

  // 찍은 직후의 흰 번쩍임. 셔터를 눌렀다는 것을 화면이 알린다.
  useEffect(() => {
    if (!shot) return
    const t = setTimeout(() => setShot(null), 1400)
    return () => clearTimeout(t)
  }, [shot])

  const label = SUBJECTS.find(([id]) => id === subject)?.[1]
  const lens = cameraShot(subject)
  const shift = shiftPct(pan, OVER)
  const wide = pano[subject] === true

  // 이 사진이 파노라마인지 한 번만 재어 둔다.
  useEffect(() => {
    if (!lens || subject in pano) return
    const img = new window.Image()
    img.onload = () => setPano((p) => ({ ...p, [subject]: isPano(img) }))
    img.onerror = () => setPano((p) => ({ ...p, [subject]: false }))
    img.src = lens
  }, [lens, subject])

  // 손으로 끌기. 화면 절반을 끌면 끝까지 돈다.
  const drag = {
    onPointerDown: (e) => { grab.current = { x: e.clientX, y: e.clientY, pan } },
    onPointerMove: (e) => {
      const g = grab.current
      if (!g) return
      const w = e.currentTarget.clientWidth || 1
      const h = e.currentTarget.clientHeight || 1
      setPan({
        x: Math.max(-1, Math.min(1, g.pan.x - ((e.clientX - g.x) / w) * 2)),
        y: Math.max(-1, Math.min(1, g.pan.y - ((e.clientY - g.y) / h) * 2))
      })
    },
    onPointerUp: () => { grab.current = null },
    onPointerCancel: () => { grab.current = null }
  }

  return (
    <div className="cam">
      <div className="cam-view" {...(lens ? drag : {})}>
        {shot ? (
          <div className="cam-flash">
            <b>{shot.name}</b>
            <span>갤러리에 저장했습니다</span>
          </div>
        ) : (
          <>
            {/* 렌즈에 보이는 것. 사진을 넣어 두면 그것이 보이고, 없으면
                어두운 화면 그대로다. */}
            {lens && wide && (
              <PanoView src={lens} pan={pan}
                        onFail={() => setPano((p) => ({ ...p, [subject]: false }))} />
            )}
            {lens && !wide && (
              <img className="cam-lens" src={lens} alt="" draggable="false"
                   style={{
                     width: OVER * 100 + '%',
                     height: OVER * 100 + '%',
                     transform: `translate(${shift.x}%, ${shift.y}%)`
                   }} />
            )}
            <div className="cam-grid" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="cam-meta">
              <span>{day}일차 {clock.time}</span>
              <span>{label}</span>
            </div>
            {/* 기울기가 안 되는 이유는 여러 가지다(권한·http·센서 없음).
                권한을 물어야 하는 기기에는 버튼을, 그 밖에는 왜 안 되는지와
                대신 할 수 있는 것을 말해 준다. */}
            {lens && needsAsk && (
              <button className="cam-tilt" onClick={ask}>기울여서 둘러보기</button>
            )}
            {lens && !needsAsk && tiltNote(tilt) && (
              <p className="cam-note">{tiltNote(tilt)}</p>
            )}
          </>
        )}
      </div>

      <div className="cam-subjects">
        {SUBJECTS.map(([id, name]) => (
          <button key={id} className={'cam-subject' + (subject === id ? ' on' : '')}
                  onClick={() => setSubject(id)}>{name}</button>
        ))}
      </div>

      <div className="cam-bar">
        <button className="cam-roll" aria-label="갤러리 열기"
                onClick={() => { openWindow('gallery'); pushScreen('app:gallery') }}>
          <Image size={20} strokeWidth={1.8} />
          <em>{photos.length}</em>
        </button>
        <button className="cam-shutter" aria-label="사진 찍기"
                onClick={() => setShot(takePhoto(label, subject, wide ? panoFrame(pan) : framePct(pan)))}>
          <span />
        </button>
        <span className="cam-space" />
      </div>
    </div>
  )
}
