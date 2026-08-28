import { useEffect, useState } from 'react'
import { useGame, objectiveDone, requestsOf } from '../engine/store.js'
import { APPS, phoneApps } from '../apps/registry.jsx'
import PhoneApp from './PhoneApp.jsx'
import Icon from '../icons/Icon.jsx'

const hhmm = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`

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

export default function PhoneShell() {
  const screens = useGame((s) => s.screens)
  const grants = useGame((s) => s.grants)
  const currentApp = useGame((s) => s.currentApp)
  const popScreen = useGame((s) => s.popScreen)
  const goPhoneHome = useGame((s) => s.goPhoneHome)
  const windows = useGame((s) => s.windows)

  // 안드로이드의 뒤로가기 제스처는 그대로 두면 게임을 나가버린다. 한 겹
  // 밀어두고 가로채서 화면 스택을 벗긴다. 홈에서 한 번 더 누르면 그때
  // 브라우저 기본 동작이 먹힌다.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPop = () => {
      const s = useGame.getState()
      if (!s.screens.length) return          // 홈이면 진짜로 나간다
      s.popScreen()
      window.history.pushState(null, '')     // 다음 뒤로가기를 위해 다시 깐다
    }
    window.history.pushState(null, '')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const id = currentApp()
  const entry = id ? phoneApps(grants).find((a) => a.id === id) : null
  const cfg = entry ? APPS[entry.app] : null
  // 창은 app이 아니라 app+props로 갈린다(store의 openWindow와 같은 키).
  // 사진·파일·내 PC 드라이브가 모두 explorer라, app만 보면 셋 중 엉뚱한
  // 창을 집는다.
  const key = entry ? entry.app + JSON.stringify(entry.props ?? {}) : null
  const win = cfg ? windows.find((w) => w.key === key) : null

  return (
    <div className="phone">
      <StatusBar />
      {!entry && (
        <>
          <DayBar />
          <Home />
          <div className="pa-home" aria-hidden="true"><span className="pa-bar" /></div>
        </>
      )}
      {entry && cfg && (
        <PhoneApp title={entry.title} icon={entry.icon}
                  onBack={screens.length > 1 ? popScreen : goPhoneHome}>
          <cfg.comp {...(entry.props ?? {})} winId={win?.id} />
        </PhoneApp>
      )}
    </div>
  )
}
