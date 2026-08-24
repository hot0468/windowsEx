import { useEffect, useState } from 'react'
import { useGame } from '../engine/store.js'

// A directory listing that should not resolve. Reading the log at the bottom of
// it is the last thing the player does — nothing on this page goes back.
export default function Floor8({ site }) {
  const f = site.floor8
  const enterFloor8 = useGame((s) => s.enterFloor8)
  const [step, setStep] = useState(0)
  const [tick, setTick] = useState(0)

  // the page keeps writing while it is open
  useEffect(() => {
    if (step < 2) return
    const t = setInterval(() => setTick((n) => n + 1), 1800)
    return () => clearInterval(t)
  }, [step])

  const open = () => setStep(1)
  const read = () => {
    setStep(2)
    enterFloor8()
  }

  return (
    <div className="f8">
      <pre className="f8-head">{f.header}</pre>
      <pre className="f8-body">{f.lines.join('\n')}</pre>

      {step === 0 && <button className="f8-link" onClick={open}>{f.open}</button>}

      {step >= 1 && (
        <>
          <pre className="f8-body">{f.opened.join('\n')}</pre>
          {step === 1 && <button className="f8-link" onClick={read}>{f.read}</button>}
        </>
      )}

      {step >= 2 && (
        <>
          <pre className="f8-log">{f.log.join('\n')}</pre>
          <p className="f8-last" key={tick}>{f.last}</p>
        </>
      )}
    </div>
  )
}
