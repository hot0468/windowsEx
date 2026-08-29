import { useEffect, useState } from 'react'
import { gameClock, opensAnew, useGame, savedAt } from '../engine/store.js'
import { APPS, knownWindows, startMenuApps } from '../apps/registry.jsx'
import Icon from '../icons/Icon.jsx'
import { FolderOpen, LayoutGrid, Lock, RotateCcw, Save, Volume, VolumeOff } from '../icons/line.jsx'
import { isMuted, play, setMuted } from './sound.js'

const when = (at) =>
  new Date(at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const CONFIRM = {
  new: '진행 중인 게임을 버리고 처음부터 시작합니다. 저장한 게임은 그대로 남습니다.',
  load: '저장한 시점으로 되돌아갑니다. 지금까지의 진행 상황은 사라집니다.'
}

export default function Taskbar() {
  const windows = useGame((s) => s.windows)
  const nextZ = useGame((s) => s.nextZ)
  const openWindow = useGame((s) => s.openWindow)
  const focusWindow = useGame((s) => s.focusWindow)
  const minimizeWindow = useGame((s) => s.minimizeWindow)
  const saveGame = useGame((s) => s.saveGame)
  const loadGame = useGame((s) => s.loadGame)
  const newGame = useGame((s) => s.newGame)
  const lock = useGame((s) => s.lock)
  const grants = useGame((s) => s.grants)
  const [startOpen, setStartOpen] = useState(false)
  const [asking, setAsking] = useState(null)
  const [saved, setSaved] = useState(null)
  const [tick, setTick] = useState(0)
  const scenario = useGame((s) => s.scenario)
  const day = useGame((s) => s.day)
  const overtime = useGame((s) => s.overtime)
  const dayAt = useGame((s) => s.dayAt)
  // 실제 시계가 아니라 게임 안의 시각. tick 은 다시 그리기 위한 것뿐이다.
  const clock = gameClock(scenario, { day, overtime, dayAt })
  const [quiet, setQuiet] = useState(isMuted())

  const toggleStart = () => {
    if (!startOpen) setSaved(savedAt())
    setAsking(null)
    setStartOpen(!startOpen)
  }

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30000)
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
            {startMenuApps(grants).map(([key, a]) => (
              <button key={key} className="sm-app"
                      onClick={() => { openWindow(key, {}, opensAnew(key)); setStartOpen(false) }}>
                <div className="glyph"><Icon name={a.icon} size={30} /></div>{a.title}
              </button>
            ))}
          </div>

          <h3 className="sm-h2">게임</h3>
          {asking ? (
            <div className="sm-confirm">
              <p>{CONFIRM[asking]}</p>
              <div className="sm-confirm-row">
                <button className="btn-primary" onClick={() => (asking === 'new' ? newGame() : loadGame())}>
                  예
                </button>
                <button className="sm-cancel" onClick={() => setAsking(null)}>아니오</button>
              </div>
            </div>
          ) : (
            <div className="sm-list">
              <button className="sm-item" onClick={() => { setStartOpen(false); lock() }}>
                <Lock size={16} strokeWidth={1.8} />잠금
                <span className="sm-when">Ctrl+Alt+L</span>
              </button>
              <button className="sm-item" onClick={() => setAsking('new')}>
                <RotateCcw size={16} strokeWidth={1.8} />새 게임
              </button>
              <button className="sm-item"
                      onClick={() => { saveGame(); setSaved(Date.now()); setStartOpen(false) }}>
                <Save size={16} strokeWidth={1.8} />저장
              </button>
              <button className="sm-item" disabled={!saved} onClick={() => setAsking('load')}>
                <FolderOpen size={16} strokeWidth={1.8} />불러오기
                <span className="sm-when">{saved ? when(saved) : '저장된 게임 없음'}</span>
              </button>
            </div>
          )}
        </div>
      )}
      <div className="taskbar">
        <div className="tb-center">
          <button className="tb-icon" title="시작" onClick={toggleStart}>
            <LayoutGrid size={19} strokeWidth={1.8} />
          </button>
          {knownWindows(windows).map((w) => (
            <button key={w.id} className="tb-icon" title={APPS[w.app].title}
                    onClick={() => clickWindow(w)}>
              <Icon name={APPS[w.app].icon} size={23} />
              <span className="dot" />
            </button>
          ))}
        </div>
        <button className="tb-tray" title={quiet ? '소리 켜기' : '소리 끄기'}
                onClick={() => { setMuted(!quiet); setQuiet(!quiet); if (quiet) play('click') }}>
          {quiet ? <VolumeOff size={16} strokeWidth={1.8} /> : <Volume size={16} strokeWidth={1.8} />}
        </button>
        <div className="tb-clock">
          {clock.time}<br />
          {clock.date}
        </div>
      </div>
    </>
  )
}
