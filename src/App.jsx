import { useEffect, useState } from 'react'
import { useGame, dayDone, laidOff, objectiveDone, overtimeOffer, requestsOf } from './engine/store.js'
import { APPS } from './apps/registry.jsx'
import Window from './shell/Window.jsx'
import Desktop from './shell/Desktop.jsx'
import Taskbar from './shell/Taskbar.jsx'
import Progress from './shell/Progress.jsx'
import Crash from './shell/Crash.jsx'
import Ending from './shell/Ending.jsx'
import Lock from './shell/Lock.jsx'
import Icon from './icons/Icon.jsx'
import { wallpaper } from './assets/photos.js'

import { Info, LayoutGrid } from './icons/line.jsx'

// How long the sender shows as "작성중…" before each scripted message lands.
const TYPING_LEAD = 900

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
  const setOpenThread = useGame((s) => s.setOpenThread)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (!toast) return
    setLeaving(false)
    const out = setTimeout(() => setLeaving(true), 4200)
    const gone = setTimeout(clearToast, 4500)
    return () => { clearTimeout(out); clearTimeout(gone) }
  }, [toast, clearToast])
  if (!toast) return null
  const app = APPS[toast.app]
  return (
    <div key={toast.id} className={'toast' + (leaving ? ' leaving' : '')}
         onClick={() => {
           if (toast.source) setOpenThread(toast.source, toast.thread)
           if (app) openWindow(toast.app)
           clearToast()
         }}>
      <b>
        {app ? <Icon name={app.icon} size={15} /> : <Info size={15} strokeWidth={1.9} />}
        {app ? `${app.title} — ${toast.from}` : toast.from}
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
      <Window key={win.id} win={win} title={cfg.title} icon={cfg.icon}
              width={cfg.w} height={cfg.h} theme={cfg.theme}>
        <C {...win.props} winId={win.id} />
      </Window>
    )
  })
}

function FailOverlay() {
  const fail = useGame((s) => s.scenario.goal.failure)
  const newGame = useGame((s) => s.newGame)
  const loadGame = useGame((s) => s.loadGame)
  return (
    <div className="clear-overlay fail">
      <div className="big"><Icon name="mail" size={64} /></div>
      <h1>{fail.title}</h1>
      {fail.lines.map((line, i) => <p key={i}>{line}</p>)}
      <div className="fail-row">
        <button className="btn-primary" onClick={newGame}>처음부터 다시</button>
        <button className="sm-cancel" onClick={loadGame}>저장한 시점으로</button>
      </div>
    </div>
  )
}

// A week of wrong answers ends the job, not the day. The choice is which
// kind of leaving it is called.
function LayoffOverlay() {
  const layoff = useGame((s) => s.scenario.ending.layoff)
  const layOff = useGame((s) => s.layOff)
  const [asked, setAsked] = useState(false)
  return (
    <div className="clear-overlay lay">
      <div className="lay-head">{layoff.notice.from}</div>
      {layoff.notice.lines.map((line, i) => <p key={i} className="quit-line">{line}</p>)}
      {!asked
        ? <button className="btn-primary" onClick={() => setAsked(true)}>어떤 선택이 있습니까</button>
        : (
          <div className="lay-picks">
            {layoff.choices.map((c) => (
              <button key={c.id} className="lay-pick" onClick={() => layOff(c.id)}>
                <b>{c.label}</b>
                <span>{c.note}</span>
              </button>
            ))}
          </div>
        )}
    </div>
  )
}

// Everything for today is done — but there is always more, if you want it.
function OvertimeOverlay({ offer }) {
  const day = useGame((s) => s.day)
  const workLate = useGame((s) => s.workLate)
  const goHome = useGame((s) => s.goHome)
  const nights = useGame((s) => Object.values(s.overtime).filter(Boolean).length)
  return (
    <div className="clear-overlay ot">
      <h1>{offer.title}</h1>
      {offer.lines.map((line, i) => <p key={i} className="quit-line">{line}</p>)}
      {nights > 0 && <p className="ot-count">이번 주 야근 {nights}일째</p>}
      <div className="fail-row">
        <button className="btn-primary" onClick={workLate}>{offer.stay}</button>
        <button className="sm-cancel" onClick={goHome}>{offer.leave}</button>
      </div>
      <p className="ot-note">{offer.note}</p>
    </div>
  )
}

