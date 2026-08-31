import { useEffect, useRef, useState } from 'react'
import {
  useGame, dayDone, dreamGallery, findFile, laidOff, objectiveDone, overtimeOffer,
  requestsOf, rumorPending, scriptLeft
} from './engine/store.js'
import { APPS, knownWindows, phoneApps } from './apps/registry.jsx'
import { CallScreen } from './apps/Dial.jsx'
import Window from './shell/Window.jsx'
import Desktop from './shell/Desktop.jsx'
import Taskbar from './shell/Taskbar.jsx'
import Progress from './shell/Progress.jsx'
import Crash from './shell/Crash.jsx'
import Ending from './shell/Ending.jsx'
import Lock from './shell/Lock.jsx'
import PhoneShell from './shell/PhoneShell.jsx'
import { useViewport } from './shell/useViewport.js'
import { watchActivity } from './shell/idle.js'
import './shell/phone.css'
import Icon from './icons/Icon.jsx'
import { fileImage, wallpaper } from './assets/photos.js'

import { Info, LayoutGrid, Phone, PhoneOff } from './icons/line.jsx'

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

// 알림 하나가 머무는 시간. 뒤에 줄이 서 있으면 짧게 비켜 준다 — 여덟 줄이
// 한꺼번에 온 날 하나에 4.5초씩 주면 마지막 줄은 30초 뒤에나 보인다.
const TOAST_DWELL = { alone: 4500, waiting: 2400 }
const FADE = 300

