import { useState } from 'react'
import { useGame, serialFits, CLUE } from '../engine/store.js'

// The lottery site: type the serial number printed on the slip, get told what
// it won. The winning ticket is worth a fortune nobody has come to collect.
export default function Lotto({ site }) {
  const lotto = site.lotto
  const grant = useGame((s) => s.grant)
  const won = useGame((s) => Boolean(s.grants.lotto))
  // Someone who has read their own obituary cannot be the person at the counter.
  const gone = useGame((s) => Boolean(s.grants[CLUE.mail]))
  const [serial, setSerial] = useState('')
  const [result, setResult] = useState(null)

  const check = () => {
    const ok = serialFits(lotto, serial)
    setResult(!ok ? 'none' : gone ? 'gone' : 'win')
    if (ok && !gone) grant('lotto')
  }

  return (
    <div className="lt">
      <div className="lt-top">
        <span className="lt-logo">{lotto.name}</span>
        <span className="lt-nav">로또 6/45 · 연금복권 · 스피또 · 당첨확인</span>
      </div>
      <div className="lt-banner">
        <b>{lotto.round}회</b> 1등 당첨금 <b>{lotto.prize}</b> 미수령 — 지급 기한 {lotto.deadline}
        <span>당첨금은 당첨자 본인이 신분증과 당첨 복권을 지참하고 농협은행 본점을 방문해야 수령할 수 있습니다.</span>
      </div>

      <div className="lt-card">
        <h2>일련번호 당첨확인</h2>
        <p className="lt-sub">복권 용지 하단에 인쇄된 일련번호(숫자 16자리)를 입력해 주세요.</p>
        <label className="lt-field">
          <span>일련번호</span>
          <input value={serial} onChange={(e) => { setSerial(e.target.value); setResult(null) }}
                 onKeyDown={(e) => e.key === 'Enter' && serial.trim() && check()}
                 placeholder="0000-0000-0000-0000" spellCheck={false} className="lt-serial" />
        </label>
        <button className="lt-btn" disabled={!serial.trim()} onClick={check}>당첨 확인</button>

        {result === 'none' && (
          <div className="lt-result"><p>일치하는 복권이 없습니다. 일련번호를 다시 확인해 주세요.</p></div>
        )}
        {result === 'gone' && (
          <div className="lt-result">
            <p className="lt-win" style={{ color: '#666' }}>1등 당첨 복권입니다</p>
            <p>그러나 당첨자 본인 확인이 불가하여 지급할 수 없습니다.</p>
            <p className="lt-note">{lotto.gone}</p>
          </div>
        )}
        {result === 'win' && (
          <div className="lt-result win">
            <p className="lt-win">🎉 1등 당첨</p>
            <p>{lotto.round}회 · 추첨일 {lotto.drawn} · 당첨금 <b>{lotto.prize}</b></p>
            <p className="lt-note">{lotto.claim}</p>
          </div>
        )}
        {won && !result && <p className="lt-note">이 복권은 이미 1등으로 확인되었습니다. 지급 기한 {lotto.deadline}.</p>}
      </div>

      <div className="lt-foot">
        일련번호는 용지 하단 바코드 아래에 있습니다 · 고객센터 1588-6450
      </div>
    </div>
  )
}
