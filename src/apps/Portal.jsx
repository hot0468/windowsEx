import { useState } from 'react'
import { useGame, portalFeed } from '../engine/store.js'
import { faceOf } from '../assets/photos.js'
import { Bell, ChevronLeft, ChevronRight, Search } from '../icons/line.jsx'
import Download from './Download.jsx'

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

// The notice banner and every 사내 소식 item are board posts you can open.
const Post = ({ post, onBack }) => (
  <article className="pt-post">
    <button className="pt-back" onClick={onBack}>
      <ChevronLeft size={13} strokeWidth={2.2} />목록
    </button>
    <h1>{post.title}</h1>
    <div className="pt-post-meta">{post.author} · {post.date}</div>
    {post.body.map((line, i) => <p key={i}>{line}</p>)}
  </article>
)

// A sub-page reached by path: the workshop RSVP form. Submitting hands out the
// receipt number a request will ask for.
const Events = ({ page, onBack }) => {
  const [attend, setAttend] = useState(page.attend[0])
  const [ride, setRide] = useState(page.transport[0])
  const [sent, setSent] = useState(false)
  const book = useGame((s) => s.book)
  const submit = () => {
    setSent(true)
    book('workshop', { attend, ride, receipt: page.receipt })
  }
  return (
    <article className="pt-post pt-events">
      <button className="pt-back" onClick={onBack}>
        <ChevronLeft size={13} strokeWidth={2.2} />포털 홈
      </button>
      <h1>{page.title}</h1>
      <dl className="pt-ev-meta">
        <div><dt>행사</dt><dd>{page.event.name}</dd></div>
        <div><dt>일시</dt><dd>{page.event.date}</dd></div>
        <div><dt>장소</dt><dd>{page.event.place}</dd></div>
        <div><dt>마감</dt><dd>{page.event.deadline}</dd></div>
      </dl>
      {sent ? (
        <div className="pt-ev-done">
          <p>{page.done}</p>
          <div className="pt-ev-receipt">접수번호 <b>{page.receipt}</b></div>
        </div>
      ) : (
        <div className="pt-ev-form">
          <div className="pt-ev-row">
            <span>참가 여부</span>
            {page.attend.map((a) => (
              <label key={a}><input type="radio" name="attend" checked={attend === a} onChange={() => setAttend(a)} />{a}</label>
            ))}
          </div>
          <div className="pt-ev-row">
            <span>이동 수단</span>
            {page.transport.map((t) => (
              <label key={t}><input type="radio" name="ride" checked={ride === t} onChange={() => setRide(t)} />{t}</label>
            ))}
          </div>
          <button className="btn-primary" onClick={submit}>제출</button>
        </div>
      )}
    </article>
  )
}

export default function Portal({ site, path = '', onOpen }) {
  const scenario = useGame((s) => s.scenario)
  const day = useGame((s) => s.day)
  // the board moves on with the days
  const today = scenario.days[day - 1]?.portal
  // today's banner replaces yesterday's, but the 소식 list keeps piling up
  const p = { ...site.portal, ...(today ?? {}), news: portalFeed(scenario, site.portal, day) }
  const [post, setPost] = useState(null)
  return (
    <div className="pt">
      <div className="pt-top">
        <span className="pt-logo">AR</span>
        <nav>
          {p.nav.map((n) => (p.navLinks?.[n] && onOpen
            ? <button key={n} className="pt-nav-link" onClick={() => onOpen(p.navLinks[n])}>{n}</button>
            : <span key={n}>{n}</span>))}
        </nav>
        <span className="pt-top-icons">
          <Search size={15} strokeWidth={2} />
          <Bell size={15} strokeWidth={2} />
        </span>
      </div>

      {site.pages?.[path] ? <Events page={site.pages[path]} onBack={() => onOpen?.('')} />
        : post ? <Post post={post} onBack={() => setPost(null)} /> : (
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
          <button className="pt-notice" onClick={() => setPost(p.notice)}>
            <Bell size={14} strokeWidth={2} />
            <span>{p.notice.text}</span>
            <em>{p.notice.meta}</em>
          </button>

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
              {p.news.map((n, i) => (
                <li key={i}>
                  <button onClick={() => setPost(n)}>{n.title}</button>
                  <span className="pt-row-date">{n.date}</span>
                </li>
              ))}
            </ul>
          </Panel>

          {site.files && (
            <Panel title="자료실" more="전체보기">
              {site.files.map((f) => (
                <div key={f.download.fileId} className="pt-file">
                  <p className="pt-file-desc">{f.desc}</p>
                  <Download item={f.download} />
                </div>
              ))}
            </Panel>
          )}
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
      )}

      <footer className="pt-foot">
        <div className="pt-foot-name">{p.footer.company}</div>
        <div>{p.footer.address}</div>
        <div>{p.footer.tel}</div>
      </footer>
    </div>
  )
}
