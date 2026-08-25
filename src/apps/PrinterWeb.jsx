import { useState } from 'react'
import { useGame } from '../engine/store.js'

// The copier's embedded web page. The receipt number is not here — that
// only comes out of the copier itself, once it prints. One queued document
// was never meant for this floor, and printing it is remembered.
export default function PrinterWeb({ site }) {
  const printer = useGame((s) => s.scenario.printer)
  const grants = useGame((s) => s.grants)
  const grant = useGame((s) => s.grant)
  const foundMissing = useGame((s) => s.foundMissing)
  // Clearing the jam is remote maintenance sent from this page — the only
  // hands in this game are the ones on the keyboard.
  const step = useGame((s) => s.mfpStep)
  const fixed = useGame((s) => s.mfpFixed)
  const sendMfp = useGame((s) => s.sendMfp)
  const [missed, setMissed] = useState(false)
  const [shown, setShown] = useState(null)
  const w = site.printerweb
  const send = (id) => setMissed(sendMfp(id) === 0)
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

        <h3>{printer.remote.title}</h3>
        <p className="pw-note">{printer.remote.note}</p>
        {fixed ? (
          <div className="pw-receipt">
            {printer.remote.receiptLabel} <b>{printer.receipt}</b>
          </div>
        ) : (
          <>
            <div className="pr-steps">
              {printer.steps.map((_, i) => <i key={i} className={i < step ? 'on' : ''} />)}
            </div>
            <div className="pw-cmds">
              {printer.buttons.map((b) => (
                <button key={b.id} onClick={() => send(b.id)}>{b.label}</button>
              ))}
            </div>
            {missed && <p className="pw-wrong">{printer.remote.wrong}</p>}
          </>
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
