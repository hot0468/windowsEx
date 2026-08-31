import { useEffect, useRef, useState } from 'react'
import { gameClock, useGame, objectiveDone, requestsOf } from '../engine/store.js'
import { APPS, knownWindows, phoneApps } from '../apps/registry.jsx'
import PhoneApp from './PhoneApp.jsx'
import PhoneShade from './PhoneShade.jsx'
import Icon from '../icons/Icon.jsx'
import { ChevronLeft, X } from '../icons/line.jsx'
import { pullDir } from './useViewport.js'


// Taskbar의 시작 메뉴와 같은 확인 문구. 저장/불러오기/새 게임의 의미가
// 폰에서 달라지면 안 되므로 그대로 옮긴다.

// 저장 · 불러오기 · 처음부터. Taskbar(시작 메뉴)에만 있던 세 동작을 폰
// 홈에도 연다 — 폰은 시작 메뉴를 그리지 않으므로 여기가 없으면 세이브가
// 폰에서는 아예 닿지 않는다.

// 상태바. 시각은 데스크톱 잠금화면과 같은 소스를 쓴다.
function StatusBar() {
  const [, setTick] = useState(0)
  const scenario = useGame((s) => s.scenario)
  const day = useGame((s) => s.day)
  const overtime = useGame((s) => s.overtime)
  const dayAt = useGame((s) => s.dayAt)
  const clock = gameClock(scenario, { day, overtime, dayAt })
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 10000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="ph-status">
      <span>{clock.time}</span>
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
  const awaiting = useGame((s) => Boolean(s.awaitingCaller))
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
        <button className="ph-day-end" onClick={closeDay} disabled={closing || awaiting}>
          오늘 업무 마치기
        </button>
      )}
    </div>
  )
}

// 바탕에 남는 셋. 하루에 몇 번이고 여는 것들이라 서랍에 넣지 않는다.
const DOCK = ['dial', 'messenger', 'browser']

function AppIcon({ app, onOpen }) {
  return (
    <button className="ph-icon" onClick={() => onOpen(app)}>
      <span className="ph-glyph"><Icon name={app.icon} size={46} /></span>
      <span className="ph-label">{app.title}</span>
    </button>
  )
}

