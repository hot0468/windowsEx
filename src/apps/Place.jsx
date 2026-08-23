import { useState } from 'react'
import { useGame } from '../engine/store.js'
import { shotOf } from '../assets/photos.js'
import { Check, Clock, Star } from '../icons/line.jsx'

const CODE = () => 'RV-' + Math.floor(1000 + Math.random() * 9000)

function Booking({ place, onDone }) {
  const form = useGame((s) => s.scenario.booking)
  const book = useGame((s) => s.book)
  const [time, setTime] = useState(form.times[4])
  const [party, setParty] = useState(form.parties[1])

  const confirm = () => {
    const details = { date: form.date, time, party, code: CODE() }
    book(place.name, details)
    onDone(details)
  }

  return (
    <div className="pl-book">
      <h3>예약하기</h3>
      <div className="pl-field"><span>날짜</span><b>{form.date}</b></div>
      <div className="pl-field">
        <span>시간</span>
        <div className="pl-chips">
          {form.times.map((t) => (
            <button key={t} className={'pl-chip' + (t === time ? ' on' : '')}
                    onClick={() => setTime(t)}>{t}</button>
          ))}
        </div>
      </div>
      <div className="pl-field">
        <span>인원</span>
        <div className="pl-chips">
          {form.parties.map((n) => (
            <button key={n} className={'pl-chip' + (n === party ? ' on' : '')}
                    onClick={() => setParty(n)}>{n}</button>
          ))}
        </div>
      </div>
      <button className="pl-confirm" onClick={confirm}>{time} · {party} 예약하기</button>
    </div>
  )
}

function Done({ place, details }) {
  const form = useGame((s) => s.scenario.booking)
  const [copied, setCopied] = useState(false)

  const text = form.template
    .replace('{place}', place.name).replace('{date}', details.date)
    .replace('{time}', details.time).replace('{party}', details.party)
    .replace('{code}', details.code)

  const share = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)   // the box below stays selectable either way
    }
  }

  return (
    <div className="pl-done">
      <div className="pl-done-mark"><Check size={26} strokeWidth={3} /></div>
      <h3>예약이 확정되었습니다</h3>
      <pre className="pl-ticket">{text}</pre>
      <button className="pl-share" onClick={share}>공유하기</button>
      <p className="pl-copied">
        {copied ? '내용이 복사되었습니다. 붙여넣기 해보세요.' : '복사한 내용을 메신저에 붙여넣을 수 있습니다.'}
      </p>
    </div>
  )
}

export default function Place({ place }) {
  const booked = useGame((s) => s.bookings[place?.name])
  const [tab, setTab] = useState('홈')
  const [booking, setBooking] = useState(false)
  const [done, setDone] = useState(null)

  if (!place) return <div className="pl-none">가게 정보를 찾을 수 없습니다.</div>
  const tabs = ['홈', ...(place.menu ? ['메뉴'] : []), ...(place.posts ? ['리뷰'] : [])]

  return (
    <div className="pl">
      <div className="pl-head">
        <span className="pl-badge">place+</span>
        <h1>{place.name}</h1>
        <div className="pl-meta">
          {place.category.split(',')[0]} · <b><Star size={12} strokeWidth={2.6} /> {place.rating}</b> · 리뷰 {place.reviews}
        </div>
        <div className="pl-hours"><Clock size={12} strokeWidth={2} />{place.hours}</div>
        <div className="pl-addr">{place.address}</div>

        {place.bookable && !done && (
          <button className="pl-cta" onClick={() => setBooking(true)}>
            {booked ? '예약 내역 보기' : '예약'}
          </button>
        )}
      </div>

      <img className="pl-shot" src={shotOf(place.photo)} alt="" draggable="false" />

      {done && <Done place={place} details={done} />}
      {!done && booking && <Booking place={place} onDone={setDone} />}
      {!done && !booking && booked && (
        <div className="pl-book"><h3>예약 내역</h3>
          <div className="pl-field"><span>일시</span><b>{booked.date} {booked.time}</b></div>
          <div className="pl-field"><span>인원</span><b>{booked.party}</b></div>
          <div className="pl-field"><span>예약번호</span><b>{booked.code}</b></div>
          <button className="pl-confirm" onClick={() => setDone(booked)}>확인 내용 보기</button>
        </div>
      )}

      <div className="pl-tabs">
        {tabs.map((t) => (
          <button key={t} className={'pl-tab' + (t === tab ? ' on' : '')} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === '홈' && <p className="pl-note">{place.note}</p>}
      {tab === '메뉴' && (
        <ul className="pl-menu">
          {place.menu.map(([name, price]) => (
            <li key={name}><span>{name}</span><b>{price}원</b></li>
          ))}
        </ul>
      )}
      {tab === '리뷰' && (
        <ul className="pl-reviews">
          {place.posts.map(([who, score, body], i) => (
            <li key={i}>
              <div className="pl-review-top"><b>{who}</b><span>{'★'.repeat(Number(score))}</span></div>
              <p>{body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
