import { useEffect, useState } from 'react'
import { useGame } from './engine/store.js'
import { APPS } from './apps/registry.jsx'
import Window from './shell/Window.jsx'
import Desktop from './shell/Desktop.jsx'
import Taskbar from './shell/Taskbar.jsx'
import Icon from './icons/Icon.jsx'
import { wallpaper } from './assets/photos.js'
import { LayoutGrid } from './icons/line.jsx'

function Boot() {
  const setBooted = useGame((s) => s.setBooted)
  useEffect(() => {
    const t = setTimeout(setBooted, 2500)
    return () => clearTimeout(t)
  }, [setBooted])
  return (
    <div className="boot">
      <div className="logo"><LayoutGrid size={68} strokeWidth={1.4} /></div>
      <div className="spinner" />
    </div>
  )
}

function Toast() {
  const toast = useGame((s) => s.toast)
  const clearToast = useGame((s) => s.clearToast)
  const openWindow = useGame((s) => s.openWindow)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (!toast) return
    setLeaving(false)
    const out = setTimeout(() => setLeaving(true), 4200)
    const gone = setTimeout(clearToast, 4500)
    return () => { clearTimeout(out); clearTimeout(gone) }
  }, [toast, clearToast])
  if (!toast) return null
  return (
    <div key={toast.id} className={'toast' + (leaving ? ' leaving' : '')}
         onClick={() => { openWindow(toast.app ?? 'messenger'); clearToast() }}>
      <b>
        <Icon name={toast.app === 'mail' ? 'mail' : 'workchat'} size={15} />
        {(toast.app === 'mail' ? '메일' : '한빛톡') + ' — '}{toast.from}
      </b>
      {toast.text}
    </div>
  )
}

function WindowLayer() {
  const windows = useGame((s) => s.windows)
  return windows.map((win) => {
    const cfg = APPS[win.app]
    const C = cfg.comp
    return (
      <Window key={win.id} win={win} title={cfg.title} icon={cfg.icon} width={cfg.w} height={cfg.h}>
        <C {...win.props} />
      </Window>
    )
  })
}

function ClearOverlay() {
  const scenario = useGame((s) => s.scenario)
  return (
    <div className="clear-overlay">
      <div className="big"><Icon name="trophy" size={72} /></div>
      <h1>미션 클리어!</h1>
      <p>"{scenario.goal.successReply}"</p>
      <p>— A상사 이수진 과장</p>
      <button className="btn-primary" onClick={() => location.reload()}>다시 하기</button>
    </div>
  )
}

export default function App() {
  const booted = useGame((s) => s.booted)
  const cleared = useGame((s) => s.cleared)

  useEffect(() => {
    if (!booted) return
    const sc = useGame.getState().scenario
    const timers = sc.messenger.map((m) =>
      setTimeout(() => {
        useGame.getState().deliverMessage()
        useGame.getState().showToast({ from: m.from, text: m.text })
      }, m.delay))
    return () => timers.forEach(clearTimeout)
  }, [booted])

  if (!booted) return <Boot />
  return (
    <div className="desktop" style={wallpaper ? { backgroundImage: `url(${wallpaper})` } : undefined}>
      <Desktop />
      <WindowLayer />
      <Toast />
      <Taskbar />
      {cleared && <ClearOverlay />}
    </div>
  )
}
