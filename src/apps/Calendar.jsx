import { useGame } from '../engine/store.js'
import { useViewport } from '../shell/useViewport.js'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

// 폰에서 볼 일정 목록. 격자 대신 날짜 순으로 세운다 — 390px 에서 7열
// 격자는 한 칸이 55px 라 제목이 들어가지 않고, 날짜만 보이는 달력은
// 무슨 일이 있는지 알려 주지 못한다.
//
// 일정이 있는 날만 나온다. 빈 날까지 세우면 스크롤만 길어진다.
export function agendaOf(c, today = 0) {
  const byDay = new Map()
  for (const e of c.events) {
    if (!byDay.has(e.day)) byDay.set(e.day, [])
    byDay.get(e.day).push(e)
  }
  return [...byDay.keys()].sort((a, b) => a - b).map((day) => ({
    day,
    weekday: WEEK[(c.firstWeekday + day - 1) % 7],
    today: day === today,
    past: day < today,
    events: byDay.get(day)
  }))
}

// 달력 격자. 웹 캘린더가 한 달을 보여 주는 그 방식.
function Month({ c, today, me }) {
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

// 폰의 일정 앱. 날짜 한 줄, 그 아래 그날의 일정들.
function Agenda({ c, today, me }) {
  const rows = agendaOf(c, today)
  return (
    <div className="ag">
      <header className="ag-top">
        <div className="ag-month">{c.month}월</div>
        <div className="ag-who">{me}님의 일정</div>
      </header>
      <ol className="ag-list">
        {rows.map((r) => (
          <li key={r.day} className={(r.today ? 'now ' : '') + (r.past ? 'past' : '')}>
            <div className="ag-date">
              <b>{r.day}</b>
              <span>{r.weekday}</span>
            </div>
            <div className="ag-evs">
              {r.events.map((e, i) => (
                <div key={i} className="ag-ev">
                  <span className="ag-time">{e.time ?? '종일'}</span>
                  <span className="ag-title">{e.title}</span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {rows.length === 0 && <p className="ag-none">이번 달 일정이 없습니다.</p>}
    </div>
  )
}

// The player's own month. 넓은 화면에서는 격자로, 폰에서는 목록으로 —
// 같은 자료를 기기에 맞게 다르게 편다.
export default function Calendar({ site }) {
  const day = useGame((s) => s.day)
  const me = useGame((s) => s.scenario.player.name)
  const today = +(useGame((s) => s.scenario.days[day - 1]?.date ?? '').match(/(\d+)일/)?.[1] ?? 0)
  const phone = useViewport() === 'phone'
  const props = { c: site.calendar, today, me }
  return phone ? <Agenda {...props} /> : <Month {...props} />
}
