import { useState } from 'react'
import { useGame } from '../engine/store.js'

// The office router's admin page, logged in as admin/admin. Two things can be
// changed: the password (wise) and the DHCP server (the floor goes dark).
export default function Router({ site }) {
  const r = site.router
  const st = r.settings
  const down = useGame((s) => s.routerDown)
  const secured = useGame((s) => Boolean(s.grants.router_secured))
  const breakRouter = useGame((s) => s.breakRouter)
  const fixRouter = useGame((s) => s.fixRouter)
  const secureRouter = useGame((s) => s.secureRouter)
  const [pw, setPw] = useState('')
  const [note, setNote] = useState('')
  const changePw = () => {
    if (pw.trim().toLowerCase() === 'admin') return setNote(st.password.weak)
    secureRouter()
    setPw('')
    setNote(st.password.done)
  }
  return (
    <div className="rt">
      <div className="rt-top">
        <span className="rt-brand">{r.brand}</span>
        <span className="rt-model">{r.model}</span>
        <span className="rt-admin">{secured ? r.adminSecured : r.admin}</span>
      </div>
      <div className="rt-body">
        <dl className="rt-stats">
          {r.stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
        <h3>접속 기기 ({r.devices.length})</h3>
        <table className="rt-table">
          <thead><tr><th>이름</th><th>IP 주소</th><th>MAC 주소</th><th>비고</th></tr></thead>
          <tbody>
            {r.devices.map((d) => (
              <tr key={d.ip}>
                <td>{d.name}</td><td>{d.ip}</td><td className="rt-mac">{d.mac}</td><td className="rt-note">{d.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>{st.title}</h3>
        <div className="rt-set">
          <span>{st.password.label}</span>
          <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder={st.password.placeholder}
                 aria-label={st.password.label} onKeyDown={(e) => e.key === 'Enter' && pw.trim() && changePw()} />
          <button onClick={changePw} disabled={!pw.trim()}>{st.password.button}</button>
          {note && <em>{note}</em>}
        </div>
        <div className="rt-set">
          <span>{st.dhcp.label}</span>
          <b className={down ? 'off' : ''}>{down ? st.dhcp.off : st.dhcp.on}</b>
          <button onClick={down ? fixRouter : breakRouter}>{down ? st.dhcp.start : st.dhcp.stop}</button>
          {!down && <em>{st.dhcp.warn}</em>}
        </div>
        {r.notes.map((n, i) => <p key={i} className="rt-foot">{n}</p>)}
      </div>
    </div>
  )
}
