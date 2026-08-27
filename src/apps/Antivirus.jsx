import { useEffect, useState } from 'react'
import { useGame } from '../engine/store.js'

const STEP_MS = 520

// A full scan walks the folder list, then reports what it found. What it finds
// depends on whether the machine actually has anything on it.
export default function Antivirus() {
  const av = useGame((s) => s.scenario.antivirus)
  const infected = useGame((s) => Boolean(s.grants.anysign) && !s.cleaned)
  const cleaned = useGame((s) => s.cleaned)
  const cleanPc = useGame((s) => s.cleanPc)
  const [at, setAt] = useState(-1)
  const [done, setDone] = useState(false)

  const scanning = at >= 0 && at < av.targets.length

  useEffect(() => {
    if (!scanning) return
    const t = setTimeout(() => setAt((n) => n + 1), STEP_MS)
    return () => clearTimeout(t)
  }, [at, scanning])

  useEffect(() => {
    if (at === av.targets.length) setDone(true)
  }, [at])

  const scan = () => { setDone(false); setAt(0) }
  const found = done && infected

  return (
    <div className="av">
      <div className="av-top">
        <span className="av-logo">{av.name}</span>
        <span className="av-ver">{av.version}</span>
      </div>

      <div className={'av-shield' + (found ? ' bad' : done ? ' ok' : '')}>
        {found ? '!' : done ? '✓' : '🛡'}
      </div>

      {!scanning && !done && <p className="av-idle">{av.idle}</p>}

      {scanning && (
        <div className="av-scan">
          <p className="av-scanning">{av.scanning}</p>
          <div className="av-bar"><i style={{ width: `${(at / av.targets.length) * 100}%` }} /></div>
          <p className="av-target">{av.targets[at]}</p>
        </div>
      )}

      {found && (
        <div className="av-found">
          <h2>{av.found.title}</h2>
          <div className="av-item">
            <b>{av.found.name}</b>
            <span>{av.found.path}</span>
          </div>
          <p className="av-note">{av.found.note}</p>
          <button className="btn-primary" onClick={cleanPc}>{av.found.button}</button>
        </div>
      )}

      {done && !infected && (
        <div className="av-found">
          <h2>{(cleaned ? av.clean : av.nothing).title}</h2>
          {(cleaned ? av.clean : av.nothing).lines.map((line) => <p key={line} className="av-note">{line}</p>)}
          {/* Nothing was wrong with it. The scanner just could not say what it was. */}
          {av.unclassified && (
            <div className="av-item av-odd">
              <b>{av.unclassified.line}</b>
              <span>{av.unclassified.path}</span>
              <p className="av-note">{av.unclassified.note}</p>
            </div>
          )}
        </div>
      )}

      {!scanning && (
        <button className="av-btn" onClick={scan}>{done ? '다시 검사' : '전체 검사 시작'}</button>
      )}
    </div>
  )
}
