import { useState } from 'react'
import { useGame } from '../engine/store.js'

export default function Browser() {
  const scenario = useGame((s) => s.scenario)
  const wikiUnlocked = useGame((s) => s.wikiUnlocked)
  const unlockWiki = useGame((s) => s.unlockWiki)
  const [url, setUrl] = useState('')
  const [current, setCurrent] = useState(null)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)

  const go = (u) => {
    const clean = u.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
    setUrl(clean)
    setCurrent(clean || null)
    setPw('')
    setPwError(false)
  }
  const tryLogin = (site) => (pw === site.password ? unlockWiki() : setPwError(true))
  const site = current ? scenario.sites.find((s) => s.url === current) : null

  return (
    <div className="browser">
      <div className="addr-bar">
        <button onClick={() => go('')} title="홈">🏠</button>
        <input value={url} onChange={(e) => setUrl(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && go(url)}
               placeholder="주소를 입력하세요" spellCheck={false} />
      </div>
      <div className="page">
        {!current && (
          <div className="newtab">
            <h2>새 탭</h2>
            <h4>즐겨찾기</h4>
            <div className="tiles">
              {scenario.bookmarks.map((b) => (
                <button key={b.url} className="tile" onClick={() => go(b.url)}>⭐ {b.title}</button>
              ))}
            </div>
            <h4>방문 기록</h4>
            {scenario.history.map((h, i) => (
              <div key={i} className="hist" onClick={() => go(h.url)}>
                🕘 {h.title} <span className="hist-url">{h.url}</span>
                <span className="hist-date">{h.date}</span>
              </div>
            ))}
          </div>
        )}
        {current && !site && (
          <div className="site-error">
            <h2>사이트에 연결할 수 없음</h2>
            <p>{current} 의 서버 IP 주소를 찾을 수 없습니다.</p>
            <p className="err-code">ERR_NAME_NOT_RESOLVED</p>
          </div>
        )}
        {site && site.password && !wikiUnlocked && (
          <div className="wiki-lock">
            <h2>🔒 {site.title}</h2>
            <p>{site.passwordHint}</p>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && tryLogin(site)} placeholder="비밀번호" />
            <button className="btn-primary" onClick={() => tryLogin(site)}>로그인</button>
            {pwError && <p className="pw-error">비밀번호가 올바르지 않습니다.</p>}
          </div>
        )}
        {site && (!site.password || wikiUnlocked) && (
          <div className="site">
            <h2>{site.title}</h2>
            <pre className="site-body">{site.content}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