// 홈. 바탕에는 독 셋만 서고 나머지는 서랍에 있다 — 아래에서 위로 밀면 열린다.
function Home({ drawer, onDrawer }) {
  const grants = useGame((s) => s.grants)
  const pushScreen = useGame((s) => s.pushScreen)
  const openWindow = useGame((s) => s.openWindow)
  const grab = useRef(null)
  // 격자가 화면을 넘치는가. 넘칠 때만 스크롤이 되고, 그때는 아래로 미는
  // 손짓을 브라우저가 가져간다.
  const grid = useRef(null)
  const [overflows, setOverflows] = useState(false)
  const apps = phoneApps(grants)
  const dock = DOCK.map((id) => apps.find((a) => a.id === id)).filter(Boolean)
  const rest = apps.filter((a) => !DOCK.includes(a.id))

  useEffect(() => {
    const el = grid.current
    setOverflows(Boolean(el) && el.scrollHeight > el.clientHeight + 1)
  }, [drawer, apps.length])

  const open = (a) => {
    // 창 목록은 그대로 쓴다 — 앱이 어떤 파일을 열고 있는지 같은 상태가
    // 거기 있고, 데스크톱과 폰이 같은 저장 파일을 공유하기 때문이다.
    openWindow(a.app, a.props)
    pushScreen('app:' + a.id)
    // 서랍은 닫지 않는다 — 서랍에서 연 앱을 뒤로가기로 나오면 서랍이 그대로
    // 있어야 다음 앱을 이어서 연다. 홈 버튼은 서랍까지 걷는다.
  }

  // 서랍은 밀어서 열고 밀어서 닫는다. 시작한 곳을 ref 에 적어 둔다 — state 로
  // 두면 같은 프레임 안의 onPointerMove 가 아직 갱신 전 값을 읽어 첫 손짓이
  // 통째로 무시된다.
  const swipe = (open_) => ({
    onPointerDown: (e) => { grab.current = { y: e.clientY, x: e.clientX } },
    onPointerMove: (e) => {
      const g = grab.current
      if (!g) return
      const dir = pullDir({ dy: e.clientY - g.y, dx: e.clientX - g.x })
      if (dir === -1 && open_) { grab.current = null; onDrawer(true) }
      if (dir === 1 && !open_) { grab.current = null; onDrawer(false) }
    },
    onPointerUp: () => { grab.current = null },
    onPointerCancel: () => { grab.current = null }
  })

  return (
    <div className="ph-home" {...swipe(true)}>
      <div className="ph-dock">
        {dock.map((a) => <AppIcon key={a.id} app={a} onOpen={open} />)}
      </div>
      <button className="ph-drawer-grip" onClick={() => onDrawer(true)} aria-label="앱 서랍 열기">
        <i />
      </button>

      {drawer && (
        <div className="ph-drawer" {...swipe(false)}>
          <button className="ph-drawer-grip on" onClick={() => onDrawer(false)} aria-label="앱 서랍 닫기">
            <i />
          </button>
          {/* 아이콘이 한 화면에 다 들어오면 스크롤할 것이 없다. 그때는 격자
              위에서 아래로 미는 손짓이 서랍을 닫는다. 넘칠 때만 스크롤로
              돌려준다 — 목록을 훑는 중에 서랍이 닫히면 성가시다. */}
          <div className={'ph-grid' + (overflows ? ' scrolls' : '')} ref={grid}>
            {rest.map((a) => <AppIcon key={a.id} app={a} onOpen={open} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// 안드로이드의 세 버튼. 켠 창 · 홈 · 뒤로. 어느 화면에서든 바닥에 있으므로
// 앱 안에서도 홈으로 나가는 길이 끊기지 않는다. 홈 인디케이터를 대신한다.
function NavBar({ screens, windows, grants, onRecents, recents, shade, onShade, drawer, onDrawer }) {
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
      <button className="pn-key" onClick={() => { if (recents) onRecents(); if (shade) onShade(); onDrawer(false); goPhoneHome() }}
              aria-label="홈">
        <span className="pn-circle" />
      </button>
      {/* 알림창이 내려와 있으면 뒤로는 그것부터 걷는다 — 안드로이드와 같다. */}
      <button className="pn-key"
              onClick={recents ? onRecents : shade ? onShade
                : drawer && !screens.length ? () => onDrawer(false) : back}
              disabled={!recents && !shade && !(drawer && !screens.length) && !screens.length}
              aria-label="뒤로">
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
      <div className="pn-tasks" onPointerDown={(e) => e.stopPropagation()}>
        {cards.map((c) => (
          <div key={c.key} className="pn-task">
            <button className="pn-task-x" onClick={() => onClose(c.key)} aria-label="닫기">
              <X size={13} strokeWidth={2.4} />
            </button>
            <button className="pn-task-face" onClick={() => onPick(c.key)}>
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
  const sealed = useGame((s) => s.sealed)
  const grants = useGame((s) => s.grants)
  const currentApp = useGame((s) => s.currentApp)
  const popScreen = useGame((s) => s.popScreen)
  const pushScreen = useGame((s) => s.pushScreen)
  const goPhoneHome = useGame((s) => s.goPhoneHome)
  const closeWindow = useGame((s) => s.closeWindow)
  const goScreen = useGame((s) => s.goScreen)
  const dropScreen = useGame((s) => s.dropScreen)
  const [recents, setRecents] = useState(false)
  // 상단에서 끌어내리는 알림창. 누르는 곳(pointerdown)의 y와 비교해 아래로
  // 끌면 열고, 그냥 톡 누르면(마우스로 보는 경우) 그것도 연다.
  const [shade, setShade] = useState(false)
  // 앱 서랍. 홈에서 아래에서 위로 밀면 열린다.
  const [drawer, setDrawer] = useState(false)
  // 뒤로가기 처리기는 한 번만 붙으므로 그때의 상태를 기억하지 못한다 —
  // 지금 값을 읽을 수 있게 거울 하나를 둔다.
  const drawerRef = useRef(false)
  drawerRef.current = drawer
  // 닫힐 때는 올라가는 동안 한 겹 더 산다. 내려올 땐 CSS 애니메이션 하나면
  // 되지만, 사라지는 쪽은 지우기 전에 기다려 줘야 보인다.
  const [lifting, setLifting] = useState(false)
  const grab = useRef(null)
  const closeShade = () => {
    setLifting(true)
    setTimeout(() => { setShade(false); setLifting(false) }, 200)
  }
  const windows = useGame((s) => s.windows)

  // 안드로이드의 뒤로가기 제스처는 그대로 두면 게임을 나가버린다. 한 겹
  // 밀어두고 가로채서 화면 스택을 벗긴다. 홈에서 한 번 더 누르면 그때
  // 브라우저 기본 동작이 먹힌다.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPop = () => {
      const s = useGame.getState()
      // 통화 중에는 뒤로가기도 막는다 — 화면은 통화가 덮고 있는데 그 뒤에서
      // 스택만 벗겨지면, 끊고 나왔을 때 엉뚱한 자리에 서 있게 된다.
      if (s.call) { window.history.pushState(null, ''); return }
      // 홈인데 서랍이 열려 있으면 서랍부터 걷는다 — 아직 나갈 자리가 아니다.
      if (!s.screens.length && drawerRef.current) {
        drawerRef.current = false
        setDrawer(false)
        window.history.pushState(null, '')
        return
      }
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
    <div className={'phone' + (sealed ? ' sealed' : '')}>
      {/* 상태바를 끌어내리면 설정창이 열린다. 서랍과 같은 판별을 쓴다 —
          화면마다 기준이 다르면 어떤 데서는 되고 어떤 데서는 안 된다. */}
      <div className="ph-drag"
           onPointerDown={(e) => { if (!shade) grab.current = { y: e.clientY, x: e.clientX } }}
           onPointerMove={(e) => {
             const g = grab.current
             if (!g) return
             if (pullDir({ dy: e.clientY - g.y, dx: e.clientX - g.x }, 24) === 1) {
               grab.current = null
               setShade(true)
             }
           }}
           onPointerUp={() => { grab.current = null }}
           onPointerCancel={() => { grab.current = null }}>
        <StatusBar />
      </div>
      {!entry && !winCfg && (
        <>
          <DayBar />
          <Home drawer={drawer} onDrawer={setDrawer} />
        </>
      )}
      {winCfg && (
        <PhoneApp onBack={backFromWindow}>
          <winCfg.comp {...(openWin.props ?? {})} winId={openWin.id} />
        </PhoneApp>
      )}
      {!winCfg && entry && cfg && (
        <PhoneApp onBack={screens.length > 1 ? popScreen : goPhoneHome}>
          <cfg.comp {...(entry.props ?? {})} winId={win?.id} />
        </PhoneApp>
      )}
      {shade && !sealed && <PhoneShade lifting={lifting} onClose={closeShade} />}
      {recents && (
        <Recents screens={screens} windows={windows} grants={grants}
                 onPick={(k) => { goScreen(k); setRecents(false) }}
                 onClose={dropScreen}
                 onDismiss={() => setRecents(false)} />
      )}
      {/* 굳은 뒤에는 돌아갈 곳도 켤 것도 없다 — 그 페이지 하나만 남는다. */}
      {!sealed && (
        <NavBar screens={screens} windows={windows} grants={grants}
                recents={recents} onRecents={() => setRecents((v) => !v)}
                shade={shade} onShade={closeShade}
                drawer={drawer} onDrawer={setDrawer} />
      )}
    </div>
  )
}
