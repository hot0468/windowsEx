import { useEffect, useState } from 'react'
import { useGame, hostResolves } from '../engine/store.js'
import { play } from '../shell/sound.js'

// The client only knows how to dial a name. Whether that name means anything
// is the hosts file's business, so a broken tunnel looks like DNS, not like
// a wrong password.
export default function Vpn() {
  const scenario = useGame((s) => s.scenario)
  const edits = useGame((s) => s.edits)
  const connected = useGame((s) => s.vpn)
  const setVpn = useGame((s) => s.setVpn)
  const v = scenario.vpn
  const [dialing, setDialing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!dialing) return
    const t = setTimeout(() => {
      setDialing(false)
      setVpn(true)
      play('ok')
    }, 1800)
    return () => clearTimeout(t)
  }, [dialing])

  const connect = () => {
    if (!hostResolves(scenario, edits, v.server)) {
      play('error')
      return setError(v.notFound)
    }
    setError('')
    setDialing(true)
  }
  const drop = () => {
    setVpn(false)
    play('click')
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
