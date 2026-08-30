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
  const ripples = useGame((s) => s.ripples)
  const closing = useGame((s) => s.closing)
  const awaiting = useGame((s) => Boolean(s.awaitingCaller))
  const closeDay = useGame((s) => s.closeDay)
  const [open, setOpen] = useState(false)

  const state = { grants, unlocked }
  const list = requestsOf(scenario, day, overtime, drawn, ripples)
  const done = list.filter((o) => objectiveDone(o, state))
  const today = scenario.days[day - 1]
  const finished = done.length === list.length

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
      {/* 비활성 버튼은 브라우저에 따라 툴팁을 안 띄운다 — 감싸는 칸이 대신 말한다. */}
      <span className="pg-close-wrap"
            title={awaiting ? '읽지 않은 메시지를 확인하고 대화를 닫으면 하루가 끝납니다'
              : finished ? undefined : '업무 목록의 업무를 모두 해결하면 다음 날로 넘어갈 수 있습니다'}>
        <button className="pg-close" onClick={closeDay} disabled={!finished || closing || awaiting}>
          오늘 업무 마치기
        </button>
      </span>
    </div>
  )
}
