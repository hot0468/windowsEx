import { useRef, useState } from 'react'
import { useGame, objectiveDone, requestsOf } from '../engine/store.js'
import { isMuted, play, setMuted } from './sound.js'
import { pullDir } from './useViewport.js'
import { Check, ShieldCheck, Volume, VolumeOff, Wifi, WifiOff } from '../icons/line.jsx'

// 상단에서 내리는 알림창. 안드로이드의 그것처럼 오늘 할 일과 스위치가 같이
// 산다 — 폰에는 데스크톱의 Progress도 트레이도 없으므로, 앱을 보고 있는
// 동안 오늘 뭐가 남았는지 · VPN이 켜져 있는지 볼 곳이 여기밖에 없다.
export default function PhoneShade({ onClose, lifting = false }) {
  // 미는 손짓의 시작점. state 로 두면 같은 프레임의 move 가 옛 값을 읽는다.
  const pull = useRef(null)
  const scenario = useGame((s) => s.scenario)
  const day = useGame((s) => s.day)
  const grants = useGame((s) => s.grants)
  const unlocked = useGame((s) => s.unlocked)
  const overtime = useGame((s) => s.overtime)
  const drawn = useGame((s) => s.drawn)
  const ripples = useGame((s) => s.ripples)
  const closing = useGame((s) => s.closing)
  const awaiting = useGame((s) => Boolean(s.awaitingCaller))
  const closeDay = useGame((s) => s.closeDay)
  const routerDown = useGame((s) => s.routerDown)
  const vpn = useGame((s) => s.vpn)
  const vpnDialing = useGame((s) => s.vpnDialing)
  const dialVpn = useGame((s) => s.dialVpn)
  const dropVpn = useGame((s) => s.dropVpn)
  const [quiet, setQuiet] = useState(isMuted())
  const [err, setErr] = useState('')

  const state = { grants, unlocked }
  const list = requestsOf(scenario, day, overtime, drawn, ripples)
  const done = list.filter((o) => objectiveDone(o, state))
  const today = scenario.days[day - 1]
  const finished = done.length === list.length

  // 데스크톱 트레이와 같은 길(dialVpn)을 쓴다 — hosts 에 이름이 없으면
  // 여기서도 똑같이 연결되지 않아야 퍼즐이 산다.
  const toggleVpn = () => {
    if (vpn) return dropVpn()
    if (dialVpn()) return setErr('')
    play('error')
    setErr(scenario.vpn.notFound)
  }

  return (
    <div className={'ph-shade-wrap' + (lifting ? ' lifting' : '')}
         onPointerDown={(e) => {
           // 바깥의 어두운 자리를 누르면 그대로 닫힌다(예전 그대로).
           if (e.target === e.currentTarget) return onClose()
           // 할 일 목록은 그 안에서 스크롤한다 — 거기서 시작한 손짓은 받지 않는다.
           pull.current = e.target.closest?.('.ph-todo') ? null : { y: e.clientY, x: e.clientX }
         }}
         onPointerMove={(e) => {
           const g = pull.current
           if (!g) return
           if (pullDir({ dy: e.clientY - g.y, dx: e.clientX - g.x }, 24) === -1) {
             pull.current = null
             onClose()
           }
         }}
         onPointerUp={() => { pull.current = null }}
         onPointerCancel={() => { pull.current = null }}>
      {/* 내린 것과 같은 손짓으로 올려 닫는다. 할 일 목록 안에서 시작한
          손짓은 목록 스크롤이므로 건드리지 않는다. */}
      <div className={'ph-shade' + (lifting ? ' lifting' : '')}
>
        <div className="ph-tiles">
          {Boolean(grants.vpnInstalled) && (
            <button className={'ph-tile' + (vpn ? ' on' : '')} disabled={vpnDialing}
                    role="switch" aria-checked={vpn} onClick={toggleVpn}>
              <ShieldCheck size={19} strokeWidth={1.8} />
              <span>AR VPN</span>
              <i>{vpn ? '연결됨' : vpnDialing ? '연결 중…' : '꺼짐'}</i>
            </button>
          )}
          <span className={'ph-tile flat' + (routerDown ? ' warn' : '')}>
            {routerDown ? <WifiOff size={19} strokeWidth={1.8} /> : <Wifi size={19} strokeWidth={1.8} />}
            <span>사내망</span>
            <i>{routerDown ? '연결 없음' : '연결됨'}</i>
          </span>
          <button className={'ph-tile' + (quiet ? '' : ' on')}
                  role="switch" aria-checked={!quiet}
                  onClick={() => { setMuted(!quiet); setQuiet(!quiet); if (quiet) play('click') }}>
            {quiet ? <VolumeOff size={19} strokeWidth={1.8} /> : <Volume size={19} strokeWidth={1.8} />}
            <span>소리</span>
            <i>{quiet ? '꺼짐' : '켜짐'}</i>
          </button>
        </div>
        {err && <p className="ph-shade-err">{err}</p>}

        <div className="ph-shade-head">
          <span>{day}일차 · {today.date} · {today.label}{overtime[day] && ' · 야근'}</span>
          <span><b>{done.length}</b>/{list.length}</span>
        </div>
        <ul className="ph-todo">
          {list.map((o) => {
            const ok = objectiveDone(o, state)
            return (
              <li key={o.id} className={ok ? 'ok' : ''}>
                <span className="ph-todo-mark">{ok && <Check size={12} strokeWidth={3} />}</span>
                {o.title}
              </li>
            )
          })}
        </ul>
        <button className="ph-shade-end" disabled={!finished || closing || awaiting}
                onClick={() => { closeDay(); onClose() }}>
          {awaiting ? '읽지 않은 메시지가 있습니다'
            : finished ? '오늘 업무 마치기' : '남은 업무가 있습니다'}
        </button>
        <button className="ph-shade-grip" onClick={onClose} aria-label="닫기"><i /></button>
      </div>
    </div>
  )
}
