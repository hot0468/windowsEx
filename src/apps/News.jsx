import { useState } from 'react'
import { useGame } from '../engine/store.js'
import { newsShot } from '../assets/photos.js'
import { Search } from '../icons/line.jsx'

const day = (d) => d.replace(/^\d{4}\.(\d{2})\.(\d{2})$/, '$1월 $2일')

const Thumb = ({ a, className }) => (
  <span className={className}>
    {newsShot(a.id) && <img src={newsShot(a.id)} alt="" draggable="false" />}
  </span>
)

// 기사 입력 시각. 데이터에 없어서 기사 id로 지어내되 같은 기사는 늘 같은
// 시각이다 — 열 때마다 달라지면 그게 더 가짜다. 요일은 쓰지 않는다: 이 게임의
// 달력은 실제 2026년과 다르고 friday.test.js가 요일 표기를 검사한다.
export function filedAt(id) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const two = (n) => String(n).padStart(2, '0')
  // >>> 로 민다. >> 는 부호를 늘려서 해시가 2^31을 넘으면 분이 음수가 된다.
  return `${two(8 + (h % 11))}:${two((h >>> 4) % 60)}`   // 08~18시
}

// 태그가 겹치는 기사. 많이 겹치는 순, 같으면 최근 순. 넘겨받은 `news`는 이미
// 오늘 볼 수 있는 것만 남은 목록이라, 아직 쓰이지 않은 기사가 딸려 오지 않는다.
export function relatedTo(news, a, count = 3) {
  const tags = new Set(a.tags ?? [])
  return news
    .filter((x) => x.id !== a.id)
    .map((x) => ({ x, hits: (x.tags ?? []).filter((t) => tags.has(t)).length }))
    .filter((r) => r.hits > 0)
    .sort((p, q) => q.hits - p.hits || q.x.date.localeCompare(p.x.date))
    .slice(0, count)
    .map((r) => r.x)
}

// 기사가 걸리는 지면. 제휴 언론사마다 정해져 있고, 모르는 곳은 첫 지면으로 간다.
const sectionOf = (n, press) => n.sections?.[press] ?? n.menu[0]

const Masthead = ({ site, compact, onHome }) => (
  <div className={'nw-top' + (compact ? ' nw-top-slim' : '')}>
    <span className="nw-links">로그인 · 회원가입 · e-paper · 모바일보기</span>
    <div className="nw-mast">
      {compact
        ? <button className="nw-brand" onClick={onHome}>{site.title}</button>
        : <span className="nw-brand">{site.title}</span>}
      {!compact && <span className="nw-slogan">{site.news.slogan}</span>}
    </div>
    <label className="nw-search">
      <input placeholder="기사 검색" aria-label="기사 검색" />
      <Search size={15} strokeWidth={2.2} />
    </label>
  </div>
)

// 본문 글자 크기. 실제 언론사 페이지의 '가- 가+'와 같은 자리다 — 눌리는 것만
// 둔다(인쇄는 이 PC의 복합기 퍼즐과 얽혀서 여기서 흉내내지 않는다).
const SIZES = [12, 13, 15, 17]

// 기사 한 건. 목록과 같은 지면 안에 들어간다 — 기사로 들어갔다고 신문사가
// 사라지면 그때부터 브라우저가 아니라 텍스트 뷰어로 보인다.
export function Article({ a, site, news, onOpen, onHome }) {
  const [size, setSize] = useState(1)
  const [copied, setCopied] = useState(false)
  const n = site.news
  const shot = newsShot(a.id)
  const kin = relatedTo(news, a)
  const url = `${site.url}/article/${a.id}`

  // 주소를 복사한 척한다. 진짜 클립보드는 건드리지 않는다 — 게임 안의 가짜
  // 주소가 플레이어가 밖에서 쓰던 것을 밀어내면 안 된다.
  const copy = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="nw nw-article">
      <Masthead site={site} compact onHome={onHome} />
      <nav className="nw-menu">
        {n.menu.map((m) => (
          <span key={m} className={m === sectionOf(n, a.press) ? 'on' : ''}>{m}</span>
        ))}
      </nav>

      <div className="nw-crumb">
        <button onClick={onHome}>홈</button>
        <span>›</span>
        <span>{sectionOf(n, a.press)}</span>
      </div>

      <article className="art">
        <div className="art-press">{a.press}</div>
        <h1>{a.title}</h1>
        {a.summary && <p className="art-lead">{a.summary}</p>}

        <div className="art-meta">
          <span className="art-by">{a.reporter}</span>
          <span className="art-filed">입력 {a.date} {filedAt(a.id)}</span>
          <span className="art-tools">
            <button onClick={() => setSize((i) => Math.max(0, i - 1))}
                    disabled={size === 0} aria-label="본문 글자 작게">가－</button>
            <button onClick={() => setSize((i) => Math.min(SIZES.length - 1, i + 1))}
                    disabled={size === SIZES.length - 1} aria-label="본문 글자 크게">가＋</button>
            <button className="art-copy" onClick={copy}>{copied ? '복사됨' : '주소 복사'}</button>
          </span>
        </div>
        {copied && <div className="art-copied">{url}</div>}

        {shot && (
          <figure className="art-figure">
            <img src={shot} alt="" draggable="false" />
            <figcaption>사진 = {a.press}</figcaption>
          </figure>
        )}

        <div className="art-body" style={{ fontSize: SIZES[size] }}>
          {a.body.map((para, i) => <p key={i}>{para}</p>)}
        </div>

        <div className="art-sign">{a.reporter}</div>
        {a.tags?.length > 0 && (
          <div className="art-tags">{a.tags.map((t) => <span key={t}>#{t}</span>)}</div>
        )}
        <div className="art-copyright">ⓒ {site.title}. 무단 전재 및 재배포 금지.</div>
      </article>

      {kin.length > 0 && (
        <div className="art-more">
          <b>관련 기사</b>
          {kin.map((x) => (
            <button key={x.id} onClick={() => onOpen(x.id)}>
              <Thumb a={x} className="art-more-shot" />
              <span className="art-more-body">
                <span className="art-more-title">{x.title}</span>
                <span className="nw-by">{x.press} · {day(x.date)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
      <Masthead site={site} />
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
