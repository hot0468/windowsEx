import { useGame } from '../engine/store.js'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

// The player's own month, the way a web calendar shows it: weekday columns, one
// cell per day, events pinned to their day. Today comes from the day in play.
export default function Calendar({ site }) {
  const day = useGame((s) => s.day)
  const me = useGame((s) => s.scenario.player.name)
  const today = +(useGame((s) => s.scenario.days[day - 1]?.date ?? '').match(/(\d+)일/)?.[1] ?? 0)
  const c = site.calendar
  const cells = [...Array(c.firstWeekday).fill(null), ...Array.from({ length: c.days }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  const eventsOn = (d) => c.events.filter((e) => e.day === d)

  return (
    <div className="cal">
      <div className="cal-top">
        <span className="cal-logo">다온 캘린더</span>
        <span className="cal-month">{c.year}년 {c.month}월</span>
        <span className="cal-who">{me}님의 캘린더</span>
      </div>
      <div className="cal-grid">
        {WEEK.map((w, i) => <div key={w} className={'cal-wd' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '')}>{w}</div>)}
        {cells.map((d, i) => (
          <div key={i} className={'cal-cell' + (d === null ? ' empty' : '') + (d === today ? ' today' : '')}>
            {d !== null && <span className={'cal-day' + (i % 7 === 0 ? ' sun' : i % 7 === 6 ? ' sat' : '')}>{d}</span>}
            {d !== null && eventsOn(d).map((e, j) => (
              <span key={j} className="cal-ev">{e.time && <b>{e.time}</b>}{e.title}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
