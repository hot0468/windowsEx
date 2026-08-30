import { useState } from 'react'
import { useGame, savedAt } from '../engine/store.js'
import { RotateCcw, Save, Clock } from '../icons/line.jsx'
import { ping } from './Cmd.jsx'

// 게임 자체를 다루는 자리 — 저장 · 불러오기 · 처음부터. 데스크톱은 시작
// 메뉴가 이 셋을 들고 있지만 폰에는 시작 메뉴가 없다. 홈에 흩어 두는 대신
// 설정 앱 하나에 모은다.
const CONFIRM = {
  new: '진행 중인 게임을 버리고 처음부터 시작합니다. 저장한 게임은 그대로 남습니다.',
  load: '저장한 시점으로 되돌아갑니다. 지금까지의 진행 상황은 사라집니다.'
}

const when = (at) => {
  if (!at) return '아직 저장한 적이 없습니다'
  const d = new Date(at)
  const p = (v) => String(v).padStart(2, '0')
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 폰에는 명령 프롬프트가 없다. PC가 ipconfig 로 말해 주던 것들을 여기서
// 읽는다 — 값은 같은 자리(scenario.network)에서 오므로 어느 쪽으로 보든
// 같은 답이 나온다. 순서는 ipconfig /all 이 찍던 순서 그대로다.
export const NET_ROWS = (n) => [
  ['기기 이름', n.host],
  ['사용자', n.user],
  ['어댑터', n.adapter],
  ['연결별 DNS 접미사', n.dns],
  ['IPv4 주소', n.ip],
  ['서브넷 마스크', n.mask],
  ['기본 게이트웨이', n.gateway],
  ['물리적 주소', n.mac]
]

export default function Settings() {
  const saveGame = useGame((s) => s.saveGame)
  const loadGame = useGame((s) => s.loadGame)
  const newGame = useGame((s) => s.newGame)
  const day = useGame((s) => s.day)
  const net = useGame((s) => s.scenario.network)
  const [saved, setSaved] = useState(() => savedAt())
  const [asking, setAsking] = useState(null)
  const [host, setHost] = useState('')
  const [echo, setEcho] = useState(null)

  if (asking) {
    return (
      <div className="st">
        <div className="st-ask">
          <p>{CONFIRM[asking]}</p>
          <div className="st-ask-row">
            <button className="btn-primary"
                    onClick={() => (asking === 'new' ? newGame() : loadGame())}>예</button>
            <button className="sm-cancel" onClick={() => setAsking(null)}>아니오</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="st">
      <div className="st-head">
        <div className="st-day">{day}일차</div>
        <div className="st-when"><Clock size={12} strokeWidth={2} />마지막 저장 · {when(saved)}</div>
      </div>

      <div className="st-group">
        <div className="st-group-name">게임</div>
        <button className="st-item" onClick={() => { saveGame(); setSaved(Date.now()) }}>
          <Save size={17} strokeWidth={1.8} />
          <span><b>저장</b><em>지금 상태를 남깁니다</em></span>
        </button>
        <button className="st-item" disabled={!saved} onClick={() => setAsking('load')}>
          <RotateCcw size={17} strokeWidth={1.8} />
          <span><b>불러오기</b><em>{saved ? '저장한 시점으로 되돌아갑니다' : '저장한 게임이 없습니다'}</em></span>
        </button>
        <button className="st-item st-danger" onClick={() => setAsking('new')}>
          <RotateCcw size={17} strokeWidth={1.8} />
          <span><b>처음부터</b><em>1일차 아침으로 돌아갑니다</em></span>
        </button>
      </div>

      {/* 폰에 마운트된 회사 PC. 드라이브만 보이던 것에 상태 한 장을 더한다. */}
      <div className="st-group st-net">
        <div className="st-group-name">내 PC 연결 정보</div>
        <dl className="st-net-rows">
          {NET_ROWS(net).map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      </div>

      <div className="st-group st-net">
        <div className="st-group-name">응답 확인</div>
        <div className="st-ping">
          <input value={host} spellCheck={false} placeholder="주소 또는 호스트 이름"
                 aria-label="응답을 확인할 주소"
                 onChange={(e) => setHost(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && setEcho(ping(net, host.trim()))} />
          <button className="btn-primary" onClick={() => setEcho(ping(net, host.trim()))}>보내기</button>
        </div>
        {echo && (
          <div className="st-echo">
            {echo.map((line, i) => <div key={i}>{line || ' '}</div>)}
          </div>
        )}
      </div>
    </div>
  )
}
