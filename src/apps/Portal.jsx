import { faceOf } from '../assets/photos.js'
import { Bell, ChevronRight, Search } from '../icons/line.jsx'

const Face = ({ id, size }) => {
  const src = faceOf(id)
  return (
    <span className="pt-face" style={{ width: size, height: size }}>
      {src && <img src={src} alt="" draggable="false" />}
    </span>
  )
}

const Panel = ({ title, more, children }) => (
  <section className="pt-panel">
    <div className="pt-panel-head">
      <h4>{title}</h4>
      {more && <span className="pt-more">{more}<ChevronRight size={12} strokeWidth={2.2} /></span>}
    </div>
    {children}
  </section>
)

const State = ({ value }) => <span className={'pt-state s-' + value}>{value}</span>

export default function Portal({ site }) {
  const p = site.portal
  return (
    <div className="pt">
      <div className="pt-top">
        <span className="pt-logo">HANBIT</span>
        <nav>{p.nav.map((n) => <span key={n}>{n}</span>)}</nav>
        <span className="pt-top-icons">
          <Search size={15} strokeWidth={2} />
          <Bell size={15} strokeWidth={2} />
        </span>
      </div>

      <div className="pt-grid">
        <aside className="pt-me">
          <Face id={p.me.id} size={64} />
          <div className="pt-me-team">{p.me.team}</div>
          <div className="pt-me-name">{p.me.name} <span>{p.me.rank}</span></div>
          <dl className="pt-me-stats">
            <div><dt>사번</dt><dd>{p.me.empNo}</dd></div>
            <div><dt>근속</dt><dd>{p.me.tenure}</dd></div>
            <div><dt>총 연차</dt><dd>{p.me.leaveTotal}</dd></div>
            <div><dt>남은 연차</dt><dd className="hot">{p.me.leaveLeft}</dd></div>
          </dl>
        </aside>

        <main className="pt-main">
          <div className="pt-notice">
            <Bell size={14} strokeWidth={2} />
            <span>{p.notice.text}</span>
            <em>{p.notice.meta}</em>
          </div>

          <div className="pt-cols">
            <Panel title="내문서" more="결재작성">
              {p.docs.map((d, i) => (
                <div key={i} className="pt-row">
                  <State value={d.state} />
                  <span className="pt-row-title">{d.title}</span>
                  <span className="pt-row-date">{d.date}</span>
                </div>
              ))}
            </Panel>

            <Panel title="업무관리" more="전체보기">
              {p.tasks.map((t, i) => (
                <div key={i} className="pt-row">
                  <State value={t.state} />
                  <span className="pt-row-title">{t.title}</span>
                  <span className="pt-row-who">{t.who}</span>
                  <span className="pt-row-date">{t.date}</span>
                </div>
              ))}
            </Panel>
          </div>

          <Panel title="사내 소식">
            <ul className="pt-news">
              {p.news.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </Panel>
        </main>

        <aside className="pt-side">
          <Panel title="회의실 현황">
            {p.rooms.map((r, i) => (
              <div key={i} className="pt-room">
                <span className={'pt-room-tag r' + ((i % 3) + 1)}>{r.room}</span>
                <span className="pt-room-time">{r.time}</span>
                <span className="pt-room-who">{r.who}</span>
              </div>
            ))}
          </Panel>

          <Panel title="직원 현황">
            {p.staff.map((s) => (
              <div key={s.id} className="pt-staff">
                <Face id={s.id} size={34} />
                <span className="pt-staff-mid">
                  <span className="pt-staff-name">{s.name}</span>
                  <span className="pt-staff-team">{s.team}</span>
                </span>
                <span className={'pt-note' + (s.note === '외근' ? ' out' : '')}>{s.note}</span>
              </div>
            ))}
          </Panel>
        </aside>
      </div>
    </div>
  )
}
