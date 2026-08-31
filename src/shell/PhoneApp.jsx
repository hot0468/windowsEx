import { useEffect, useRef, useState } from 'react'
import { useGame } from '../engine/store.js'

// 엣지 스와이프로 인식할 시작 영역. 이보다 안쪽에서 시작한 드래그는 앱
// 내용의 스크롤이지 뒤로가기가 아니다.
const EDGE = 20
// 손을 뗀 뒤 남은 거리를 마저 가는 시간. 짧게 둔다 — 하루에 수십 번 오간다.
const SETTLE = 190

// 손을 뗀 순간 뒤로 갈지 제자리로 돌아갈지. 거리만 보면 실제 폰과 다르게
// 느껴진다 — 짧아도 빠르게 튕기면 넘어가고, 길게 끌었어도 되돌리는 쪽으로
// 손이 움직이고 있었으면 마음이 바뀐 것이다.
//
// vx 는 px/ms. 기준 거리는 화면 폭의 30% — 넓은 화면에서 같은 픽셀은 덜 끈 것이다.
export function settleBack({ dx, vx = 0, width = 390 }) {
  if (vx <= -0.5) return false          // 되돌리는 속도가 붙었다
  if (vx >= 0.5) return dx > 24         // 튕겼다 — 조금이라도 끌었으면 넘어간다
  return dx > width * 0.3
}

export default function PhoneApp({ onBack, children }) {
  const screens = useGame((s) => s.screens)
  const popScreen = useGame((s) => s.popScreen)
  const goPhoneHome = useGame((s) => s.goPhoneHome)
  const [dx, setDx] = useState(0)
  // 손을 뗀 뒤의 마무리. 'go'면 마저 밀어내고, 'back'이면 제자리로 돌아간다.
  const [settling, setSettling] = useState(null)
  const drag = useRef(null)

  // 뒤로 갈 데가 있는지는 두 곳이 정한다. 앱이 제 안의 깊이를 onBack으로
  // 알려주면 그걸 쓰고, 아니면 스택의 깊이를 본다.
  const back = onBack ?? (screens.length > 1 ? popScreen : goPhoneHome)

  // 마무리 애니메이션이 끝나야 실제로 화면을 벗긴다. 먼저 벗기면 애니메이션이
  // 시작도 못 하고 화면이 툭 끊긴다.
  useEffect(() => {
    if (!settling) return
    const t = setTimeout(() => {
      if (settling === 'go') back()
      setSettling(null)
      setDx(0)
    }, SETTLE)
    return () => clearTimeout(t)
  }, [settling])

  const onPointerDown = (e) => {
    if (e.clientX > EDGE || settling) return
    drag.current = { x0: e.clientX, x: e.clientX, t: e.timeStamp, vx: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    // 마지막 한 조각의 속도만 본다 — 전체 평균은 처음의 망설임까지 섞는다.
    const dt = e.timeStamp - d.t
    if (dt > 0) d.vx = (e.clientX - d.x) / dt
    d.x = e.clientX
    d.t = e.timeStamp
    setDx(Math.max(0, e.clientX - d.x0))
  }
  const onPointerUp = () => {
    const d = drag.current
    if (!d) return
    drag.current = null
    setSettling(settleBack({ dx, vx: d.vx, width: window.innerWidth }) ? 'go' : 'back')
  }

  // 끄는 동안은 손가락을 그대로 따라간다(전환 없음). 손을 뗀 뒤에만 남은
  // 거리를 시간에 실어 마무리한다.
  const style = settling === 'go'
    ? { transform: 'translateX(100%)', transition: `transform ${SETTLE}ms var(--p-ease)` }
    : settling === 'back'
      ? { transform: 'none', transition: `transform ${SETTLE}ms var(--p-ease)` }
      : dx ? { transform: `translateX(${dx}px)` } : undefined

  return (
    <div className={'phone-app' + (drag.current || settling ? ' dragging' : '')}
         style={style}
         onPointerDown={onPointerDown}
         onPointerMove={onPointerMove}
         onPointerUp={onPointerUp}
         onPointerCancel={onPointerUp}>
      {/* 제목줄도 뒤로가기도 여기 없다. 앱들은 저마다 제 머리(메일의 도구 줄,
          브라우저의 주소창, 톡의 상단)를 이미 들고 있어 두 겹이 됐다.
          나가는 길은 내비바와 엣지 스와이프가 맡는다. */}
      <div className="phone-body">{children}</div>
    </div>
  )
}
