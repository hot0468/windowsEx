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

  const clickApp = (key) => {
    const win = windows.find((w) => w.app === key)
    if (!win) return openWindow(key)
    if (!win.minimized && win.z === nextZ - 1) minimizeWindow(win.id)
    else focusWindow(win.id)
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
          {Object.entries(APPS).map(([key, a]) => (
            <button key={key} className="tb-icon" title={a.title} onClick={() => clickApp(key)}>
              <Icon name={a.icon} size={23} />
              {windows.some((w) => w.app === key) && <span className="dot" />}
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
