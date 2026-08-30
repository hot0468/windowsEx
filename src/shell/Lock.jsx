import { useEffect, useState } from 'react'
import { gameClock, useGame } from '../engine/store.js'
import { play } from './sound.js'
import { Lock as LockIcon, ChevronUp } from '../icons/line.jsx'
import { useViewport } from './useViewport.js'


// Windows' lock screen: the clock, who is signed in, and a password box. The
// hint is on the screen itself so a locked-out player is never stuck.
export default function Lock() {
  const scenario = useGame((s) => s.scenario)
  const day = useGame((s) => s.day)
  const overtime = useGame((s) => s.overtime)
  const dayAt = useGame((s) => s.dayAt)
  const clock = gameClock(scenario, { day, overtime, dayAt })
  const unlock = useGame((s) => s.unlock)
  const [pw, setPw] = useState('')
  const [missed, setMissed] = useState(false)
  const [, setTick] = useState(0)
  // 폰의 잠금은 두 겹이다: 시계가 있는 화면, 그리고 밀어 올렸을 때 나오는
  // 비밀번호. PC 는 예전처럼 한 화면에 둘 다 있다.
  const phone = useViewport() === 'phone'
  const [asking, setAsking] = useState(false)
  const [grab, setGrab] = useState(null)

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 10000)
    return () => clearInterval(t)
  }, [])

  const submit = () => {
    if (pw === scenario.lock.password) return unlock()
    play('error')
    setMissed(true)
    setPw('')
  }

  const card = (
    <div className="lock-card">
      <div className="lock-face"><LockIcon size={30} strokeWidth={1.6} /></div>
      <div className="lock-name">{scenario.player.name}</div>
      <input type="password" value={pw} autoFocus placeholder="비밀번호" aria-label="비밀번호"
             onChange={(e) => setPw(e.target.value)}
             onKeyDown={(e) => e.key === 'Enter' && submit()} />
      {missed && (
        <div className="lock-err">
          비밀번호가 올바르지 않습니다.
          <span>비밀번호 힌트: {scenario.lock.hint}</span>
        </div>
      )}
    </div>
  )

  const clockFace = (
    <div className="lock-clock">
      <div className="lock-time">{clock.time}</div>
      <div className="lock-date">{scenario.days[day - 1]?.date}</div>
    </div>
  )

  if (phone) {
    return (
      <div className={'lock lock-phone' + (asking ? ' on' : '')}
           onPointerDown={(e) => setGrab(e.clientY)}
           onPointerMove={(e) => {
             if (grab == null) return
             const dy = e.clientY - grab
             if (!asking && dy < -40) { setGrab(null); setAsking(true) }
             // 내리면 시계 화면으로 돌아간다 — 올린 것을 되돌리는 같은 손짓.
             if (asking && dy > 60) { setGrab(null); setAsking(false) }
           }}
           onPointerUp={(e) => {
             // 짧게 밀어 올린 것도, 그냥 톡 누른 것도 잠금을 연다 —
             // 마우스로 보는 경우에는 미는 손짓이 아예 없다.
             if (grab != null && !asking) setAsking(true)
             setGrab(null)
           }}
           onPointerCancel={() => setGrab(null)}>
        {clockFace}
        {asking ? card : (
          <div className="lock-swipe">
            <ChevronUp size={20} strokeWidth={2} />
            <span>화면을 미세요</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="lock">
      {clockFace}
      {card}
    </div>
  )
}
