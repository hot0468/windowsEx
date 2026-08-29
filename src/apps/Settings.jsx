import { useState } from 'react'
import { useGame, savedAt } from '../engine/store.js'
import { RotateCcw, Save, Clock } from '../icons/line.jsx'

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

export default function Settings() {
  const saveGame = useGame((s) => s.saveGame)
  const loadGame = useGame((s) => s.loadGame)
  const newGame = useGame((s) => s.newGame)
  const day = useGame((s) => s.day)
  const [saved, setSaved] = useState(() => savedAt())
  const [asking, setAsking] = useState(null)

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
    </div>
  )
}
