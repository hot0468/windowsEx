import { useRef } from 'react'
import { useGame } from '../engine/store.js'
import Icon from '../icons/Icon.jsx'
import { Minus, Square, X } from '../icons/line.jsx'

export default function Window({ win, title, icon, width = 640, height = 440, children }) {
  const focusWindow = useGame((s) => s.focusWindow)
  const closeWindow = useGame((s) => s.closeWindow)
  const minimizeWindow = useGame((s) => s.minimizeWindow)
  const toggleMaximize = useGame((s) => s.toggleMaximize)
  const moveWindow = useGame((s) => s.moveWindow)
  const drag = useRef(null)

  const onPointerDown = (e) => {
    if (e.target.closest('button')) return
    drag.current = { dx: e.clientX - win.x, dy: e.clientY - win.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current || win.maximized) return
    moveWindow(win.id, e.clientX - drag.current.dx, Math.max(0, e.clientY - drag.current.dy))
  }
  const onPointerUp = () => { drag.current = null }

  const style = win.maximized
    ? { left: 0, top: 0, width: '100%', height: 'calc(100% - 48px)', zIndex: win.z }
    : { left: win.x, top: win.y, width, height, zIndex: win.z }

  return (
    <div className={'window' + (win.minimized ? ' minimized' : '')} style={style}
         onPointerDown={() => focusWindow(win.id)}>
      <div className="titlebar" onPointerDown={onPointerDown}
           onPointerMove={onPointerMove} onPointerUp={onPointerUp}
           onDoubleClick={() => toggleMaximize(win.id)}>
        <span className="title"><Icon name={icon} size={16} />{title}</span>
        <div className="win-buttons">
          <button onClick={() => minimizeWindow(win.id)} title="최소화"><Minus size={13} strokeWidth={1.5} /></button>
          <button onClick={() => toggleMaximize(win.id)} title="최대화"><Square size={11} strokeWidth={1.7} /></button>
          <button className="close" onClick={() => closeWindow(win.id)} title="닫기"><X size={13} strokeWidth={1.5} /></button>
        </div>
      </div>
      <div className="win-body">{children}</div>
    </div>
  )
}
