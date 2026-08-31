import { useEffect, useRef, useState } from 'react'
import { useGame } from '../engine/store.js'
import { Phone, PhoneOff, Send } from '../icons/line.jsx'

// 전화. 폰에만 있는 앱이다 — 메일로 묻던 것을 목소리로 묻는 자리이자,
// 하루에 한두 번 남이 먼저 거는 자리.
//
// 통화 중 화면은 이 앱 안에 있지만, 걸려오는 전화의 벨은 App 의 오버레이가
// 울린다(다른 앱을 보고 있어도 울려야 하므로).
const TABS = [['recent', '최근 기록'], ['contacts', '연락처'], ['keypad', '키패드']]
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

// 통화 화면은 앱 안이 아니라 화면 전체를 덮는다(App 의 오버레이가 그린다) —
// 통화 중에 홈으로 나가거나 다른 앱으로 넘어갈 수 없어야 한다. 실제 폰은
// 나갈 수 있지만, 여기서는 통화가 곧 하나의 장면이다.
export function CallScreen() {
  const call = useGame((s) => s.call)
  const hangUp = useGame((s) => s.hangUp)
  const sayOnCall = useGame((s) => s.sayOnCall)
  const [text, setText] = useState('')
  const tail = useRef(null)

  useEffect(() => { tail.current?.scrollIntoView({ block: 'end' }) }, [call?.said.length])

  // 울리는 중(수신)은 Ringing 이 그린다. 통화가 없으면 이 자리는 비어 있다.
  if (!call || call.stage === 'ringing') return null

  const say = () => {
    if (!text.trim()) return
    sayOnCall(text.trim())
    setText('')
  }

  // 신호가 가는 동안, 그리고 끊긴 뒤 잠깐. 둘 다 통화가 아니라서 말할 칸이 없다.
  if (call.stage !== 'talking') {
    const ended = call.stage === 'ended'
    return (
      <div className="cl-talk cl-calling">
        <div className="cl-who">
          <div className="cl-who-name">{call.name}</div>
          <div className="cl-who-num">{call.number}</div>
          <div className={'cl-state' + (ended ? ' off' : '')}>
            {ended ? '통화가 종료되었습니다' : '전화 거는 중입니다'}
          </div>
        </div>
        {!ended && (
          <button className="cl-end" onClick={hangUp}>
            <PhoneOff size={20} strokeWidth={1.9} />통화 종료
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="cl-talk">
      <div className="cl-who">
        <div className="cl-who-name">{call.name}</div>
        <div className="cl-who-num">{call.number} · 통화 중</div>
      </div>
      <div className="cl-said">
        {call.said.map((line, i) => (
          <p key={i} className={line.them ? 'cl-them' : 'cl-me'}>{line.text}</p>
        ))}
        {/* 아직 할 말이 남았다. 톡의 '입력 중'과 같은 자리다. */}
        {call.speaking && (
          <p className="cl-them cl-speaking" aria-label="말하는 중">
            <i /><i /><i />
          </p>
        )}
        <span ref={tail} />
      </div>
      {call.asking && (
        <div className="cl-say">
          <input value={text} autoFocus placeholder="말할 내용을 입력하세요" aria-label="말할 내용"
                 onChange={(e) => setText(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && say()} />
          <button className="btn-primary" onClick={say} aria-label="말하기">
            <Send size={16} strokeWidth={1.9} />
          </button>
        </div>
      )}
      <button className="cl-end" onClick={hangUp}>
        <PhoneOff size={20} strokeWidth={1.9} />통화 종료
      </button>
    </div>
  )
}

// 목록의 한 줄. 눌러야 펼쳐지고, 전화는 펼친 뒤 한 번 더 눌러야 걸린다 —
// 이름을 스치듯 눌렀다고 전화가 걸리면 안 된다.
function Row({ title, sub, note, open, onOpen, onCall }) {
  return (
    <div className={'cl-item' + (open ? ' open' : '')}>
      <button className="cl-row" onClick={onOpen}>
        <span className="cl-row-mid">
          <b>{title}</b>
          <em>{sub}</em>
        </span>
        {note && <span className="cl-row-day">{note}</span>}
      </button>
      {open && (
        <div className="cl-actions">
          <button className="cl-call" onClick={onCall}>
            <Phone size={17} strokeWidth={1.9} />전화 걸기
          </button>
        </div>
      )}
    </div>
  )
}

export default function Dial() {
  const scenario = useGame((s) => s.scenario)
  const callLog = useGame((s) => s.callLog)
  const dial = useGame((s) => s.dial)
  const [tab, setTab] = useState('recent')
  const [typed, setTyped] = useState('')
  // 펼쳐 놓은 줄 하나. 전화 버튼은 그 줄에만 있다.
  const [open, setOpen] = useState(null)

  // 통화 중이면 오버레이가 화면을 덮고 있다 — 목록은 그 뒤에 그대로 둔다.

  const contacts = scenario.calls?.contacts ?? []
  const people = scenario.calls?.people ?? []
  // 일로 아는 사람과 그냥 아는 사람. 실제 폰의 연락처처럼 한 목록에 있되
  // 무리는 나눠 둔다.
  const groups = [
    ['업무', [...people.filter((p) => p.group === '업무'), ...contacts]],
    ['개인', people.filter((p) => p.group !== '업무')]
  ]
  // 키패드에 다 누르고 나면 누구인지 알려 준다 — 목록에 없는 번호(eggs)도
  // 여기서는 이름이 뜬다. 눌러 본 사람에게 주는 대답이다.
  const nameOf = (number) => [...contacts, ...people, ...scenario.calls?.eggs ?? []]
    .find((c) => c.number.replace(/[^0-9]/g, '') === number.replace(/[^0-9]/g, ''))?.name

  return (
    <div className="cl">
      <div className="cl-tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={'cl-tab' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'recent' && (
        <div className="cl-list">
          {callLog.length === 0 && <p className="cl-none">통화 기록이 없습니다</p>}
          {callLog.map((c, i) => (
            <Row key={i} open={open === 'r' + i} onOpen={() => setOpen(open === 'r' + i ? null : 'r' + i)}
                 onCall={() => dial(c.number)}
                 title={c.name} sub={c.number}
                 note={`${c.dir === 'missed' ? '부재중' : c.dir === 'in' ? '수신' : '발신'} · ${c.day}일차`} />
          ))}
        </div>
      )}

      {tab === 'contacts' && (
        <div className="cl-list">
          {groups.map(([label, rows]) => rows.length > 0 && (
            <div key={label}>
              <div className="cl-group">{label}</div>
              {rows.map((c) => (
                <Row key={c.id} open={open === c.id} onOpen={() => setOpen(open === c.id ? null : c.id)}
                     onCall={() => dial(c.number)}
                     title={c.name} sub={c.org ? `${c.org} · ${c.number}` : c.number} />
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === 'keypad' && (
        <div className="cl-pad">
          <div className="cl-typed">{typed || <i>번호를 누르세요</i>}</div>
          <div className="cl-keys">
            {KEYS.map((k) => (
              <button key={k} onClick={() => setTyped((t) => t + k)}>{k}</button>
            ))}
          </div>
          <div className="cl-pad-row">
            <button className="cl-back" onClick={() => setTyped((t) => t.slice(0, -1))}
                    disabled={!typed}>지우기</button>
            <button className="cl-go" onClick={() => { dial(typed); setTyped('') }} disabled={!typed}>
              {nameOf(typed) ?? '전화 걸기'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
