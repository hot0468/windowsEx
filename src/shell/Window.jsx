import { useEffect, useRef, useState } from 'react'
import { useGame, fitY, resizeRect, unsavedFile } from '../engine/store.js'
import Icon from '../icons/Icon.jsx'
import { Minus, Square, X } from '../icons/line.jsx'

const TASKBAR = 48
const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

export default function Window({ win, title, icon, theme, width = 640, height = 440, children }) {
  const focusWindow = useGame((s) => s.focusWindow)
  const closeWindow = useGame((s) => s.closeWindow)
  const minimizeWindow = useGame((s) => s.minimizeWindow)
  const toggleMaximize = useGame((s) => s.toggleMaximize)
  const moveWindow = useGame((s) => s.moveWindow)
  const resizeWindow = useGame((s) => s.resizeWindow)
  const saveSheet = useGame((s) => s.saveSheet)
  const dropDrafts = useGame((s) => s.dropDrafts)
  // 저장 안 한 것을 들고 있는 창은 그냥 닫지 않는다. 창틀은 무엇이 저장 안
  // 됐는지 모르고, 저장이라는 개념을 가진 앱이 있는지만 스토어에 묻는다.
  const unsaved = useGame((s) => unsavedFile(s, win))
  const [asking, setAsking] = useState(false)
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
    <div className={'window' + (win.minimized ? ' minimized' : '') + (win.maximized ? ' maximized' : '')}
         style={style}
         onPointerDown={() => focusWindow(win.id)}>
      <div className={'titlebar' + (theme ? ' themed' : '')}
           style={theme ? { background: theme } : undefined}
           onPointerDown={onPointerDown}
           onPointerMove={onPointerMove} onPointerUp={onPointerUp}
           onDoubleClick={() => toggleMaximize(win.id)}>
        <span className="title"><Icon name={icon} size={16} />{title}</span>
        <div className="win-buttons">
          <button onClick={() => minimizeWindow(win.id)} title="최소화"><Minus size={13} strokeWidth={1.5} /></button>
          <button onClick={() => toggleMaximize(win.id)} title="최대화"><Square size={11} strokeWidth={1.7} /></button>
          <button className="close" onClick={() => (unsaved ? setAsking(true) : closeWindow(win.id))}
                  title="닫기"><X size={13} strokeWidth={1.5} /></button>
        </div>
      </div>
      <div className="win-body">{children}</div>
      {asking && unsaved && (
        <div className="win-ask">
          <div className="win-ask-card">
            <p><b>{title}</b> 의 변경 내용을 저장하시겠습니까?</p>
            <p className="win-ask-sub">저장하지 않으면 고친 내용이 사라집니다.</p>
            <div className="win-ask-row">
              <button className="btn-primary"
                      onClick={() => { saveSheet(unsaved); closeWindow(win.id) }}>저장</button>
              <button className="sm-cancel"
                      onClick={() => { dropDrafts(unsaved); closeWindow(win.id) }}>저장 안 함</button>
              <button className="sm-cancel" onClick={() => setAsking(false)}>취소</button>
            </div>
          </div>
        </div>
      )}
      {!win.maximized && HANDLES.map((dir) => (
        <span key={dir} className={`rz rz-${dir}`} onPointerDown={startResize(dir)}
              onPointerMove={onResizeMove} onPointerUp={endResize} />
      ))}
    </div>
  )
}
