import { useState } from 'react'
import { useGame, objectiveDone, requestsOf } from '../engine/store.js'
import { Check, ChevronDown } from '../icons/line.jsx'

export default function Progress() {
  const scenario = useGame((s) => s.scenario)
  const day = useGame((s) => s.day)
  const grants = useGame((s) => s.grants)
  const unlocked = useGame((s) => s.unlocked)
  const overtime = useGame((s) => s.overtime)
  const drawn = useGame((s) => s.drawn)
  const [open, setOpen] = useState(false)

  const state = { grants, unlocked }
  const list = requestsOf(scenario, day, overtime, drawn)
  const done = list.filter((o) => objectiveDone(o, state))
  const today = scenario.days[day - 1]

  return (
    <div className="pg">
      <button className="pg-badge" onClick={() => setOpen(!open)}
              title="해결한 항목 보기">
        {day}일차 · 해결됨 <b>{done.length}</b> / {list.length}
        <ChevronDown size={13} strokeWidth={2.4}
                     style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <ul className="pg-list">
          <li className="pg-date">{today.date} · {today.label}{overtime[day] && ' · 야근'}</li>
          {list.map((o) => {
            const ok = objectiveDone(o, state)
            return (
              <li key={o.id} className={ok ? 'ok' : ''}>
                <span className="pg-mark">{ok && <Check size={12} strokeWidth={3} />}</span>
                {o.title}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
