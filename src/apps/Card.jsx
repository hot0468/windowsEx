import { useState } from 'react'

// 경조사 안내에 붙는 그 링크를 눌렀을 때 열리는 것. 청첩장과 부고장은
// 같은 뼈대를 쓴다 — 실제로도 같은 업체가 같은 틀로 만들어 준다. 색과
// 표지 문구만 갈린다.
//
// 이 페이지는 퍼즐이 아니다. 답을 숨겨 두지 않았고, 아무것도 잠그지
// 않는다. 세계가 두툼해지라고 있는 곳이다.
export default function Card({ site }) {
  const c = site.card
  const wed = c.kind === 'wedding'
  // 계좌는 접혀 있다. 실제 청첩장이 그렇게 한다 — 돈 이야기를 맨 앞에
  // 펼쳐 두지 않는 것이 예의다.
  const [open, setOpen] = useState(false)

  return (
    <div className={'mc mc-' + c.kind}>
      <header className="mc-cover">
        <span className="mc-eyebrow">{c.cover.eyebrow}</span>
        {wed ? (
          <h1 className="mc-names">
            {c.cover.names[0]}<i>♥</i>{c.cover.names[1]}
          </h1>
        ) : (
          <h1 className="mc-lead">{c.cover.lead}</h1>
        )}
        <p className="mc-when">{wed ? c.cover.when : c.cover.sub}</p>
        {wed && <p className="mc-where">{c.cover.where}</p>}
      </header>

      <section className="mc-greet">
        {c.greeting.map((line, i) => <p key={i}>{line}</p>)}
      </section>

      <section className="mc-family">
        {c.family.map(([k, v]) => (
          <div key={k + v}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </section>

      <section className="mc-block">
        <h2>{wed ? '예식 안내' : '장례 안내'}</h2>
        <dl>
          {c.info.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </section>

      <section className="mc-block">
        <h2>오시는 길</h2>
        <dl>
          {c.ways.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </section>

      {c.accounts && (
        <section className="mc-block mc-acc">
          <button className="mc-acc-toggle" onClick={() => setOpen(!open)}
                  aria-expanded={open}>
            {c.accounts.note}
            <i className={open ? 'up' : ''}>⌄</i>
          </button>
          {open && (
            <dl>
              {c.accounts.rows.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd className="mc-num">{v}</dd></div>
              ))}
            </dl>
          )}
        </section>
      )}

      <p className="mc-close">{c.close}</p>
      <footer className="mc-foot">다온 모바일 초대장</footer>
    </div>
  )
}
