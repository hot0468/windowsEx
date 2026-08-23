import { useEffect, useState } from 'react'
import { useGame } from '../engine/store.js'

// A convincing enough stop screen: it counts up, then the machine restarts.
export default function Crash() {
  const bsod = useGame((s) => s.scenario.malware.bsod)
  const reboot = useGame((s) => s.reboot)
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const tick = setInterval(() => setPct((p) => Math.min(100, p + 4)), 90)
    const done = setTimeout(reboot, 2600)
    return () => { clearInterval(tick); clearTimeout(done) }
  }, [reboot])

  return (
    <div className="bsod">
      <div className="bsod-inner">
        <div className="bsod-face">{bsod.face}</div>
        <h1>{bsod.title}</h1>
        <p>{bsod.sub}</p>
        <p className="bsod-pct">{pct}% 완료</p>
        <p className="bsod-code">{bsod.code}</p>
      </div>
    </div>
  )
}
