import { useState } from 'react'
import { useGame } from '../engine/store.js'

// The copier's embedded web page. The receipt number is not here — that
// only comes out of the copier itself, once it prints. One queued document
// was never meant for this floor, and printing it is remembered.
export default function PrinterWeb({ site }) {
  const printer = useGame((s) => s.scenario.printer)
  const network = useGame((s) => s.scenario.network)
  const grants = useGame((s) => s.grants)
  const grant = useGame((s) => s.grant)
  const foundMissing = useGame((s) => s.foundMissing)
  // The print failed because this PC was never registered with the copier —
  // something a screen can actually fix, unlike a paper jam.
  const fixed = useGame((s) => s.mfpFixed)
  const registerMfp = useGame((s) => s.registerMfp)
  const [addr, setAddr] = useState('')
  const [said, setSaid] = useState(null)
  const [shown, setShown] = useState(null)
  const w = site.printerweb
  const r = printer.remote
  const register = () => {
    if (!addr.trim()) return
    setSaid(registerMfp(addr))
  }
  const print = (q) => {
    setShown(q)
    grant(q.grants)
    if (q.found) foundMissing()
  }
  const stateOf = (q) => !q.printable ? q.state
    : grants[q.grants] ? w.print.printed
    : <>{q.state} <button className="pw-print" onClick={() => print(q)}>{w.print.label}</button></>
  return (
    <div className="pw">
      <div className="pw-top">
        <span className="pw-brand">{w.brand}</span>
        <span className="pw-model">{printer.name}</span>
      </div>
      <div className="pw-body">
        <div className={'pw-status' + (fixed ? ' ok' : '')}>
          <span className="pw-dot" />
          {fixed
            ? <>정상 — {printer.remote.cleared}</>
            : <><b>{printer.error.code}</b> {printer.error.text} — {w.stateNote}</>}
        </div>

        <h3>{r.title}</h3>
        <p className="pw-note">{r.note}</p>
        <table className="pw-table">
          <thead><tr>{r.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {w.devices.map((dv) => (
              <tr key={dv.ip}><td>{dv.name}</td><td>{dv.ip}</td><td>{dv.note}</td></tr>
            ))}
            {fixed && (
              <tr><td>{network.host}</td><td>{network.ip}</td><td>등록됨</td></tr>
            )}
          </tbody>
        </table>

        {fixed ? (
          <div className="pw-receipt">
            {r.receiptLabel} <b>{printer.receipt}</b>
          </div>
        ) : (
          <div className="pw-reg">
            <label>
              {r.label}
              <input value={addr} onChange={(e) => { setAddr(e.target.value); setSaid(null) }}
                     onKeyDown={(e) => e.key === 'Enter' && register()}
                     placeholder={r.placeholder} spellCheck={false} />
            </label>
            <button className="pw-print" onClick={register}>{r.button}</button>
            {said === 'bad' && <p className="pw-wrong">{r.bad}</p>}
            <p className="pw-note">{r.hint}</p>
          </div>
        )}
        <dl className="pw-stats">
          {w.stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          <div><dt>토너</dt><dd><span className="pw-bar"><i style={{ width: w.toner + '%' }} /></span>{w.toner}%</dd></div>
        </dl>
        <h3>인쇄 대기열</h3>
        <table className="pw-table">
          <thead><tr><th>문서</th><th>보낸 PC</th><th>상태</th></tr></thead>
          <tbody>
            {w.queue.map((q, i) => <tr key={i}><td>{q.doc}</td><td>{q.from}</td><td>{stateOf(q)}</td></tr>)}
          </tbody>
        </table>
        {shown && (
          <>
            <h3>{w.print.title}</h3>
            <div className="pw-doc">{shown.pages.map((l, i) => <p key={i}>{l}</p>)}</div>
          </>
        )}
        <h3>오류 로그</h3>
        <ul className="pw-log">{w.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </div>
    </div>
  )
}
