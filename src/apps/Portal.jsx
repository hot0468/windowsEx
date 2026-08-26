import { useEffect, useRef, useState } from 'react'
import { useGame, portalFeed, visibleByDay } from '../engine/store.js'
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

// The attendance page: hours the gate logged, next to the leave never taken.
// Nobody is asked to open this — it is the company keeping score all along.
const Attendance = ({ page, onBack }) => {
  const a = page.attendance
  return (
    <article className="pt-post pt-att">
      <button className="pt-back" onClick={onBack}>
        <ChevronLeft size={13} strokeWidth={2.2} />포털 홈
      </button>
      <h1>{page.title}</h1>
      <p className="pt-att-note">{a.note}</p>
      <table className="pt-att-table">
        <thead>
          <tr>{a.columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {a.rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, i) => <td key={i} className={i === 0 ? 'mo' : ''}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="pt-att-flags">
        {a.flags.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <p className="pt-att-last">{a.last}</p>
      <p className="pt-att-foot">{a.footer}</p>
    </article>
  )
}

// The menu the hints have always pointed at. Nothing here is required reading —
// which is the point of the page it leads to.
const Menu = ({ page, onBack, onOpen }) => (
  <article className="pt-post pt-menu">
    <button className="pt-back" onClick={onBack}>
      <ChevronLeft size={13} strokeWidth={2.2} />포털 홈
    </button>
    <h1>{page.title}</h1>
    <ul className="pt-menu-list">
      {page.menu.map((m) => (
        <li key={m.path}>
          <button onClick={() => onOpen?.(m.path)}>
            <b>{m.label}</b>
            <span>{m.desc}</span>
            <ChevronRight size={14} strokeWidth={2.2} />
          </button>
        </li>
      ))}
    </ul>
  </article>
)

// 휴가신청: the period on record does not match the approved form, and the
// receipt only comes out when the two agree. Nothing here can be guessed —
// the dates are on the copy of the form the player already had to find.
const Leave = ({ page, onBack }) => {
  const v = page.leave
  const [from, setFrom] = useState(v.from[0])
  const [to, setTo] = useState(v.to[0])
  const [result, setResult] = useState(null)
  const submit = () =>
    setResult(from === v.answer.from && to === v.answer.to ? 'ok' : 'no')
  return (
    <article className="pt-post pt-leave">
      <button className="pt-back" onClick={onBack}>
        <ChevronLeft size={13} strokeWidth={2.2} />인사관리
      </button>
      <h1>{page.title}</h1>
      <p className="pt-lv-note">{v.note}</p>
      <dl className="pt-ev-meta">
        <div><dt>{v.current.label}</dt><dd>{v.current.period} <em>{v.current.state}</em></dd></div>
        <div><dt>사유</dt><dd>{v.reason}</dd></div>
        <div><dt>결재</dt><dd>{v.approver}</dd></div>
      </dl>
      {result === 'ok' ? (
        <div className="pt-ev-done">
          <p>{v.done}</p>
          <div className="pt-ev-receipt">접수번호 <b>{v.receipt}</b></div>
        </div>
      ) : (
        <div className="pt-ev-form">
          <div className="pt-ev-row">
            <span>시작일</span>
            <select value={from} onChange={(e) => { setFrom(e.target.value); setResult(null) }}>
              {v.from.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="pt-ev-row">
            <span>종료일</span>
            <select value={to} onChange={(e) => { setTo(e.target.value); setResult(null) }}>
              {v.to.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          {result === 'no' && <p className="pt-lv-bad">{v.mismatch}</p>}
          <button className="btn-primary" onClick={submit}>다시 등록</button>
        </div>
      )}
    </article>
  )
}

// 경조사: a weekly notice board like any other. Nothing on it is addressed to
// the player, and the week that matters reads like the weeks around it — a
// wedding, somebody's grandmother, and then the last entry. Notices are
// compiled on Fridays, so this week's is not on the list until the last day.
const Bereavement = ({ page, onBack }) => {
  const day = useGame((s) => s.day)
  const b = page.board
  const posts = visibleByDay(b.posts, day)
  const [open, setOpen] = useState(null)
  const post = posts.find((x) => x.id === open)
  if (post) return <Notice post={post} onBack={() => setOpen(null)} />
  return (
    <article className="pt-post pt-obit">
      <button className="pt-back" onClick={onBack}>
        <ChevronLeft size={13} strokeWidth={2.2} />인사관리
      </button>
      <h1>{page.title}</h1>
      <p className="pt-obit-note">{b.note}</p>
      <table className="pt-obit-table">
        <thead>
          <tr>{b.columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {posts.map((x) => (
            <tr key={x.id}>
              <td><button className="pt-obit-link" onClick={() => setOpen(x.id)}>{x.title}</button></td>
              <td>{x.author}</td>
              <td>{x.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  )
}

// One week's notice, read all the way down. Opening the page is not the moment
// the game remembers — scrolling far enough to reach the last entry is. Backing
// out at the wedding leaves the week unread.
const Notice = ({ post, onBack }) => {
  const witness = useGame((s) => s.witness)
  const end = useRef(null)
  useEffect(() => {
    if (!post.obituary) return
    // without the observer the ending has to stay reachable, so opening counts
    if (!end.current || !window.IntersectionObserver) return witness()
    const io = new IntersectionObserver(([e]) => e.isIntersecting && witness())
    io.observe(end.current)
    return () => io.disconnect()
  }, [post.id])
  return (
    <article className="pt-post pt-obit">
      <button className="pt-back" onClick={onBack}>
        <ChevronLeft size={13} strokeWidth={2.2} />목록
      </button>
      <h1>{post.title}</h1>
      <div className="pt-post-meta">{post.author} · {post.date}</div>
      <p>{post.intro}</p>
      {post.sections.map((sec, i) => (
        <section key={i} className="pt-obit-sec">
          <h2>■ {sec.kind}</h2>
          <dl>
            {sec.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {sec.mine && <i ref={end} className="pt-obit-end" aria-hidden="true" />}
        </section>
      ))}
      {post.close.map((line) => <p key={line} className="pt-obit-close">{line}</p>)}
    </article>
  )
}

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

// Each sub-page is known by the one field its data carries, and says where its
// back button goes. A page whose shape nothing here recognises draws nothing.
const SUBPAGES = [
  [Attendance, 'attendance', '/hr'],
  [Menu, 'menu', ''],
  [Bereavement, 'board', '/hr'],
  [Leave, 'leave', '/hr'],
  [Events, 'event', '/hr']
]

export default function Portal({ site, path = '', onOpen }) {
  const scenario = useGame((s) => s.scenario)
  const day = useGame((s) => s.day)
  // the board moves on with the days
  const today = scenario.days[day - 1]?.portal
  // today's banner replaces yesterday's, but the 소식 list keeps piling up
  const p = { ...site.portal, ...(today ?? {}), news: portalFeed(scenario, site.portal, day) }
  const [post, setPost] = useState(null)
  // Which sub-page a path names. A page the portal has no view for shows the
  // portal instead of falling through to whichever view came last in a chain.
  const [Sub, , back] = SUBPAGES.find(([, key]) => site.pages?.[path]?.[key]) ?? []
  const sub = Boolean(Sub)
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

      {sub
        ? <Sub page={site.pages[path]} onBack={() => onOpen?.(back)} onOpen={onOpen} />
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
