import { useEffect, useRef } from 'react'
import { useGame, fitY, resizeRect } from '../engine/store.js'
import Icon from '../icons/Icon.jsx'
import { Minus, Square, X } from '../icons/line.jsx'

const TASKBAR = 48
const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

export default function Window({ win, title, icon, width = 640, height = 440, children }) {
  const focusWindow = useGame((s) => s.focusWindow)
  const closeWindow = useGame((s) => s.closeWindow)
  const minimizeWindow = useGame((s) => s.minimizeWindow)
  const toggleMaximize = useGame((s) => s.toggleMaximize)
  const moveWindow = useGame((s) => s.moveWindow)
  const resizeWindow = useGame((s) => s.resizeWindow)
  const drag = useRef(null)
  const grab = useRef(null)

  // A window keeps the app's default size until the player resizes it.
  const w = win.w ?? width
  const h = win.h ?? height

  useEffect(() => {
    const y = fitY(win.y, h, window.innerHeight)
    if (y !== win.y) moveWindow(win.id, win.x, y)
  }, [])

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

  const startResize = (dir) => (e) => {
    grab.current = { dir, x0: e.clientX, y0: e.clientY, rect: { x: win.x, y: win.y, w, h } }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onResizeMove = (e) => {
    const g = grab.current
    if (!g) return
    resizeWindow(win.id, resizeRect(g.rect, g.dir, e.clientX - g.x0, e.clientY - g.y0))
  }
  const endResize = () => { grab.current = null }

  const style = win.maximized
    ? { left: 0, top: 0, width: '100%', height: `calc(100% - ${TASKBAR}px)`, zIndex: win.z }
    : {
        left: win.x, top: win.y, zIndex: win.z,
        width: `min(${w}px, 100%)`,
        height: `min(${h}px, calc(100% - ${TASKBAR}px))`
      }

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
      {!win.maximized && HANDLES.map((dir) => (
        <span key={dir} className={`rz rz-${dir}`} onPointerDown={startResize(dir)}
              onPointerMove={onResizeMove} onPointerUp={endResize} />
      ))}
    </div>
  )
}
