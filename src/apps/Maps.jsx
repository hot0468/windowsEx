import { useState } from 'react'
import { useGame } from '../engine/store.js'
import { Search, Star } from '../icons/line.jsx'

// 지도. 브라우저의 장소 검색과 같은 자료(scenario.places)를 폰답게 본다 —
// 목록이 아니라 자리로. 걸어서 갈 수 있는 거리의 가게들이라 길 하나에
// 늘어세우는 것이 실제 이 동네의 모양이다.
//
// 좌표는 주소가 정한다: 테헤란로 번지수가 가로 자리, 골목(길)로 들어간 곳은
// 큰길에서 떨어뜨린다. 없는 자리를 지어내지 않으므로 같은 주소는 늘 같은 곳에 선다.
const num = (address) => Number(address.match(/(\d+)(?!.*\d)/)?.[1] ?? 0)
const isAlley = (address) => /\d+길/.test(address)

function spotOf(place, all) {
  const ns = all.map((p) => num(p.address)).filter(Boolean)
  const lo = Math.min(...ns)
  const hi = Math.max(...ns)
  const n = num(place.address)
  const x = n ? 10 + ((n - lo) / Math.max(1, hi - lo)) * 78 : 50
  // 큰길 가게는 길 위아래에 붙고, 골목 가게는 더 내려간다.
  const seed = [...place.name].reduce((a, c) => a + c.charCodeAt(0), 0)
  const side = seed % 2 ? -1 : 1
  const y = isAlley(place.address) ? 62 + (seed % 18) : 50 + side * (9 + (seed % 8))
  return { left: x + '%', top: y + '%' }
}

const PIN = (category) => (
  /카페|디저트/.test(category) ? '☕'
    : /약국/.test(category) ? '＋'
      : /은행/.test(category) ? '₩'
        : /편의점/.test(category) ? '24'
          : /헬스|피트니스/.test(category) ? '⤒'
            : /호프|맥주|펍|포장마차/.test(category) ? '맥'
              : '밥'
)

export default function Maps() {
  const scenario = useGame((s) => s.scenario)
  const openWindow = useGame((s) => s.openWindow)
  const pushScreen = useGame((s) => s.pushScreen)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)

  const places = scenario.places ?? []
  const hits = q.trim()
    ? places.filter((p) => (p.name + p.category + p.address + (p.tags ?? []).join(' ')).includes(q.trim()))
    : places
  const place = places.find((p) => p.name === open)

  return (
    <div className="mp">
      <div className="mp-search">
        <Search size={16} strokeWidth={1.9} />
        <input value={q} onChange={(e) => setQ(e.target.value)} spellCheck={false}
               placeholder="장소, 주소 검색" aria-label="장소 검색" />
      </div>

      <div className="mp-canvas">
        {/* 큰길 하나와 골목 둘. 실제로 이 사람이 걸어 다니는 범위가 이만큼이다. */}
        <div className="mp-road" />
        <div className="mp-road v" style={{ left: '22%' }} />
        <div className="mp-road v" style={{ left: '68%' }} />
        <div className="mp-road-name">테헤란로</div>

        {/* 회사. 지도에서 기준이 되는 자리는 늘 여기다. */}
        <div className="mp-here" style={{ left: '46%', top: '42%' }}>
          <i />AR빌딩
        </div>

        {hits.map((p) => (
          <button key={p.name} className={'mp-pin' + (open === p.name ? ' on' : '')}
                  style={spotOf(p, places)} onClick={() => setOpen(p.name)}>
            <span className="mp-pin-dot">{PIN(p.category)}</span>
            <em>{p.name}</em>
          </button>
        ))}
        {hits.length === 0 && <p className="mp-none">찾는 곳이 없습니다</p>}
      </div>

      {place && (
        <div className="mp-sheet">
          <button className="mp-sheet-x" onClick={() => setOpen(null)} aria-label="닫기">✕</button>
          <div className="mp-sheet-name">{place.name}</div>
          <div className="mp-sheet-cat">{place.category}</div>
          <dl className="mp-sheet-rows">
            <div><dt>주소</dt><dd>{place.address}</dd></div>
            {place.hours && <div><dt>영업시간</dt><dd>{place.hours}</dd></div>}
            {place.rating && (
              <div>
                <dt>평점</dt>
                <dd><Star size={12} strokeWidth={2} />{place.rating} · 리뷰 {place.reviews}</dd>
              </div>
            )}
          </dl>
          {place.note && <p className="mp-sheet-note">{place.note}</p>}
          {/* 자세한 것(메뉴·후기·예약)은 이미 장소 페이지가 들고 있다. 두 벌로
              만들지 않고 그쪽으로 보낸다. */}
          <button className="mp-sheet-go"
                  onClick={() => {
                    openWindow('browser', { start: { kind: 'place', name: place.name } })
                    pushScreen('app:browser')
                  }}>
            장소 페이지 열기
          </button>
        </div>
      )}
    </div>
  )
}
