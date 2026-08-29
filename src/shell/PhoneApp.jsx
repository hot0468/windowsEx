import { useRef, useState } from 'react'
import { useGame } from '../engine/store.js'
import Icon from '../icons/Icon.jsx'
import { ChevronLeft } from '../icons/line.jsx'

// 엣지 스와이프로 인식할 시작 영역. 이보다 안쪽에서 시작한 드래그는 앱
// 내용의 스크롤이지 뒤로가기가 아니다.
const EDGE = 20
// 이만큼 끌면 놓았을 때 뒤로 간다.
const COMMIT = 70

export default function PhoneApp({ title, icon, onBack, children }) {
  const screens = useGame((s) => s.screens)
  const popScreen = useGame((s) => s.popScreen)
  const goPhoneHome = useGame((s) => s.goPhoneHome)
  const [dx, setDx] = useState(0)
  const drag = useRef(null)

  // 뒤로 갈 데가 있는지는 두 곳이 정한다. 앱이 제 안의 깊이를 onBack으로
  // 알려주면 그걸 쓰고, 아니면 스택의 깊이를 본다.
  const back = onBack ?? (screens.length > 1 ? popScreen : goPhoneHome)

  const onPointerDown = (e) => {
    if (e.clientX > EDGE) return
    drag.current = { x0: e.clientX }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    setDx(Math.max(0, e.clientX - drag.current.x0))
  }
  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    if (dx > COMMIT) back()
    setDx(0)
  }

  return (
    <div className="phone-app"
         style={dx ? { transform: `translateX(${dx}px)` } : undefined}
         onPointerDown={onPointerDown}
         onPointerMove={onPointerMove}
         onPointerUp={onPointerUp}
         onPointerCancel={onPointerUp}>
      <header className="pa-head">
        <button className="pa-back" onClick={back} aria-label="뒤로">
          <ChevronLeft size={22} strokeWidth={1.8} />
        </button>
        <span className="pa-title">
          {icon && <Icon name={icon} size={17} />}{title}
        </span>
      </header>
      <div className="phone-body">{children}</div>
    </div>
  )
}
