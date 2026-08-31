import { useEffect, useRef, useState } from 'react'
import {
  hostResolves, latestNews, looksLikeAddress, parseAddress, pathKnown, resolveSite, searchAds, searchBlogs, searchCompanies, searchNews, searchPlaces, searchQna, searchSites, searchTerms, siteView, specialPage, useGame, visibleByDay, addressHints} from '../engine/store.js'
import Place from './Place.jsx'
import TilePhoto from './TilePhoto.jsx'
import Portal from './Portal.jsx'
import Calendar from './Calendar.jsx'
import News, { Article } from './News.jsx'
import Wiki from './Wiki.jsx'
import Drive from './Drive.jsx'
import Board from './Board.jsx'
import Gov from './Gov.jsx'
import Lotto from './Lotto.jsx'
import Floor8 from './Floor8.jsx'
import Notes from './Notes.jsx'
import Card from './Card.jsx'
import Vendor from './Vendor.jsx'
import Corp from './Corp.jsx'
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

// start: 창이 처음부터 가 있을 자리. 마지막 장면이 사고 기사를 띄울 때
// 쓴다 — 그 밖에는 늘 첫 화면에서 시작한다.
export default function Browser({ start }) {
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
  const myBookmarks = useGame((s) => s.myBookmarks)
  const visited = useGame((s) => s.visited)
  const noteVisit = useGame((s) => s.noteVisit)
  const toggleBookmark = useGame((s) => s.toggleBookmark)
  const [addr, setAddr] = useState('')
  const nav = useHistory(start ?? { kind: 'home' })
  const page = nav.at
  const pageRef = useRef(null)
  const [q, setQ] = useState('')
  // 주소창 제안. 이미 아는 곳만 내민다 — 근거는 addressHints 주석에.
  const [hintAt, setHintAt] = useState(-1)
  const [typing, setTyping] = useState(false)
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
    const t = raw.trim()
    const typed = t.startsWith('/') && page.kind === 'site' ? page.url + t : raw
    setMenu(false)
    // 주소로 읽히지 않는 것은 검색어다. 실제 브라우저의 주소창이 그렇다.
    if (t && !t.startsWith('/') && !looksLikeAddress(scenario, edits, typed)) {
      setQ(t)
      return nav.go({ kind: 'search', q: t })
    }
    const { host, path } = parseAddress(typed)
    setAddr(host + path)
    nav.go(host ? { kind: 'site', url: host, path } : { kind: 'home' })
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
    setAddr(page.kind === 'site' ? page.url + (page.path ?? '') : page.kind === 'search' ? page.q : '')
  }, [page])
  // 새 쪽으로 가면 맨 위부터 읽는다. 기사 아래의 관련 기사를 누르고 나서
  // 화면이 그 자리에 머물면 다음 기사의 한복판이 열린 것처럼 보인다 —
  // 링크가 어디로 가든 같은 문제라, 창을 여는 곳 한 군데에서 한 번만 되돌린다.
  // ponytail: 뒤로 가기도 맨 위로 간다. 실제 브라우저처럼 읽던 자리를 되살리려면
  // 방문 기록이 스크롤 위치를 함께 들고 다녀야 한다(folderNav.js의 useHistory).
  useEffect(() => { if (pageRef.current) pageRef.current.scrollTop = 0 }, [page])
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
  // 실제로 열린 곳만 남는다. 막혔거나 못 찾은 주소는 기록이 아니다.
  useEffect(() => {
    if (page.kind === 'site' && view === 'ready' && site) noteVisit(site.url + (page.path ?? ''), site.title)
  }, [page, site, view])

  // 회사가 깔아 둔 것 뒤에 플레이어가 얹은 것이 붙는다. 이름은 사이트가
  // 스스로 말하는 제목을 쓴다 — 소통방은 '소통방'으로 실린다.
  const marks = [
    ...scenario.bookmarks,
    ...myBookmarks
      .filter((u) => !scenario.bookmarks.some((b) => b.url === u))
      .map((u) => ({ url: u, title: scenario.sites.find((s) => s.url === u)?.title ?? u }))
  ]
  // 주소창에 치는 동안 내미는 곳. 보고 있는 주소 그대로면 내밀 것이 없다.
  const here = page.kind === 'site' ? page.url + (page.path ?? '') : ''
  const hints = typing && addr !== here
    ? addressHints(addr, { visited, bookmarks: marks, history: scenario.history })
    : []

  const canMark = page.kind === 'site' && Boolean(site) && view === 'ready'
  const fixedMark = canMark && scenario.bookmarks.some((b) => b.url === site.url)
  const marked = canMark && marks.some((b) => b.url === site.url)

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
        <input value={addr}
               onChange={(e) => { setAddr(e.target.value); setTyping(true); setHintAt(-1) }}
               onBlur={() => setTimeout(() => setTyping(false), 120)}
               onKeyDown={(e) => {
                 if (e.key === 'Escape') return setTyping(false)
                 if (e.key === 'ArrowDown' && hints.length) {
                   e.preventDefault()
                   return setHintAt((i) => (i + 1) % hints.length)
                 }
                 if (e.key === 'ArrowUp' && hints.length) {
                   e.preventDefault()
                   return setHintAt((i) => (i <= 0 ? hints.length : i) - 1)
                 }
                 if (e.key !== 'Enter') return
                 setTyping(false)
                 const pick = hints[hintAt]
                 if (pick) return pick.blog ? nav.go({ kind: 'blog', id: pick.blog }) : open(pick.url)
                 open(addr)
               }}
               placeholder="주소를 입력하세요" aria-label="주소" spellCheck={false} />
        {hints.length > 0 && (
          <div className="bw-hints">
            {hints.map((h, i) => (
              <button key={h.url} className={'bw-hint' + (i === hintAt ? ' on' : '')}
                      onMouseEnter={() => setHintAt(i)}
                      onPointerDown={(e) => {
                        e.preventDefault()
                        setTyping(false)
                        h.blog ? nav.go({ kind: 'blog', id: h.blog }) : open(h.url)
                      }}>
                <Clock size={13} strokeWidth={1.7} />
                <span className="bw-hint-mid"><span>{h.title}</span><span className="bw-pop-url">{h.url}</span></span>
              </button>
            ))}
          </div>
        )}
        {/* 열려 있는 곳만 즐겨찾기에 얹는다 — 주소만 쳐 넣고 못 들어간 곳을
            담아 두면 북마크 바가 가 본 적 없는 데를 가리킨다. 회사가 깔아 둔
            셋은 뺄 수 없다. */}
        <button className={'bw-star' + (marked ? ' on' : '')} disabled={!canMark || fixedMark}
                onClick={() => toggleBookmark(site.url)}
                title={fixedMark ? '기본 즐겨찾기' : marked ? '즐겨찾기에서 빼기' : '즐겨찾기에 추가'}
                aria-label={marked ? '즐겨찾기에서 빼기' : '즐겨찾기에 추가'}>
          <Star size={16} strokeWidth={1.9} />
        </button>
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
              {visited.length > 0 && (
                <>
                  <div className="bw-pop-head">이번 주</div>
                  {visited.slice(0, 6).map((h) => (
                    <button key={h.url} className="bw-pop-item"
                            onClick={() => { setMenu(false); open(h.url) }}>
                      <Clock size={14} strokeWidth={1.7} />
                      <span className="bw-pop-mid">
                        <span>{h.title}</span>
                        <span className="bw-pop-url">{h.url}</span>
                      </span>
                      <span className="bw-pop-date">{h.day}일차</span>
                    </button>
                  ))}
                </>
              )}
              <div className="bw-pop-head">휴가 전</div>
              {scenario.history.map((h, i) => (
                <button key={i} className="bw-pop-item"
                        onClick={() => { setMenu(false); h.blog ? nav.go({ kind: 'blog', id: h.blog }) : open(h.url) }}>
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
        {marks.map((b) => (
          <button key={b.url} className="bm" onClick={() => open(b.url)}>{b.title}</button>
        ))}
      </div>

      <div ref={pageRef} className={'page' + ((page.kind === 'blog' || page.kind === 'place' || page.kind === 'news' || (view && view !== 'error')) ? ' bleed' : '')}>
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
          // 기사는 그 기사를 실은 신문 지면 안에서 읽힌다 — 목록으로 돌아가는
          // 길이 화면 안에 있어야 뒤로 가기만 남지 않는다.
          const paper = scenario.sites.find((x) => x.layout === 'news')
          return (
            <Article a={a} site={paper} news={news}
                     onOpen={(id) => nav.go({ kind: 'news', id })}
                     onHome={() => open(paper.url)} />
          )
        })()}

        {page.kind === 'place' && (
          <Place place={scenario.places.find((p) => p.name === page.name)} />
        )}

        {page.kind === 'blog' && <BlogPost id={page.id} />}

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
          site.layout === 'portal' ? <Portal site={site} path={page.path} onOpen={(p) => open(site.url + p)} onGo={open} />
            : site.layout === 'wiki' ? <Wiki site={site} path={page.path} />
            : site.layout === 'drive' ? <Drive site={site} path={page.path} />
            : site.layout === 'calendar' ? <Calendar site={site} />
            : site.layout === 'news' ? <News site={site} news={news} onOpen={(id) => nav.go({ kind: 'news', id })} />
              : site.layout === 'board' ? <Board site={site} />
              : site.layout === 'gov' ? <Gov site={site} />
              : site.layout === 'lotto' ? <Lotto site={site} />
              : site.layout === 'floor8' ? <Floor8 site={site} />
              : site.layout === 'notes' ? <Notes site={site} />
              : site.layout === 'card' ? <Card site={site} />
              : site.layout === 'vendor' ? <Vendor site={site} />
              : site.layout === 'corp' ? <Corp site={site} />
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

