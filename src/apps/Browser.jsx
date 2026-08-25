import { useEffect, useState } from 'react'
import {
  hostResolves, latestNews, parseAddress, pathKnown, resolveSite, searchAds, searchBlogs, searchCompanies, searchNews, searchPlaces, searchQna, searchSites, searchTerms, siteView, specialPage, useGame, visibleByDay
} from '../engine/store.js'
import Place from './Place.jsx'
import Portal from './Portal.jsx'
import Calendar from './Calendar.jsx'
import News from './News.jsx'
import Wiki from './Wiki.jsx'
import Board from './Board.jsx'
import Gov from './Gov.jsx'
import Lotto from './Lotto.jsx'
import Floor8 from './Floor8.jsx'
import Notes from './Notes.jsx'
import Vendor from './Vendor.jsx'
import Router from './Router.jsx'
import PrinterWeb from './PrinterWeb.jsx'
import Phish from './Phish.jsx'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock, Code, House, Lock, Monitor, MoreVertical, Search, Settings, Star } from '../icons/line.jsx'
import Icon from '../icons/Icon.jsx'
import { useHistory } from './folderNav.js'
import { newsShot, shotOf } from '../assets/photos.js'


function Login({ site, onOk }) {
  const { idLabel, id, password, hint } = site.login
  const [who, setWho] = useState('')
  const [pw, setPw] = useState('')
  const [misses, setMisses] = useState(0)
  const [asked, setAsked] = useState(false)

  const submit = () =>
    (pw === password && (!id || who.trim().toUpperCase() === id)
      ? onOk()
      : setMisses((n) => n + 1))
  const onKey = (e) => e.key === 'Enter' && submit()
  // Shown on request, and offered unprompted once someone is clearly stuck.
  const showHint = asked || misses >= 2

  return (
    <div className="lg">
      <div className="lg-hero">
        <h1>로그인</h1>
        <p>{site.title}에 오신 것을 환영합니다.</p>
      </div>

      <div className="lg-card">
        {id && (
          <label className="lg-field">
            <span>{idLabel}</span>
            <input value={who} onChange={(e) => setWho(e.target.value)} onKeyDown={onKey}
                   placeholder={`${idLabel}를 입력해주세요.`} spellCheck={false} />
          </label>
        )}
        <label className="lg-field">
          <span>비밀번호</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                 onKeyDown={onKey} placeholder="비밀번호를 입력해주세요." />
        </label>

        <button className="lg-forgot" onClick={() => setAsked(true)}>비밀번호를 잊으셨나요?</button>
        {showHint && <p className="lg-hint"><Lock size={13} strokeWidth={2} />{hint}</p>}
        {misses > 0 && <p className="pw-error">로그인 정보가 올바르지 않습니다.</p>}

        <button className="lg-submit" onClick={submit}>로그인</button>
        <p className="lg-foot">계정 문의: 정보전략팀 내선 1234</p>
      </div>
    </div>
  )
}

