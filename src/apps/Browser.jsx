import { useState } from 'react'
import { useGame, searchSites } from '../engine/store.js'
import Portal from './Portal.jsx'
import { Clock, House, Lock, MoreVertical, Search, Star } from '../icons/line.jsx'

const clean = (u) => u.trim().replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()

export default function Browser() {
  const scenario = useGame((s) => s.scenario)
  const wikiUnlocked = useGame((s) => s.wikiUnlocked)
  const unlockWiki = useGame((s) => s.unlockWiki)
  const [addr, setAddr] = useState('')
  const [page, setPage] = useState({ kind: 'home' })
  const [q, setQ] = useState('')
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)
  const [menu, setMenu] = useState(false)

  const open = (raw) => {
    const url = clean(raw)
    setAddr(url)
    setPage(url ? { kind: 'site', url } : { kind: 'home' })
    setPw('')
    setPwError(false)
    setMenu(false)
  }

  const submitSearch = () => {
    if (!q.trim()) return
    setAddr('')
    setPage({ kind: 'search', q: q.trim() })
  }

  const site = page.kind === 'site' ? scenario.sites.find((s) => s.url === page.url) : null
  const locked = Boolean(site?.password) && !wikiUnlocked
  const hits = page.kind === 'search' ? searchSites(scenario.sites, page.q) : []

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

      <div className={'page' + (site && !locked && site.layout === 'portal' ? ' bleed' : '')}>
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
            <p className="results-head">'{page.q}' 검색 결과 {hits.length}건</p>
            {hits.map((s) => (
              <div key={s.url} className="result" onClick={() => open(s.url)}>
                <div className="result-title">{s.title}</div>
                <div className="result-url">{s.url}</div>
              </div>
            ))}
            {hits.length === 0 && <p className="results-none">검색 결과가 없습니다.</p>}
          </div>
        )}

        {page.kind === 'site' && !site && (
          <div className="site-error">
            <h2>사이트에 연결할 수 없음</h2>
            <p>{page.url} 의 서버 IP 주소를 찾을 수 없습니다.</p>
            <p className="err-code">ERR_NAME_NOT_RESOLVED</p>
          </div>
        )}

        {locked && (
          <div className="wiki-lock">
            <h2><Lock size={22} strokeWidth={1.8} /> {site.title}</h2>
            <p>{site.passwordHint}</p>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && (pw === site.password ? unlockWiki() : setPwError(true))}
                   placeholder="비밀번호" aria-label="비밀번호" />
            <button className="btn-primary"
                    onClick={() => (pw === site.password ? unlockWiki() : setPwError(true))}>
              로그인
            </button>
            {pwError && <p className="pw-error">비밀번호가 올바르지 않습니다.</p>}
          </div>
        )}

        {site && !locked && (site.layout === 'portal' ? <Portal site={site} /> : (
          <div className="site">
            <h2>{site.title}</h2>
            <pre className="site-body">{site.content}</pre>
          </div>
        ))}
      </div>
    </div>
  )
}