// Somebody else's month, posted before the holiday that never happened. On the
// one post the dream borrowed from, reaching the last line is what counts —
// the same way the obituary waits to be scrolled to rather than merely opened.
const BlogPost = ({ id }) => {
  const b = useGame((s) => s.scenario.blogs.find((x) => x.id === id))
  const shots = useGame((s) => s.scenario.nineGates?.shots)
  const tileOf = (tileId) => shots?.find((x) => x.id === tileId)
  const borrowed = useGame((s) => s.scenario.dream?.blog === id)
  const readDream = useGame((s) => s.readDream)
  const end = useRef(null)
  useEffect(() => {
    if (!borrowed) return
    // without the observer the photos still have to be reachable
    if (!end.current || !window.IntersectionObserver) return readDream()
    const io = new IntersectionObserver(([e]) => e.isIntersecting && readDream())
    io.observe(end.current)
    return () => io.disconnect()
  }, [id, borrowed])
  return (
    <article className="bl">
      <div className="bl-head">
        <span className="bl-blog">{b.blog}</span>
        <span className="bl-by">{b.author} · {b.date}</span>
      </div>
      <h1>{b.title}</h1>
      {b.body.map((part, i) => {
        if (part.tile) {
          const shot = tileOf(part.tile)
          return shot ? <TilePhoto key={i} shot={shot} className="bl-shot" /> : null
        }
        return part.shot
          ? <img key={i} className="bl-shot" src={shotOf(part.shot)} alt="" draggable="false" />
          : <p key={i}>{part}</p>
      })}
      <div className="bl-tags">{b.tags.map((t) => <span key={t}>#{t}</span>)}</div>
      {borrowed && <i ref={end} className="bl-end" aria-hidden="true" />}
    </article>
  )
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
