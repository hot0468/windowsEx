import { useGame } from '../engine/store.js'
import { newsShot } from '../assets/photos.js'
import { Search } from '../icons/line.jsx'

const day = (d) => d.replace(/^\d{4}\.(\d{2})\.(\d{2})$/, '$1월 $2일')

const Thumb = ({ a, className }) => (
  <span className={className}>
    {newsShot(a.id) && <img src={newsShot(a.id)} alt="" draggable="false" />}
  </span>
)

// A newspaper front page over the day's visible articles: the newest as the lead,
// the rest as a thumbnail list, adverts down the side. `news` is already
// filtered to what today can see; `onOpen` takes the reader to the article.
export default function News({ site, news, onOpen }) {
  const today = useGame((s) => s.scenario.days[s.day - 1]?.date ?? '')
  const sorted = [...news].sort((a, b) => b.date.localeCompare(a.date))
  const [lead, ...rest] = sorted
  const n = site.news

  return (
    <div className="nw">
      <div className="nw-top">
        <span className="nw-links">로그인 · 회원가입 · e-paper · 모바일보기</span>
        <div className="nw-mast">
          <span className="nw-brand">{site.title}</span>
          <span className="nw-slogan">{n.slogan}</span>
        </div>
        <label className="nw-search">
          <input placeholder="기사 검색" aria-label="기사 검색" />
          <Search size={15} strokeWidth={2.2} />
        </label>
      </div>
      <nav className="nw-menu">{n.menu.map((m) => <span key={m}>{m}</span>)}</nav>

      <div className="nw-hot">
        <b>가장 많이 본 뉴스</b><span className="nw-hot-date">{today}</span>
        {rest.slice(0, 2).map((a, i) => (
          <button key={a.id} onClick={() => onOpen(a.id)}><i>{i + 3}</i>{a.title}</button>
        ))}
      </div>

      {lead && (
        <button className="nw-lead" onClick={() => onOpen(lead.id)}>
          <Thumb a={lead} className="nw-lead-shot" />
          <span className="nw-lead-body">
            <span className="nw-lead-title">{lead.title}</span>
            <span className="nw-lead-text">{lead.body.join(' ')}</span>
            <span className="nw-by">{lead.press} · {lead.reporter} · {day(lead.date)}</span>
          </span>
        </button>
      )}

      <div className="nw-cols">
        <div className="nw-list">
          {rest.map((a) => (
            <button key={a.id} className="nw-row" onClick={() => onOpen(a.id)}>
              <Thumb a={a} className="nw-row-shot" />
              <span className="nw-row-body">
                <span className="nw-row-title">{a.title}</span>
                <span className="nw-row-text">{a.summary}</span>
                <span className="nw-by">{a.press} · {day(a.date)}</span>
              </span>
            </button>
          ))}
        </div>
        <aside className="nw-side">
          {n.banners.map((b) => (
            <div key={b.title} className="nw-ad" style={{ background: b.color }}>
              <span className="nw-ad-kicker">{b.kicker}</span>
              <span className="nw-ad-title">{b.title}</span>
              <span className="nw-ad-sub">{b.sub}</span>
            </div>
          ))}
        </aside>
      </div>
    </div>
  )
}
