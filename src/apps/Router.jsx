// The office router's admin page: nothing to configure, everything to read.
export default function Router({ site }) {
  const r = site.router
  return (
    <div className="rt">
      <div className="rt-top">
        <span className="rt-brand">{r.brand}</span>
        <span className="rt-model">{r.model}</span>
        <span className="rt-admin">{r.admin}</span>
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
        {r.notes.map((n, i) => <p key={i} className="rt-foot">{n}</p>)}
      </div>
    </div>
  )
}
