// 대화를 열었을 때 이번 주 것만 보이고 그 이전은 '이전 메시지'로 접히게 하려면,
// 접을 기록을 날짜 단위로 나눠 두어야 한다. 한 날짜의 대화가 중간에 끊겨
// 올라오면 읽는 흐름이 깨지므로 묶음은 날짜를 가로지르지 않는다.
const MAX_PER_CHUNK = 12   // 한 번에 올라오는 최대 줄 수
const KEEP_ALL_UNDER = 8   // 이보다 짧은 기록은 접을 것도 없다

// 지난 기록은 `date`를, 이번 주 메시지는 `day`를 갖는다 (`threadMessages` 참조).
const isHistory = (m) => m.day === undefined

// 접을 묶음들. 빈 배열이면 접지 않고 전부 보여준다는 뜻이다.
// 오래된 것부터 담기므로, 펼치기는 뒤에서부터 꺼내면 최근 것부터 올라온다.
export const historyChunks = (messages = []) => {
  // 이번 주가 없는 대화 — 공지방, 강 사장님, 알림 스레드 — 는 접지 않는다.
  // 접으면 대화창이 빈 채로 열린다.
  if (!messages.some((m) => !isHistory(m))) return []

  const history = messages.filter(isHistory)
  if (history.length <= KEEP_ALL_UNDER) return []

  // 같은 날짜끼리 먼저 모은다.
  const days = []
  for (const m of history) {
    const date = m.date ?? '(무표기)'
    if (days[days.length - 1]?.date !== date) days.push({ date, items: [] })
    days[days.length - 1].items.push(m)
  }

  // 최근 쪽부터 12줄까지 채워 나간다. 첫 번째로 올라올 묶음이 가장 최근이어야
  // 하기 때문에 뒤에서 앞으로 채운다.
  const chunks = []
  let chunk = []
  for (let i = days.length - 1; i >= 0; i--) {
    const { items } = days[i]
    if (chunk.length && chunk.length + items.length > MAX_PER_CHUNK) {
      chunks.unshift(chunk)
      chunk = []
    }
    chunk = [...items, ...chunk]
  }
  if (chunk.length) chunks.unshift(chunk)
  return chunks
}
