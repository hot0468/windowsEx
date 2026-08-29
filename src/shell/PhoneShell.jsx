import { useEffect, useState } from 'react'
import { useGame, objectiveDone, requestsOf, savedAt } from '../engine/store.js'
import { APPS, knownWindows, phoneApps } from '../apps/registry.jsx'
import PhoneApp from './PhoneApp.jsx'
import Icon from '../icons/Icon.jsx'
import { ChevronLeft, X } from '../icons/line.jsx'

const hhmm = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`

// Taskbar의 시작 메뉴와 같은 확인 문구. 저장/불러오기/새 게임의 의미가
// 폰에서 달라지면 안 되므로 그대로 옮긴다.
const CONFIRM = {
  new: '진행 중인 게임을 버리고 처음부터 시작합니다. 저장한 게임은 그대로 남습니다.',
  load: '저장한 시점으로 되돌아갑니다. 지금까지의 진행 상황은 사라집니다.'
}

// 저장 · 불러오기 · 처음부터. Taskbar(시작 메뉴)에만 있던 세 동작을 폰
// 홈에도 연다 — 폰은 시작 메뉴를 그리지 않으므로 여기가 없으면 세이브가
// 폰에서는 아예 닿지 않는다.
function PhoneMenu() {
  const saveGame = useGame((s) => s.saveGame)
  const loadGame = useGame((s) => s.loadGame)
  const newGame = useGame((s) => s.newGame)
  const [open, setOpen] = useState(false)
  const [asking, setAsking] = useState(null)
  const [saved, setSaved] = useState(null)

  const toggle = () => {
    if (!open) setSaved(savedAt())
    setAsking(null)
    setOpen(!open)
  }

  return (
    <div className="ph-menu">
      <button className="ph-menu-btn" onClick={toggle} aria-label="메뉴">⋯</button>
      {open && (
        <div className="ph-menu-pop">
          {asking ? (
            <>
              <p className="ph-menu-confirm">{CONFIRM[asking]}</p>
              <div className="ph-menu-row">
                <button className="ph-menu-btn-primary"
                        onClick={() => (asking === 'new' ? newGame() : loadGame())}>
                  예
                </button>
                <button className="ph-menu-item" onClick={() => setAsking(null)}>아니오</button>
              </div>
            </>
          ) : (
            <>
              <button className="ph-menu-item"
                      onClick={() => { saveGame(); setSaved(Date.now()); setOpen(false) }}>
                저장
              </button>
              <button className="ph-menu-item" disabled={!saved} onClick={() => setAsking('load')}>
                불러오기
              </button>
              <button className="ph-menu-item" onClick={() => setAsking('new')}>
                처음부터
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// 상태바. 시각은 데스크톱 잠금화면과 같은 소스를 쓴다.
function StatusBar() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="ph-status">
      <span>{hhmm(now)}</span>
      <span className="ph-status-right">
        <span className="ph-signal" aria-hidden="true">▮▮▮</span>
        <span>87%</span>
      </span>
    </div>
  )
}

// 데스크톱의 Progress가 하던 두 가지 — 오늘 몇 건을 풀었는지, 그리고 하루를
// 끝내는 일 — 을 폰에서는 이 한 줄이 한다. closeDay를 부르는 경로가 여기밖에
// 없으므로 이게 없으면 폰에서는 하루가 끝나지 않는다.
function DayBar() {
  const scenario = useGame((s) => s.scenario)
  const day = useGame((s) => s.day)
  const grants = useGame((s) => s.grants)
  const unlocked = useGame((s) => s.unlocked)
  const overtime = useGame((s) => s.overtime)
  const drawn = useGame((s) => s.drawn)
  const ripples = useGame((s) => s.ripples)
  const closing = useGame((s) => s.closing)
  const closeDay = useGame((s) => s.closeDay)

  const list = requestsOf(scenario, day, overtime, drawn, ripples)
  const done = list.filter((o) => objectiveDone(o, { grants, unlocked }))
  const finished = done.length === list.length

  return (
    <div className="ph-day">
      <span className="ph-day-n">
        {day}일차 · <b>{done.length}</b>/{list.length}
        {overtime[day] && <i> · 야근</i>}
      </span>
      {finished && (
        <button className="ph-day-end" onClick={closeDay} disabled={closing}>
          오늘 업무 마치기
        </button>
      )}
      <PhoneMenu />
    </div>
  )
}

function Home() {
  const grants = useGame((s) => s.grants)
  const pushScreen = useGame((s) => s.pushScreen)
  const openWindow = useGame((s) => s.openWindow)
  const apps = phoneApps(grants)

  const open = (a) => {
    // 창 목록은 그대로 쓴다 — 앱이 어떤 파일을 열고 있는지 같은 상태가
    // 거기 있고, 데스크톱과 폰이 같은 저장 파일을 공유하기 때문이다.
    openWindow(a.app, a.props)
    pushScreen('app:' + a.id)
  }

  return (
    <div className="ph-home">
      <div className="ph-grid">
        {apps.map((a) => (
          <button key={a.id} className="ph-icon" onClick={() => open(a)}>
            <span className="ph-glyph"><Icon name={a.icon} size={30} /></span>
            <span className="ph-label">{a.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// 안드로이드의 세 버튼. 켠 창 · 홈 · 뒤로. 어느 화면에서든 바닥에 있으므로
// 앱 안에서도 홈으로 나가는 길이 끊기지 않는다. 홈 인디케이터를 대신한다.
function NavBar({ screens, windows, grants, onRecents, recents }) {
  const goPhoneHome = useGame((s) => s.goPhoneHome)
  const popScreen = useGame((s) => s.popScreen)
  const closeWindow = useGame((s) => s.closeWindow)

  // 뒤로는 팝스테이트가 하던 것과 같아야 한다 — 창 화면을 벗기면 창도 닫는다.
  const back = () => {
    const top = screens[screens.length - 1]
    if (!top) return
    popScreen()
    if (top.startsWith('win:')) closeWindow(Number(top.slice(4)))
  }

  return (
    <nav className="pn-nav">
      <button className={'pn-key' + (recents ? ' on' : '')} onClick={onRecents}
              aria-label="켠 창">
        <span className="pn-recent" />
      </button>
      <button className="pn-key" onClick={() => { if (recents) onRecents(); goPhoneHome() }}
              aria-label="홈">
        <span className="pn-circle" />
      </button>
      <button className="pn-key" onClick={recents ? onRecents : back}
              disabled={!recents && !screens.length} aria-label="뒤로">
        <ChevronLeft size={20} strokeWidth={2.2} />
      </button>
    </nav>
  )
}

// 켠 창 목록. 스택에 쌓인 순서 그대로, 맨 위(지금 보고 있는 것)가 앞에 온다.
function Recents({ screens, windows, grants, onPick, onClose, onDismiss }) {
  const cards = [...screens].reverse().map((key) => {
    if (key.startsWith('win:')) {
      const w = windows.find((x) => x.id === Number(key.slice(4)))
      const cfg = w ? APPS[w.app] : null
      return cfg ? { key, title: cfg.title, icon: cfg.icon } : null
    }
    const entry = phoneApps(grants).find((a) => 'app:' + a.id === key)
    return entry ? { key, title: entry.title, icon: entry.icon } : null
  }).filter(Boolean)

  return (
    <div className="pn-recents" onPointerDown={onDismiss}>
      {cards.length === 0 && <div className="pn-recents-none">켠 창이 없습니다</div>}
      <div className="pn-cards" onPointerDown={(e) => e.stopPropagation()}>
        {cards.map((c) => (
          <div key={c.key} className="pn-card">
            <button className="pn-card-x" onClick={() => onClose(c.key)} aria-label="닫기">
              <X size={13} strokeWidth={2.4} />
            </button>
            <button className="pn-card-face" onClick={() => onPick(c.key)}>
              <Icon name={c.icon} size={30} />
              <span>{c.title}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PhoneShell() {
  const screens = useGame((s) => s.screens)
  const grants = useGame((s) => s.grants)
  const currentApp = useGame((s) => s.currentApp)
  const popScreen = useGame((s) => s.popScreen)
  const pushScreen = useGame((s) => s.pushScreen)
  const goPhoneHome = useGame((s) => s.goPhoneHome)
  const closeWindow = useGame((s) => s.closeWindow)
  const goScreen = useGame((s) => s.goScreen)
  const dropScreen = useGame((s) => s.dropScreen)
  const [recents, setRecents] = useState(false)
  const windows = useGame((s) => s.windows)

  // 안드로이드의 뒤로가기 제스처는 그대로 두면 게임을 나가버린다. 한 겹
  // 밀어두고 가로채서 화면 스택을 벗긴다. 홈에서 한 번 더 누르면 그때
  // 브라우저 기본 동작이 먹힌다.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPop = () => {
      const s = useGame.getState()
      if (!s.screens.length) return          // 홈이면 진짜로 나간다
      const top = s.screens[s.screens.length - 1]
      s.popScreen()
      // 창 화면을 벗길 땐 창도 닫는다 — 안 닫으면 다음 렌더에서 같은
      // 창이 '새로 생긴 창'으로 보여 자동으로 다시 밀려 들어온다.
      if (top?.startsWith('win:')) s.closeWindow(Number(top.slice(4)))
      window.history.pushState(null, '')     // 다음 뒤로가기를 위해 다시 깐다
    }
    window.history.pushState(null, '')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // 탐색기·메일 첨부·브라우저 다운로드가 모두 openWindow(app, {fileId})로
  // 문서를 연다 — 데스크톱에서는 그게 새 창이지만, 폰은 창을 그리지
  // 않으므로 화면 스택에 올려주지 않으면 아무 일도 일어나지 않는다.
  //
  // 홈 앱(사진·파일·AR톡 …)이 여는 창은 뺀다 — 그건 Home.open이 이미
  // 'app:<id>' 화면으로 밀어둔다. 그 창까지 또 밀면 같은 앱이 화면
  // 두 겹으로 쌓여 뒤로가기가 한 번 헛돈다.
  // 새로 생긴 문서 창(스택에 아직 없는 것)만 민다 — 이미 올라온 창을
  // 다시 밀면 그 자리에서 무한히 반복된다.
  useEffect(() => {
    const homeKeys = new Set(
      phoneApps(grants).map((a) => a.app + JSON.stringify(a.props ?? {}))
    )
    for (const w of knownWindows(windows)) {
      if (homeKeys.has(w.key)) continue
      const k = 'win:' + w.id
      if (!screens.includes(k)) pushScreen(k)
    }
  }, [windows, screens, pushScreen, grants])

  const top = screens[screens.length - 1]
  const winId = top?.startsWith('win:') ? Number(top.slice(4)) : null
  const openWin = winId != null ? windows.find((w) => w.id === winId) : null
  const winCfg = openWin ? APPS[openWin.app] : null

  // 창 화면에서 뒤로가면 그 창도 닫는다 — 안 닫으면 스택에서는 빠졌는데
  // windows에는 남아 있어, 위 effect가 같은 화면을 바로 다시 민다.
  const backFromWindow = () => {
    popScreen()
    closeWindow(winId)
  }

  const id = currentApp()
  const entry = !winCfg && id ? phoneApps(grants).find((a) => a.id === id) : null
  const cfg = entry ? APPS[entry.app] : null
  // 창은 app이 아니라 app+props로 갈린다(store의 openWindow와 같은 키).
  // 사진·파일·내 PC 드라이브가 모두 explorer라, app만 보면 셋 중 엉뚱한
  // 창을 집는다.
  const key = entry ? entry.app + JSON.stringify(entry.props ?? {}) : null
  const win = cfg ? windows.find((w) => w.key === key) : null

  return (
    <div className="phone">
      <StatusBar />
      {!entry && !winCfg && (
        <>
          <DayBar />
          <Home />
        </>
      )}
      {winCfg && (
        <PhoneApp title={winCfg.title} icon={winCfg.icon} onBack={backFromWindow}>
          <winCfg.comp {...(openWin.props ?? {})} winId={openWin.id} />
        </PhoneApp>
      )}
      {!winCfg && entry && cfg && (
        <PhoneApp title={entry.title} icon={entry.icon}
                  onBack={screens.length > 1 ? popScreen : goPhoneHome}>
          <cfg.comp {...(entry.props ?? {})} winId={win?.id} />
        </PhoneApp>
      )}
      {recents && (
        <Recents screens={screens} windows={windows} grants={grants}
                 onPick={(k) => { goScreen(k); setRecents(false) }}
                 onClose={dropScreen}
                 onDismiss={() => setRecents(false)} />
      )}
      <NavBar screens={screens} windows={windows} grants={grants}
              recents={recents} onRecents={() => setRecents((v) => !v)} />
    </div>
  )
}
