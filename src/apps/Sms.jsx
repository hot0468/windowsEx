import { useGame } from '../engine/store.js'

// 문자. 지금은 인증번호만 온다 — 폰에만 있는 앱이라, 같은 번호가 메일로도
// 가야 PC 로 하는 사람이 막히지 않는다. 여기는 그것을 폰답게 보는 자리다.
export default function Sms() {
  const sms = useGame((s) => s.sms)
  return (
    <div className="sm">
      {sms.length === 0 && <p className="sm-none">받은 문자가 없습니다</p>}
      {sms.map((m, i) => (
        <div key={i} className="sm-row">
          <div className="sm-head"><b>{m.from}</b><span>{m.day}일차 {m.at}</span></div>
          <p className="sm-text">{m.text}</p>
        </div>
      ))}
    </div>
  )
}
