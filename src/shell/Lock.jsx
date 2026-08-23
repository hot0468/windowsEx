import { useEffect, useState } from 'react'
import { useGame } from '../engine/store.js'
import { play } from './sound.js'
import { Lock as LockIcon } from '../icons/line.jsx'

const hhmm = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`

// Windows' lock screen: the clock, who is signed in, and a password box. The
// hint is on the screen itself so a locked-out player is never stuck.
export default function Lock() {
  const scenario = useGame((s) => s.scenario)
  const day = useGame((s) => s.day)
  const unlock = useGame((s) => s.unlock)
  const [pw, setPw] = useState('')
  const [missed, setMissed] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(t)
  }, [])

  const submit = () => {
    if (pw === scenario.lock.password) return unlock()
    play('error')
    setMissed(true)
    setPw('')
  }

  return (
    <div className="lock">
      <div className="lock-clock">
        <div className="lock-time">{hhmm(now)}</div>
        <div className="lock-date">{scenario.days[day - 1]?.date}</div>
      </div>
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
    </div>
  )
}
