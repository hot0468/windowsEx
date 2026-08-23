import { useEffect, useState } from 'react'
import { useGame } from '../engine/store.js'
import { APPS } from '../apps/registry.jsx'
import Icon from '../icons/Icon.jsx'
import { LayoutGrid } from '../icons/line.jsx'

export default function Taskbar() {
  const windows = useGame((s) => s.windows)
  const nextZ = useGame((s) => s.nextZ)
  const openWindow = useGame((s) => s.openWindow)
  const focusWindow = useGame((s) => s.focusWindow)
  const minimizeWindow = useGame((s) => s.minimizeWindow)
  const [startOpen, setStartOpen] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  // Clicking the button of the frontmost window minimizes it; anything else comes forward.
  const clickWindow = (w) => {
    if (!w.minimized && w.z === nextZ - 1) minimizeWindow(w.id)
    else focusWindow(w.id)
  }

  return (
    <>
      {startOpen && (
        <div className="startmenu">
          <h3>고정됨</h3>
          <div className="sm-grid">
            {Object.entries(APPS).map(([key, a]) => (
              <button key={key} className="sm-app"
                      onClick={() => { openWindow(key); setStartOpen(false) }}>
                <div className="glyph"><Icon name={a.icon} size={30} /></div>{a.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="taskbar">
        <div className="tb-center">
          <button className="tb-icon" title="시작" onClick={() => setStartOpen(!startOpen)}>
            <LayoutGrid size={19} strokeWidth={1.8} />
          </button>
          {windows.map((w) => (
            <button key={w.id} className="tb-icon" title={APPS[w.app].title}
                    onClick={() => clickWindow(w)}>
              <Icon name={APPS[w.app].icon} size={23} />
              <span className="dot" />
            </button>
          ))}
        </div>
        <div className="tb-clock">
          {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}<br />
          {now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
        </div>
      </div>
    </>
  )
}