function QuitOverlay() {
  const scenario = useGame((s) => s.scenario)
  const day = useGame((s) => s.day)
  const finishDay = useGame((s) => s.finishDay)
  const overtime = useGame((s) => s.overtime)
  const drawn = useGame((s) => s.drawn)
  const ripples = useGame((s) => s.ripples)
  const today = scenario.days[day - 1]

  return (
    <div className="clear-overlay quit">
      <div className="big"><Icon name="trophy" size={64} /></div>
      <h1>{scenario.quitting.title}</h1>
      <p className="quit-day">{today.date} · {today.label}</p>
      <ul className="quit-list">
        {requestsOf(scenario, day, overtime, drawn, ripples).map((o) => <li key={o.id}>{o.title}</li>)}
      </ul>
      <p className="quit-stat">
        요청 {requestsOf(scenario, day, overtime, drawn, ripples).length}건 완료{overtime[day] && ' · 야근'}
      </p>
      {today.closing?.map((line, i) => <p key={i} className="quit-line">{line}</p>)}
      <button className="btn-primary" onClick={finishDay}>{scenario.quitting.button}</button>
    </div>
  )
}

export default function App() {
  const booted = useGame((s) => s.booted)
  const scenario = useGame((s) => s.scenario)
  const day = useGame((s) => s.day)
  const grants = useGame((s) => s.grants)
  const unlocked = useGame((s) => s.unlocked)
  const overtime = useGame((s) => s.overtime)
  const drawn = useGame((s) => s.drawn)
  const ripples = useGame((s) => s.ripples)
  const slips = useGame((s) => s.slips)
  const done = dayDone(scenario, day, { grants, unlocked, overtime, drawn, ripples })
  const cut = laidOff(scenario.ending.layoff, { slips, overtime, drawn }, scenario)
  const offer = done ? overtimeOffer(scenario, day, overtime) : null
  const failed = useGame((s) => s.failed)
  const crashed = useGame((s) => s.crashed)
  const locked = useGame((s) => s.locked)
  const ended = useGame((s) => s.ended)

  // Ctrl+Alt+L locks on the spot; leaving the machine alone locks it too.
  useEffect(() => {
    if (!booted) return
    const { idleMs } = useGame.getState().scenario.lock
    let idle
    const arm = () => {
      clearTimeout(idle)
      idle = setTimeout(() => {
        const g = useGame.getState()
        if (g.booted && !g.crashed && !g.locked) g.lock()
      }, idleMs)
    }
    const onKey = (e) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        useGame.getState().lock()
      }
      arm()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', arm)
    arm()
    return () => {
      clearTimeout(idle)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', arm)
    }
  }, [booted])

  useEffect(() => {
    if (!booted) return
    const sc = useGame.getState().scenario
    // The timed script belongs to the work messenger's one live thread; naming it
    // on the toast lets a click jump straight into that conversation.
    const source = 'workMessenger'
    const live = sc[source].sections.flatMap((s) => s.threads).find((t) => t.live)
    const timers = sc.messenger.flatMap((m) => [
      setTimeout(() => useGame.getState().setTyping(live.id, true),
        Math.max(0, m.delay - TYPING_LEAD)),
      setTimeout(() => {
        const g = useGame.getState()
        g.setTyping(live.id, false)
        g.deliverMessage()
        g.showToast({ from: m.from, text: m.text, app: 'messenger', source, thread: live.id })
      }, m.delay)
    ])
    return () => timers.forEach(clearTimeout)
  }, [booted])

  if (ended) return <Ending />
  if (crashed) return <Crash />
  if (!booted) return <Boot />
  return (
    <div className="desktop" style={wallpaper ? { backgroundImage: `url(${wallpaper})` } : undefined}>
      <Desktop />
      <Progress />
      <WindowLayer />
      <Toast />
      <Taskbar />
      {locked && <Lock />}
      {cut && !failed && <LayoffOverlay />}
      {offer && !cut && <OvertimeOverlay offer={offer} />}
      {done && !offer && !cut && <QuitOverlay />}
      {failed && !done && <FailOverlay />}
    </div>
  )
}
