import { useGame } from '../engine/store.js'

// The copier's embedded web page. The receipt number is not here — that
// only comes out of the copier itself, once it prints.
export default function PrinterWeb({ site }) {
  const printer = useGame((s) => s.scenario.printer)
  const w = site.printerweb
  return (
    <div className="pw">
      <div className="pw-top">
        <span className="pw-brand">{w.brand}</span>
        <span className="pw-model">{printer.name}</span>
      </div>
      <div className="pw-body">
        <div className="pw-status">
          <span className="pw-dot" />
          <b>{printer.error.code}</b> {printer.error.text} — {w.stateNote}
        </div>
        <dl className="pw-stats">
          {w.stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          <div><dt>토너</dt><dd><span className="pw-bar"><i style={{ width: w.toner + '%' }} /></span>{w.toner}%</dd></div>
        </dl>
        <h3>인쇄 대기열</h3>
        <table className="pw-table">
          <thead><tr><th>문서</th><th>보낸 PC</th><th>상태</th></tr></thead>
          <tbody>
            {w.queue.map((q, i) => <tr key={i}><td>{q.doc}</td><td>{q.from}</td><td>{q.state}</td></tr>)}
          </tbody>
        </table>
        <h3>오류 로그</h3>
        <ul className="pw-log">{w.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </div>
    </div>
  )
}