export default function Browser() {
  const scenario = useGame((s) => s.scenario)
  const unlocked = useGame((s) => s.unlocked)
  const grants = useGame((s) => s.grants)
  const unlockSite = useGame((s) => s.unlockSite)
  const edits = useGame((s) => s.edits)
  const day = useGame((s) => s.day)
  // an article dated later in the week has not been written yet
  const news = visibleByDay(scenario.news, day)
  const vpn = useGame((s) => s.vpn)
  const routerDown = useGame((s) => s.routerDown)
  const [addr, setAddr] = useState('')
  const nav = useHistory({ kind: 'home' })
  const page = nav.at
  const [q, setQ] = useState('')
  const [menu, setMenu] = useState(false)
  const openWindow = useGame((s) => s.openWindow)
  const closeWindow = useGame((s) => s.closeWindow)
  const setBrowserDev = useGame((s) => s.setBrowserDev)
  const askedIp = useGame((s) => s.askedIp)
  // F12 opens the developer tools as their own window, and once more shuts it
  const toggleDev = () => {
    const w = useGame.getState().windows.find((w) => w.app === 'devtools')
    w ? closeWindow(w.id) : openWindow('devtools')
  }

  // A path on its own ('/hr/events') stays on the site that is open.
  const open = (raw) => {
    const typed = raw.trim().startsWith('/') && page.kind === 'site' ? page.url + raw.trim() : raw
    const { host, path } = parseAddress(typed)
    setAddr(host + path)
    nav.go(host ? { kind: 'site', url: host, path } : { kind: 'home' })
    setMenu(false)
  }

  const submitSearch = () => {
    if (!q.trim()) return
    setAddr('')
    nav.go({ kind: 'search', q: q.trim() })
  }

  // Stepping through history has to bring the address bar along with it.
  const step = (move) => () => {
    setMenu(false)
    move()
  }

  useEffect(() => {
    setAddr(page.kind === 'site' ? page.url + (page.path ?? '') : '')
  }, [page])
  useEffect(() => () => {
    useGame.getState().windows.filter((w) => w.app === 'devtools').forEach((w) => closeWindow(w.id))
  }, [])

  const site = page.kind === 'site' ? resolveSite(scenario, edits, page.url) : null
  const special = page.kind === 'site' ? specialPage(page.url) : null
  // typed as an address, a host-only site needs no name in the hosts file
  const byAddress = Boolean(site) && site.url !== page.url
  const view = page.kind === 'site' && !special
    ? siteView(site, {
      grants, unlocked, vpn,
      // with the router's DHCP stopped only the router itself still answers
      offline: routerDown && site?.url !== scenario.network.gateway,
      resolves: byAddress || !site?.requiresHost || hostResolves(scenario, edits, site.url)
    })
    : null
  const lost = view === 'ready' && !pathKnown(site, page.path)
  const hits = page.kind === 'search' ? searchSites(scenario.sites, page.q) : []
  const spots = page.kind === 'search' ? searchPlaces(scenario.places, page.q) : []
  const posts = page.kind === 'search' ? searchBlogs(scenario.blogs, page.q) : []
  const articles = page.kind === 'search' ? searchNews(news, page.q) : []
  const answers = page.kind === 'search' ? searchQna(scenario.qna, page.q) : []
  const firms = page.kind === 'search' ? searchCompanies(scenario.companies, page.q) : []
  const words = page.kind === 'search' ? searchTerms(scenario.terms, page.q) : []
  const promos = page.kind === 'search' ? searchAds(scenario.ads, page.q) : []
  useEffect(() => { setBrowserDev({ console: consoleLines(page, site, view), network: networkRows(page, site, view) }) }, [page, site, view])
  // The block card tells the player to ask 정보보안팀; 차민혁 gets there first.
  useEffect(() => { if (view === 'blocked') askedIp() }, [view])

  return (
    <div className="browser" tabIndex={-1} onKeyDown={(e) => e.key === 'F12' && (e.preventDefault(), toggleDev())}>
      <div className="addr-bar">
        <button onClick={step(nav.back)} disabled={!nav.canBack} title="뒤로">
          <ChevronLeft size={18} strokeWidth={1.9} />
        </button>
        <button onClick={step(nav.forward)} disabled={!nav.canForward} title="앞으로">
          <ChevronRight size={18} strokeWidth={1.9} />
        </button>
        <button onClick={() => open('')} title="홈"><House size={17} strokeWidth={1.7} /></button>
        <input value={addr} onChange={(e) => setAddr(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && open(addr)}
               placeholder="주소를 입력하세요" aria-label="주소" spellCheck={false} />
        <button className="bw-menu" onClick={() => setMenu(!menu)} title="메뉴">
          <MoreVertical size={17} strokeWidth={2} />
        </button>
        {menu && (
          <>
            <div className="ctx-catch" onPointerDown={() => setMenu(false)} />
            <div className="bw-pop">
              <button className="bw-pop-item bw-pop-dev" onClick={() => { toggleDev(); setMenu(false) }}>
                <Code size={14} strokeWidth={1.9} /><span className="bw-pop-mid"><span>개발자 도구</span><span className="bw-pop-url">F12</span></span>
              </button>
              <div className="bw-pop-head">방문 기록</div>
              {scenario.history.map((h, i) => (
                <button key={i} className="bw-pop-item" onClick={() => open(h.url)}>
                  <Clock size={14} strokeWidth={1.7} />
                  <span className="bw-pop-mid">
                    <span>{h.title}</span>
                    <span className="bw-pop-url">{h.url}</span>
                  </span>
                  <span className="bw-pop-date">{h.date}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="bm-bar">
        <Star size={13} strokeWidth={1.9} />
        {scenario.bookmarks.map((b) => (
          <button key={b.url} className="bm" onClick={() => open(b.url)}>{b.title}</button>
        ))}
      </div>

      <div className={'page' + ((page.kind === 'blog' || page.kind === 'place' || page.kind === 'news' || (view && view !== 'error')) ? ' bleed' : '')}>
        {page.kind === 'home' && (
          <div className="portal">
            <button className="portal-cal" onClick={() => open('calendar.daon.com')} title="캘린더">
              <CalendarDays size={16} strokeWidth={1.9} />캘린더
            </button>
            <div className="portal-logo">{scenario.portal.name}</div>
            <div className="portal-search">
              <Search size={18} strokeWidth={1.9} />
              <input value={q} onChange={(e) => setQ(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
                     placeholder="검색어를 입력하세요" aria-label="검색어" spellCheck={false} />
              <button className="btn-primary" onClick={submitSearch}>검색</button>
            </div>
            <section className="portal-news">
              <h3>주요 기사<button className="pn-more" onClick={() => open('news.daon.com')}>더보기 ›</button></h3>
              <div className="pn-grid">
                {latestNews(news, 2).map((a) => (
                  <button key={a.id} className="pn-card" onClick={() => nav.go({ kind: 'news', id: a.id })}>
                    <span className="pn-thumb">
                      {newsShot(a.id) && <img src={newsShot(a.id)} alt="" draggable="false" />}
                    </span>
                    <span className="pn-body">
                      <span className="pn-press">
                        <i>{a.press[0]}</i>{a.press}
                        <em>구독 +</em>
                      </span>
                      <span className="pn-title">{a.title}</span>
                      <span className="pn-date">{a.date.replace(/^\d{4}\.(\d{2})\.(\d{2})$/, '$1월 $2일')}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {page.kind === 'search' && (
          <div className="results">
            <p className="results-head">
              '{page.q}' 검색 결과 {spots.length + firms.length + words.length + articles.length + answers.length + posts.length + hits.length}건
            </p>

            {promos.map((ad) => (
              <div key={ad.id} className="ad" onClick={() => open(ad.url)}>
                <div className="ad-top">
                  <span className="ad-badge">AD</span>
                  <span className="ad-title">{ad.title}</span>
                </div>
                <div className="ad-url">{ad.url}</div>
                <div className="ad-desc">{ad.desc}</div>
              </div>
            ))}

            {spots.length > 0 && (
              <section className="rs-block">
                <h3 className="rs-head"><Icon name="globe" size={15} />장소</h3>
                {spots.map((p) => (
                  <div key={p.name} className="place"
                       onClick={() => nav.go({ kind: 'place', name: p.name })}>
                    <img className="place-shot" src={shotOf(p.photo)} alt="" draggable="false" />
                    <div className="place-body">
                    <div className="place-top">
                      <span className="place-name">{p.name}</span>
                      <span className="place-cat">{p.category}</span>
                    </div>
                    <div className="place-meta">
                      <b>★ {p.rating}</b>
                      <span>리뷰 {p.reviews}</span>
                      <span>{p.hours}</span>
                    </div>
                    <div className="place-addr">{p.address}</div>
                    <div className="place-note">{p.note}</div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {firms.length > 0 && (
              <section className="rs-block">
                <h3 className="rs-head">기업정보</h3>
                {firms.map((c) => (
                  <div key={c.id} className="firm">
                    <div className="firm-top">
                      <span className="firm-name">{c.name}</span>
                      <span className="firm-en">{c.en}</span>
                    </div>
                    <div className="firm-meta">{c.field} · {c.since}년 설립 · {c.size}</div>
                    <div className="firm-addr">소재지 {c.address}</div>
                    <div className="firm-tel">대표번호 {c.tel}</div>
                    {c.url && <button className="firm-url" onClick={() => open(c.url)}>{c.url}</button>}
                  </div>
                ))}
              </section>
            )}

            {words.length > 0 && (
              <section className="rs-block">
                <h3 className="rs-head">용어사전</h3>
                {words.map((w) => (
                  <div key={w.id} className="dict">
                    <div className="dict-top">
                      <span className="dict-word">{w.word}</span>
                      <span className="dict-read">{w.reading}</span>
                    </div>
                    <p className="dict-body">{w.body}</p>
                  </div>
                ))}
              </section>
            )}

            {articles.length > 0 && (
              <section className="rs-block">
                <h3 className="rs-head">뉴스</h3>
                {articles.map((a) => (
                  <div key={a.id} className="news"
                       onClick={() => nav.go({ kind: 'news', id: a.id })}>
                    <div className="news-title">{a.title}</div>
                    <div className="news-by">{a.press} · {a.date}</div>
                    <div className="news-summary">{a.summary}</div>
                  </div>
                ))}
              </section>
            )}

            {answers.length > 0 && (
              <section className="rs-block">
                <h3 className="rs-head">지식Q&amp;A</h3>
                {answers.map((k) => (
                  <div key={k.id} className="qna">
                    <div className="qna-q"><b>Q.</b> {k.q}</div>
                    <div className="qna-by">{k.asker} · {k.date} · 답변 {k.answers}</div>
                    <div className="qna-a"><b>A.</b> {k.a}</div>
                  </div>
                ))}
              </section>
            )}

            {posts.length > 0 && (
              <section className="rs-block">
                <h3 className="rs-head">블로그</h3>
                {posts.map((b) => (
                  <div key={b.id} className="post"
                       onClick={() => nav.go({ kind: 'blog', id: b.id })}>
                    <div className="post-body">
                      <div className="post-title">{b.title}</div>
                      <div className="post-by">{b.blog} · {b.author} · {b.date}</div>
                      <div className="post-excerpt">{b.excerpt}</div>
                    </div>
                    <img className="post-shot" src={shotOf(b.photo)} alt="" draggable="false" />
                  </div>
                ))}
              </section>
            )}

            {hits.length > 0 && (
              <section className="rs-block">
                <h3 className="rs-head">사이트</h3>
                {hits.map((s) => (
                  <div key={s.url} className="result" onClick={() => open(s.url)}>
                    <div className="result-title">{s.title}</div>
                    <div className="result-url">{s.url}</div>
                  </div>
                ))}
              </section>
            )}

            {spots.length + firms.length + words.length + articles.length + answers.length + posts.length + hits.length === 0 && (
              <p className="results-none">검색 결과가 없습니다.</p>
            )}
          </div>
        )}

        {page.kind === 'news' && (() => {
          const a = news.find((x) => x.id === page.id)
          return (
            <article className="art">
              <div className="art-press">{a.press}</div>
              <h1>{a.title}</h1>
              <div className="art-by">{a.date} · {a.reporter}</div>
              {a.body.map((para, i) => <p key={i}>{para}</p>)}
            </article>
          )
        })()}

        {page.kind === 'place' && (
          <Place place={scenario.places.find((p) => p.name === page.name)} />
        )}

        {page.kind === 'blog' && (() => {
          const b = scenario.blogs.find((x) => x.id === page.id)
          return (
            <article className="bl">
              <div className="bl-head">
                <span className="bl-blog">{b.blog}</span>
                <span className="bl-by">{b.author} · {b.date}</span>
              </div>
              <h1>{b.title}</h1>
              {b.body.map((part, i) => (part.shot
                ? <img key={i} className="bl-shot" src={shotOf(part.shot)} alt="" draggable="false" />
                : <p key={i}>{part}</p>))}
              <div className="bl-tags">{b.tags.map((t) => <span key={t}>#{t}</span>)}</div>
            </article>
          )
        })()}

        {special === 'refused' && (
          <div className="site-error">
            <h2>사이트에 연결할 수 없음</h2>
            <p>{page.url} 에서 연결을 거부했습니다.</p>
            <p className="err-code">ERR_CONNECTION_REFUSED</p>
          </div>
        )}

        {view === 'error' && (
          <div className="site-error">
            <h2>사이트에 연결할 수 없음</h2>
            {/^\d+(\.\d+){3}$/.test(page.url) ? (
              <>
                <p>{page.url} 의 응답 시간이 너무 깁니다.</p>
                <p className="err-code">ERR_CONNECTION_TIMED_OUT</p>
              </>
            ) : (
              <>
                <p>{page.url} 의 서버 IP 주소를 찾을 수 없습니다.</p>
                <p className="err-code">ERR_NAME_NOT_RESOLVED</p>
              </>
            )}
          </div>
        )}

        {view === 'offline' && (
          <div className="site-error">
            <h2>인터넷에 연결되어 있지 않습니다</h2>
            <p>네트워크 주소를 받아오지 못했습니다. 공유기 설정을 확인하세요.</p>
            <p className="err-code">ERR_INTERNET_DISCONNECTED</p>
          </div>
        )}

        {lost && (
          <div className="site-error">
            <h2>404 — 페이지를 찾을 수 없습니다</h2>
            <p>{page.url}{page.path}</p>
            <p className="err-hint">{site.notFound ?? '주소를 다시 확인해 주세요.'}</p>
          </div>
        )}

        {view === 'down' && (
          <div className="site-error">
            <h2>이 페이지가 작동하지 않습니다</h2>
            <p>{page.url}에서 현재 요청을 처리할 수 없습니다.</p>
            <p className="err-code">HTTP ERROR 500</p>
          </div>
        )}

        {view === 'vpn' && (
          <div className="blk">
            <div className="blk-card">
              <Lock size={30} strokeWidth={1.6} />
              <h2>사내망 전용 페이지입니다</h2>
              <p>
                이 페이지는 사내망에서만 열람할 수 있습니다.<br />
                VPN 에 연결한 뒤 다시 시도해 주세요.
              </p>
              <div className="blk-help">바탕화면의 <b>AR VPN</b> 에서 연결할 수 있습니다.</div>
              <div className="blk-code">AR-NET-511 · {site.url}</div>
            </div>
          </div>
        )}

        {view === 'blocked' && (
          <div className="blk">
            <div className="blk-card">
              <Lock size={30} strokeWidth={1.6} />
              <h2>승인되지 않은 IP입니다</h2>
              <p>
                이 PC는 사내 시스템 접근 승인 목록에 없습니다.<br />
                장기 미접속 계정은 IP 승인이 만료될 수 있습니다.
              </p>
              <div className="blk-help">AR톡 &gt; <b>정보보안팀</b> 으로 문의해 주세요.</div>
              <div className="blk-code">AR-SEC-403 · {site.url}</div>
            </div>
          </div>
        )}
        {view === 'login' && <Login key={site.url} site={site} onOk={() => unlockSite(site.url)} />}

        {view === 'ready' && !lost && (
          site.layout === 'portal' ? <Portal site={site} path={page.path} onOpen={(p) => open(site.url + p)} />
            : site.layout === 'wiki' ? <Wiki site={site} path={page.path} />
            : site.layout === 'calendar' ? <Calendar site={site} />
            : site.layout === 'news' ? <News site={site} news={news} onOpen={(id) => nav.go({ kind: 'news', id })} />
              : site.layout === 'board' ? <Board site={site} />
              : site.layout === 'gov' ? <Gov site={site} />
              : site.layout === 'lotto' ? <Lotto site={site} />
              : site.layout === 'floor8' ? <Floor8 site={site} />
              : site.layout === 'notes' ? <Notes site={site} />
              : site.layout === 'vendor' ? <Vendor site={site} />
              : site.layout === 'router' ? <Router site={site} />
              : site.layout === 'printerweb' ? <PrinterWeb site={site} />
              : site.layout === 'phish' ? <Phish site={site} />
              : (
                <div className="site">
                  <h2>{site.title}</h2>
                  <pre className="site-body">{site.content}</pre>
                </div>
              )
        )}
      </div>
    </div>
  )
}

const DT_PANELS = ['Elements', 'Console', 'Sources', 'Network', 'Performance', 'Memory', 'Application', 'Security']

export function DevTools() {
  const { console: lines, network } = useGame((s) => s.browserDev)
  const [tab, setTab] = useState('Console')
  const errors = lines.filter((l) => l.level === 'error').length
  const warns = lines.filter((l) => l.level === 'warn').length
  return (
    <div className="devtools">
      <div className="dt-bar">
        <span className="dt-ico"><Code size={15} strokeWidth={1.8} /></span>
        <span className="dt-ico"><Monitor size={15} strokeWidth={1.8} /></span>
        <span className="dt-sep" />
        {DT_PANELS.map((p) => (
          <span key={p} className={'dt-tab' + (p === tab ? ' on' : '')}
                onClick={() => (p === 'Console' || p === 'Network') && setTab(p)}>{p}</span>
        ))}
        <span className="dt-tab dt-more">»</span>
        <span className="dt-badges">
          {errors > 0 && <span className="dt-badge error">{errors}</span>}
          {warns > 0 && <span className="dt-badge warn">{warns}</span>}
        </span>
        <span className="dt-ico"><Settings size={15} strokeWidth={1.8} /></span>
        <span className="dt-ico"><MoreVertical size={15} strokeWidth={1.8} /></span>
      </div>
      <div className="dt-bar dt-sub">
        <span className="dt-ico">⊘</span>
        <span className="dt-sep" />
        <span className="dt-top">top <ChevronDown size={12} strokeWidth={2} /></span>
        <span className="dt-filter"><Search size={12} strokeWidth={2} />Filter</span>
        <span className="dt-top">Default levels <ChevronDown size={12} strokeWidth={2} /></span>
        <span className="dt-ico"><Settings size={15} strokeWidth={1.8} /></span>
      </div>
      {tab === 'Console' ? (
        <div className="dt-log">
          {lines.map((l, i) => (
            <div key={i} className={'dt-line ' + l.level}>
              <span className="dt-text">{l.text}</span>{l.at && <span className="dt-at">{l.at}</span>}
            </div>
          ))}
          <div className="dt-prompt"><ChevronRight size={14} strokeWidth={2} /></div>
        </div>
      ) : (
        <div className="dt-log">
          <table className="dt-net">
            <thead><tr><th>Name</th><th>Status</th><th>Type</th><th>Size</th><th>Time</th></tr></thead>
            <tbody>
              {network.map((r, i) => (
                <tr key={i} className={r.status === '(failed)' || r.status >= 400 ? 'bad' : ''}>
                  <td>{r.name}</td><td>{r.status}</td><td>{r.type}</td><td>{r.size}</td><td>{r.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// What the network tab lists: the page itself first, then what it pulled in.
// A site that is down answers 500 on the document; one that does not resolve
// never answers at all.
export function networkRows(page, site, view) {
  const host = page.kind === 'site' ? page.url : 'daon.com'
  const doc = (status, size, time) => ({ name: page.kind === 'search' ? `search?q=${page.q}` : host, status, type: 'document', size, time })
  const asset = (name, type, size, time) => ({ name, status: 200, type, size, time })
  const favicon = { name: 'favicon.ico', status: 404, type: 'x-icon', size: '0 B', time: '9 ms' }
  switch (view) {
    case 'down': return [doc(500, '512 B', '812 ms'), asset('style.css', 'stylesheet', '18.4 kB', '31 ms'), favicon]
    case 'error': case 'vpn': return [doc('(failed)', '0 B', '21 ms')]
    case 'blocked': return [doc(403, '1.1 kB', '64 ms')]
    case 'login': return [doc(200, '3.9 kB', '92 ms'), asset('login.css', 'stylesheet', '6.2 kB', '18 ms'), asset('auth.js', 'script', '41.0 kB', '37 ms')]
    case 'ready': return [doc(200, '12.7 kB', '118 ms'), asset('style.css', 'stylesheet', '18.4 kB', '31 ms'), asset('app.js', 'script', '76.3 kB', '44 ms'), favicon]
    default: return [doc(200, '14.2 kB', '118 ms'), asset('main.css', 'stylesheet', '31.0 kB', '24 ms'), asset('search.js', 'script', '88.4 kB', '41 ms'), asset('logo.svg', 'svg+xml', '3.1 kB', '12 ms')]
  }
}

// What the console shows: a broken site's own errors while it is broken;
// otherwise the quiet lines any page logs.
function consoleLines(page, site, view) {
  if (view === 'down') return site.console ?? []
  const url = page.kind === 'site' ? page.url : page.kind === 'search' ? `daon.com/search?q=${page.q}` : 'daon.com'
  return [
    { level: 'log', text: `Navigated to https://${url}/` },
    { level: 'log', text: 'DOMContentLoaded 42ms · load 118ms' },
    ...(view === 'error' ? [{ level: 'error', text: `GET https://${url}/ net::ERR_NAME_NOT_RESOLVED` }] : [])
  ]
}
