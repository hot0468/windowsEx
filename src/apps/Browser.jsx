import { useState } from 'react'
import { useGame, searchPlaces, searchSites, siteView } from '../engine/store.js'
import Portal from './Portal.jsx'
import Wiki from './Wiki.jsx'
import { Clock, House, Lock, MoreVertical, Search, Star } from '../icons/line.jsx'
import Icon from '../icons/Icon.jsx'

const clean = (u) => u.trim().replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()

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
  const [addr, setAddr] = useState('')
  const [page, setPage] = useState({ kind: 'home' })
  const [q, setQ] = useState('')
  const [menu, setMenu] = useState(false)

  const open = (raw) => {
    const url = clean(raw)
    setAddr(url)
    setPage(url ? { kind: 'site', url } : { kind: 'home' })
    setMenu(false)
  }

  const submitSearch = () => {
    if (!q.trim()) return
    setAddr('')
    setPage({ kind: 'search', q: q.trim() })
  }

  const site = page.kind === 'site' ? scenario.sites.find((s) => s.url === page.url) : null
  const view = page.kind === 'site' ? siteView(site, { grants, unlocked }) : null
  const hits = page.kind === 'search' ? searchSites(scenario.sites, page.q) : []
  const spots = page.kind === 'search' ? searchPlaces(scenario.places, page.q) : []

  return (
    <div className="browser">
      <div className="addr-bar">
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

      <div className={'page' + (view && view !== 'error' ? ' bleed' : '')}>
        {page.kind === 'home' && (
          <div className="portal">
            <div className="portal-logo">{scenario.portal.name}</div>
            <div className="portal-search">
              <Search size={18} strokeWidth={1.9} />
              <input value={q} onChange={(e) => setQ(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
                     placeholder="검색어를 입력하세요" aria-label="검색어" spellCheck={false} />
              <button className="btn-primary" onClick={submitSearch}>검색</button>
            </div>
          </div>
        )}

        {page.kind === 'search' && (
          <div className="results">
            <p className="results-head">
              '{page.q}' 검색 결과 {spots.length + hits.length}건
            </p>

            {spots.length > 0 && (
              <section className="rs-block">
                <h3 className="rs-head"><Icon name="globe" size={15} />장소</h3>
                {spots.map((p) => (
                  <div key={p.name} className="place">
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

            {spots.length + hits.length === 0 && (
              <p className="results-none">검색 결과가 없습니다.</p>
            )}
          </div>
        )}

        {view === 'error' && (
          <div className="site-error">
            <h2>사이트에 연결할 수 없음</h2>
            <p>{page.url} 의 서버 IP 주소를 찾을 수 없습니다.</p>
            <p className="err-code">ERR_NAME_NOT_RESOLVED</p>
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
              <div className="blk-help">한빛톡 &gt; <b>정보보안팀</b> 으로 문의해 주세요.</div>
              <div className="blk-code">HANBIT-SEC-403 · {site.url}</div>
            </div>
          </div>
        )}
        {view === 'login' && <Login key={site.url} site={site} onOk={() => unlockSite(site.url)} />}

        {view === 'ready' && (
          site.layout === 'portal' ? <Portal site={site} />
            : site.layout === 'wiki' ? <Wiki site={site} />
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
