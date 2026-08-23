import { useState } from 'react'
import { useGame, objectiveDone } from '../engine/store.js'
import { Check, ChevronDown } from '../icons/line.jsx'

export default function Progress() {
  const list = useGame((s) => s.scenario.objectives)
  const grants = useGame((s) => s.grants)
  const unlocked = useGame((s) => s.unlocked)
  const cleared = useGame((s) => s.cleared)
  const [open, setOpen] = useState(false)

  const state = { grants, unlocked, cleared }
  const done = list.filter((o) => objectiveDone(o, state))

  return (
    <div className="pg">
      <button className="pg-badge" onClick={() => setOpen(!open)}
              title="해결한 항목 보기">
        해결됨 <b>{done.length}</b> / {list.length}
        <ChevronDown size={13} strokeWidth={2.4}
                     style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <ul className="pg-list">
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
