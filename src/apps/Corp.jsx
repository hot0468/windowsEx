import { House, Info, LayoutGrid, RotateCcw, Search, Send, Settings } from '../icons/line.jsx'

// 회사 홈페이지. 한 장짜리 vendor 페이지와 달리 실제 B2B 사이트가 갖는 층을
// 그대로 둔다 — 상단 메뉴, 히어로, 숫자, 사업영역 카드, 고객지원, 오시는 길,
// 회사 정보 푸터. 플레이어가 찾는 값(팩스번호·본사 주소)은 실제 홈페이지에서
// 그것을 찾을 자리에 있다.
const ICONS = { rotate: RotateCcw, grid: LayoutGrid, search: Search, send: Send, settings: Settings, info: Info }
const Glyph = ({ name, size }) => {
  const I = ICONS[name]
  return I ? <I size={size} strokeWidth={1.7} /> : null
}

export default function Corp({ site }) {
  const c = site.corp
  return (
    <div className="cp">
      <header className="cp-gnb">
        <span className="cp-brand">{c.brand}<em>{c.tagline}</em></span>
        <nav>{c.nav.map((n) => <span key={n}>{n}</span>)}</nav>
      </header>

      <section className="cp-hero">
        <div className="cp-hero-text">
          <span className="cp-eyebrow">{c.hero.eyebrow}</span>
          <h1>{c.hero.title}</h1>
          <p>{c.hero.sub}</p>
        </div>
        {/* 설비가 지나가는 라인. 사진을 들이지 않고 CSS로만 그린다. */}
        <div className="cp-hero-art" aria-hidden="true">
          <i /><i /><i /><i /><i />
        </div>
      </section>

      <section className="cp-stats">
        {c.stats.map((s) => (
          <div key={s.label}>
            <strong>{s.n}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </section>

      <section className="cp-sec">
        <h2>사업영역</h2>
        <div className="cp-cards">
          {c.fields.map((f) => (
            <article key={f.title}>
              <span className="cp-card-icon"><Glyph name={f.icon} size={22} /></span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cp-sec cp-support">
        <h2>{c.support.title}</h2>
        <dl>
          {c.support.rows.map((r) => (
            <div key={r.label}>
              <dt><Glyph name={r.icon} size={15} />{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="cp-sec cp-map">
        <h2>{c.map.title}</h2>
        <div className="cp-map-row">
          <span className="cp-map-pin"><House size={20} strokeWidth={1.7} /></span>
          <div>
            <p className="cp-address">{c.map.address}</p>
            <p className="cp-map-note">{c.map.note}</p>
          </div>
        </div>
      </section>

      <footer className="cp-foot">
        <div className="cp-foot-brand">{c.brand}</div>
        {c.footer.rows.map((r) => <div key={r}>{r}</div>)}
        <div className="cp-foot-contact">{c.footer.contact}</div>
        <div className="cp-foot-copy">{c.footer.copyright}</div>
      </footer>
    </div>
  )
}
