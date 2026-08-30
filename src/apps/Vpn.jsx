import { useState } from 'react'
import { useGame } from '../engine/store.js'
import { play } from '../shell/sound.js'

// The client only knows how to dial a name. Whether that name means anything
// is the hosts file's business, so a broken tunnel looks like DNS, not like
// a wrong password.
export default function Vpn() {
  const scenario = useGame((s) => s.scenario)
  const connected = useGame((s) => s.vpn)
  const dialing = useGame((s) => s.vpnDialing)
  const dialVpn = useGame((s) => s.dialVpn)
  const drop = useGame((s) => s.dropVpn)
  const v = scenario.vpn
  const [error, setError] = useState('')

  // 연결 자체는 store 가 한다 — 트레이 팝오버도 같은 길을 쓴다. 이 창은 왜 안 되는지만 말한다.
  const connect = () => {
    if (!dialVpn()) {
      play('error')
      return setError(v.notFound)
    }
    setError('')
  }

  const state = connected ? '연결됨' : dialing ? '연결 중' : '연결 안 됨'

  return (
    <div className="vp">
      <div className="vp-head">
        <span className={'vp-dot ' + (connected ? 'on' : dialing ? 'busy' : 'off')} />
        <span className="vp-state">{state}</span>
      </div>

      <dl className="vp-meta">
        <div><dt>서버</dt><dd>{v.server}</dd></div>
        <div><dt>계정</dt><dd>{v.account}</dd></div>
        {connected && <div><dt>할당 IP</dt><dd>{v.ip}</dd></div>}
        {connected && <div><dt>세션 ID</dt><dd className="vp-session">{v.session}</dd></div>}
      </dl>

      {dialing && <p className="vp-busy">{v.connecting}</p>}
      {error && <p className="vp-err">{error}</p>}

      <div className="vp-foot">
        {connected
          ? <button className="sm-cancel" onClick={drop}>연결 끊기</button>
          : <button className="btn-primary" onClick={connect} disabled={dialing}>연결</button>}
      </div>
    </div>
  )
}
