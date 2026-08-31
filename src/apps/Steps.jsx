import { useGame } from '../engine/store.js'

// 폰이 주머니에 있는 동안 세어 둔 걸음. 이 앱은 아무것도 설명하지 않는다 —
// 숫자만 보여 주고, 읽는 사람이 알아채면 알아채는 것이다.
export const WALK_LAST = '2026-07-23'
const FROM = '2026-07-11'
const TO = '2026-08-23'

// 하루치 걸음. 날짜에서 뽑으므로 다시 열어도 같은 값이 나온다 — 만보기가
// 볼 때마다 다른 수를 말하면 그건 만보기가 아니다.
const hash = (str) => {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

const eachDay = (from, to) => {
  const out = []
  const d = new Date(from + 'T00:00:00Z')
  const end = new Date(to + 'T00:00:00Z')
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

// 걸음은 평일에 많고 주말에 적다. 출퇴근이 걸음의 대부분인 사람의 그래프다.
export function stepsOf(scenario, from = FROM, to = TO) {
  const anchor = scenario?.days?.[0]?.date ?? ''
  return eachDay(from, to).map((date) => {
    if (date > WALK_LAST) return { date, steps: 0 }
    const h = hash(date + anchor)
    const weekend = [0, 6].includes(new Date(date + 'T00:00:00Z').getUTCDay())
    const base = weekend ? 2600 : 7400
    return { date, steps: base + (h % (weekend ? 2400 : 4200)) }
  })
}

const md = (date) => {
  const [, m, d] = date.split('-')
  return `${+m}/${+d}`
}

export default function Steps() {
  const scenario = useGame((s) => s.scenario)
  const days = stepsOf(scenario)
  const recent = days.slice(-14)
  const top = Math.max(...recent.map((d) => d.steps), 1)
  const walked = days.filter((d) => d.steps > 0)
  const total = walked.reduce((n, d) => n + d.steps, 0)
  const best = walked.reduce((a, b) => (b.steps > a.steps ? b : a), walked[0])
  const today = days[days.length - 1]

  return (
    <div className="sp">
      <header className="sp-head">
        <span className="sp-today">{today.steps.toLocaleString()}</span>
        <span className="sp-unit">걸음</span>
        <p className="sp-when">오늘 · {md(today.date)}</p>
      </header>

      <section className="sp-chart">
        <h2>최근 2주</h2>
        <ol>
          {recent.map((d) => (
            <li key={d.date} title={`${md(d.date)} · ${d.steps.toLocaleString()}걸음`}>
              <i style={{ height: `${Math.round((d.steps / top) * 100)}%` }}
                 className={d.steps ? '' : 'zero'} />
              <span>{md(d.date)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="sp-sum">
        <div>
          <dt>기록이 있는 날</dt>
          <dd>{walked.length}일</dd>
        </div>
        <div>
          <dt>하루 평균</dt>
          <dd>{Math.round(total / Math.max(walked.length, 1)).toLocaleString()}걸음</dd>
        </div>
        <div>
          <dt>가장 많이 걸은 날</dt>
          <dd>{md(best.date)} · {best.steps.toLocaleString()}걸음</dd>
        </div>
      </section>

      <p className="sp-foot">걸음은 휴대폰을 지니고 있을 때만 기록됩니다.</p>
    </div>
  )
}