function Toast() {
  const toast = useGame((s) => s.toast)
  const waiting = useGame((s) => s.queuedToasts.length)
  const clearToast = useGame((s) => s.clearToast)
  const openWindow = useGame((s) => s.openWindow)
  const setOpenThread = useGame((s) => s.setOpenThread)
  const pushScreen = useGame((s) => s.pushScreen)
  const grants = useGame((s) => s.grants)
  const [leaving, setLeaving] = useState(false)
  // 토스트는 폰 셸(.phone) 바깥에 그려지므로 CSS 만으로는 폰인지 알 수 없다.
  // 폰에서는 안드로이드처럼 화면 위에서 내려오는 카드가 된다.
  const phone = useViewport() === 'phone'
  const shownAt = useRef(0)
  useEffect(() => { shownAt.current = Date.now() }, [toast])
  useEffect(() => {
    if (!toast) return
    setLeaving(false)
    // 머무는 알림은 스스로 가지 않는다. 하루를 막고 서 있는 말이라
    // 4초 뒤 사라지면 무언가 온 것만 보고 내용을 못 읽는다.
    if (toast.sticky) return
    // 줄이 뒤늦게 생겨도 이미 보여 준 시간은 셈에 넣는다 — 그러지 않으면
    // 뒤에 알림이 하나 설 때마다 앞엣것의 목숨이 도로 늘어난다.
    const dwell = waiting ? TOAST_DWELL.waiting : TOAST_DWELL.alone
    const left = Math.max(0, dwell - (Date.now() - shownAt.current))
    const out = setTimeout(() => setLeaving(true), Math.max(0, left - FADE))
    const gone = setTimeout(clearToast, left)
    return () => { clearTimeout(out); clearTimeout(gone) }
  }, [toast, waiting, clearToast])
  if (!toast) return null
  const app = APPS[toast.app]
  return (
    <div key={toast.id}
         className={'toast' + (phone ? ' ph' : '') + (leaving ? ' leaving' : '')}
         onClick={() => {
           if (toast.source) setOpenThread(toast.source, toast.thread)
           // 토스트가 가리키는 자리까지 열어 준다 — 다운로드 완료를 눌렀는데
           // 파일 탐색기가 첫 화면에서 멈추면 알림이 절반만 일한 셈이다.
           if (app) openWindow(toast.app, toast.props)
           // 폰은 창을 그리지 않는다. 홈에 있는 앱(메신저·메일 …)이 여는 창은
           // PhoneShell 의 창 감시가 일부러 건너뛰므로 — 홈에서 연 것과 두 겹으로
           // 쌓이기 때문 — 알림으로 연 것은 여기서 그 앱 화면을 직접 올려야 한다.
           // 이게 없으면 창만 열리고 화면은 그대로다.
           if (phone && app) {
             // 홈에 없는 앱(탐색기 같은)은 창 감시가 'win:' 으로 올려 준다.
             const entry = phoneApps(grants).find((a) => a.app === toast.app)
             if (entry) pushScreen('app:' + entry.id)
           }
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
  return knownWindows(windows).map((win) => {
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

// Once you know who wrote the rumour, you have to decide what to do with it.
// This is not a day boundary — it interrupts the moment you find the name.
// 걸려오는 전화. 어느 앱을 보고 있든 화면을 덮는다 — 전화는 그런 물건이다.
// 받으면 전화 앱이 열리고, 거절해도 기록에는 부재중으로 남는다.
function Ringing() {
  const call = useGame((s) => s.call)
  const answerCall = useGame((s) => s.answerCall)
  const declineCall = useGame((s) => s.declineCall)
  const openWindow = useGame((s) => s.openWindow)
  const pushScreen = useGame((s) => s.pushScreen)
  if (!call || call.stage !== 'ringing') return null
  return (
    <div className="ring">
      <div className="ring-who">
        <div className="ring-name">{call.name}</div>
        <div className="ring-num">{call.number}</div>
        <div className="ring-sub">수신 전화</div>
      </div>
      <div className="ring-keys">
        <button className="ring-no" onClick={declineCall} aria-label="거절">
          <PhoneOff size={24} strokeWidth={1.9} />
        </button>
        <button className="ring-yes"
                onClick={() => { answerCall(); openWindow('dial'); pushScreen('app:dial') }}
                aria-label="받기">
          <Phone size={24} strokeWidth={1.9} />
        </button>
      </div>
    </div>
  )
}

function RumorOverlay() {
  const c = useGame((s) => s.scenario.rumor.choice)
  const actOnRumor = useGame((s) => s.actOnRumor)
  return (
    <div className="clear-overlay rumor">
      <h1>{c.prompt}</h1>
      <div className="lay-picks">
        <button className="lay-pick" onClick={() => actOnRumor('told')}>
          <b>{c.tell}</b>
          <span>글쓴이의 사번과 이름을 소통방에 올립니다.</span>
        </button>
        <button className="lay-pick" onClick={() => actOnRumor('buried')}>
          <b>{c.bury}</b>
          <span>알아낸 것을 덮어둡니다.</span>
        </button>
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

  // The day's tally, not its minutes: the list of what was done is the thing
  // the player just spent the day doing, and reading it back is not a reward.
  const done = requestsOf(scenario, day, overtime, drawn, ripples).length
  return (
    <div className="clear-overlay quit">
      <h1>{scenario.quitting.title}</h1>
      <p className="quit-day">{today.date} · {today.label}</p>
      <div className="quit-score">
        <b>{done}</b>
        <span>요청 완료</span>
        {overtime[day] && <i>야근</i>}
      </div>
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
  const rumor = useGame((s) => s.rumor)
  const slips = useGame((s) => s.slips)
  // The evening only starts once the player clocks off from the request list.
  const closing = useGame((s) => s.closing)
  const finished = dayDone(scenario, day, { grants, unlocked, overtime, drawn, ripples })
  const done = finished && closing
  const cut = laidOff(scenario.ending.layoff, { slips, overtime, drawn }, scenario)
  const offer = done ? overtimeOffer(scenario, day, overtime) : null
  const failed = useGame((s) => s.failed)
  const crashed = useGame((s) => s.crashed)
  const locked = useGame((s) => s.locked)
  const ended = useGame((s) => s.ended)
  const sealed = useGame((s) => s.sealed)
  // 바탕에 걸어 둔 사진. 그 사진이 사라진 날에는(관측하면 사라진다) 아무 말
  // 없이 기본 배경으로 돌아간다 — 없는 사진을 붙들면 바탕이 검게 남는다.
  const wall = useGame((s) => s.wall)
  const dreamt = useGame((s) => s.dreamt)
  const shot = wall && !(dreamt && scenario.dream?.photos?.includes(wall))
    ? findFile(dreamGallery(scenario, scenario.fs, dreamt), wall)?.image
    : null
  const paper = (shot && fileImage(shot)) || wallpaper
  const shell = useViewport()

  // 개발 중에만 여는 문.
  //   ?ending=seal  5일차 경조사 게시판을 띄운 채로 시작한다 — 부고를 열어
  //                 끝까지 내리면 마지막 장면이 실제와 똑같이 돈다.
  //   ?ending=say   부고를 이미 본 것으로 치고 메시지부터 바로 튼다.
  //   ?ending=true  그 이름의 엔딩 화면으로 바로 간다.
  //   ?meet=kickoff 화상회의 화면을 바로 연다(id 를 비우면 첫 회의).
  //
  // 부팅 전에 돈다. 굳은 채로 저장된 판을 복구하는 길과 부딪히면 미리보기가
  // 시작하자마자 끝나 버린다.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const want = new URLSearchParams(window.location.search).get('ending')
    if (!want) return
    const g = useGame.getState()
    if (want !== 'seal' && want !== 'say') return g.endGame(want)
    useGame.setState({ day: g.scenario.days.length, sealed: false, frozen: null, ended: false })
    g.unlockSite('portal.ar.co.kr')
    g.openWindow('browser', { start: { kind: 'site', url: 'portal.ar.co.kr', path: '/hr/bereavement' } })
  }, [])

  // ?meet=<회의 id> 로 화상회의 화면을 바로 열어 본다. 실제로는 톡의 요청이
  // 열어 주는 창이라, 그 요청까지 가지 않고는 화면을 볼 수 없었다.
  // id 를 안 적으면 첫 회의를 연다. 없는 id 면 무엇이 있는지 알려 준다.
  useEffect(() => {
    if (!import.meta.env.DEV || !booted) return
    const want = new URLSearchParams(window.location.search).get('meet')
    if (want === null) return
    const g = useGame.getState()
    const rooms = g.scenario.meetings ?? {}
    const id = want && rooms[want] ? want : Object.keys(rooms)[0]
    if (!id) return
    if (want && !rooms[want]) {
      // 조용히 딴 회의를 열면 왜 다른 화면이 떴는지 알 수 없다.
      console.warn(`[dev] '${want}' 라는 회의는 없다. 있는 것: ${Object.keys(rooms).join(', ')}`)
    }
    g.openWindow('meet', { id })
  }, [booted])

  // 메시지부터 보는 문은 부팅이 끝나기를 기다린다. 부팅 화면 뒤에서 말이
  // 오가면 첫 줄을 놓친다.
  useEffect(() => {
    if (!import.meta.env.DEV || !booted) return
    if (new URLSearchParams(window.location.search).get('ending') === 'say') useGame.getState().witness()
  }, [booted])

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
      // 화면 캡처. 실제 키보드의 그 자리다.
      if (e.key === 'PrintScreen') {
        e.preventDefault()
        useGame.getState().capture()
      }
      // 바탕화면 보기. 실제 윈도우와 같은 자리에 둔다(Win 또는 Meta+D).
      if (e.metaKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        useGame.getState().showDesktop()
      }
      // arm()은 watchActivity가 keydown까지 듣고 있으므로 여기서 부르지 않는다.
    }
    window.addEventListener('keydown', onKey)
    const unwatch = watchActivity(window, arm)
    arm()
    return () => {
      clearTimeout(idle)
      window.removeEventListener('keydown', onKey)
      unwatch()
    }
  }, [booted])

  // 브라우저 창이 줄면 오른쪽·아래에 있던 창은 화면 밖에 남는다. 작업표시줄로도
  // 되돌릴 수 없으므로, 크기가 바뀔 때마다 열린 창을 다시 화면 안에 앉힌다.
  useEffect(() => {
    const onResize = () => useGame.getState().fitWindows(window.innerWidth, window.innerHeight)
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  useEffect(() => {
    if (!booted) return
    const sc = useGame.getState().scenario
    // The timed script belongs to the work messenger's one live thread; naming it
    // on the toast lets a click jump straight into that conversation.
    const source = 'workMessenger'
    const live = sc[source].sections.flatMap((s) => s.threads).find((t) => t.live)
    // Only what the script has not said yet: booting into tomorrow used to
    // replay the first morning as toasts on top of the new day.
    const timers = scriptLeft(sc.messenger, useGame.getState().msgCount).flatMap((m) => [
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

  // 오버레이는 두 셸이 함께 쓴다 — 이미 전체화면이라 폰에서도 그대로 선다.
  const overlays = (
    <>
      <Toast />
      <Ringing />
      <CallScreen />
      {locked && <Lock />}
      {rumorPending(rumor) && !failed && <RumorOverlay />}
      {cut && !failed && !rumorPending(rumor) && <LayoffOverlay />}
      {offer && !cut && !rumorPending(rumor) && <OvertimeOverlay offer={offer} />}
      {done && !offer && !cut && !rumorPending(rumor) && <QuitOverlay />}
      {failed && !finished && <FailOverlay />}
    </>
  )

  if (shell === 'phone') return <><PhoneShell />{!sealed && overlays}</>

  // 굳은 뒤로는 바탕화면도, 할 일 목록도, 작업표시줄도 없다 — 남은 요청은
  // 이제 아무 의미가 없다. 마지막 장면이 띄우는 창들만 뜬다.
  //
  // 창은 여기서 그리던 것을 그대로 그린다. 딴 가지로 빼면 리액트가 창을
  // 새로 세워서, 굳어야 할 화면이 맨 위로 되감긴다.
  return (
    <div className={'desktop' + (sealed ? ' sealed' : '')}
         style={paper ? { backgroundImage: `url(${paper})` } : undefined}>
      {!sealed && <Desktop />}
      {!sealed && <Progress />}
      <WindowLayer />
      {!sealed && overlays}
      {!sealed && <Taskbar />}
    </div>
  )
}
