// 회사 홈페이지. 한 장짜리 vendor 페이지와 달리 실제 B2B 사이트가 갖는 층을
// 그대로 둔다 — 상단 메뉴, 히어로, 숫자, 사업영역 카드, 고객지원, 오시는 길,
// 회사 정보 푸터. 플레이어가 찾는 값(팩스번호·본사 주소)은 실제 홈페이지에서
// 그것을 찾을 자리에 있다.
export default function Corp({ site }) {
  const c = site.corp
  return (
    <div className="cp">
      <header className="cp-gnb">
        <span className="cp-brand">{c.brand}<em>{c.tagline}</em></span>
        <nav>{c.nav.map((n) => <span key={n}>{n}</span>)}</nav>
      </header>

      <section className="cp-hero">
        <span className="cp-eyebrow">{c.hero.eyebrow}</span>
        <h1>{c.hero.title}</h1>
        <p>{c.hero.sub}</p>
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
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cp-sec cp-support">
        <h2>{c.support.title}</h2>
        <dl>
          {c.support.rows.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      </section>

      <section className="cp-sec">
        <h2>{c.map.title}</h2>
        <p className="cp-address">{c.map.address}</p>
        <p className="cp-map-note">{c.map.note}</p>
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
