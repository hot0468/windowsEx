// 잡담. 요청이 걸려 있지 않을 때 아무 말이나 걸면 상대가 반응한다.
// 아무것도 주지 않는다 — 목표도 힌트도 없고, 틀린 답으로도 세지 않는다.
//
// 고르는 규칙만 여기 있다(순수 함수). 화면도 저장소도 모르므로 그대로 검사한다.

// 말에서 군더더기를 걷는다. '밥 먹었어?' 와 '밥먹었어' 가 같은 말이 되게.
export const plain = (text) => String(text ?? '').replace(/[\s?!.,~…]/g, '').toLowerCase()

// 이 말이 건드리는 화제. 낱말 조각이 그대로 들어 있으면 그 화제다 —
// 첫 번째로 걸리는 것을 쓴다(먼저 적힌 화제가 그 사람에게 더 가깝다).
export const topicOf = (talk, text) => {
  const said = plain(text)
  if (!said) return null
  return (talk?.topics ?? []).find((t) => (t.when ?? []).some((w) => said.includes(plain(w)))) ?? null
}

// 무엇을 말할까. said 는 지금까지 이 대화에 건 말들(최근 것이 뒤).
//
//   ① 아까도 한 말이면 그것부터 짚는다 — 같은 대답을 두 번 하는 것보다 낫다
//   ② 화제를 알아들으면 그 화제의 말을
//   ③ 아니면 맞장구를 하나씩 돌려 가며
//
// n 은 이 대화에서 몇 번째 잡담인가. 같은 줄이 연달아 나오지 않게 돌린다.
export function replyTo(talk, text, { said = [], n = 0 } = {}) {
  if (!talk) return null
  const before = said.filter((s) => plain(s) === plain(text)).length
  if (before > 0 && talk.again?.length) {
    return { lines: [talk.again[(before - 1) % talk.again.length]], kind: 'again' }
  }
  const topic = topicOf(talk, text)
  if (topic?.lines?.length) return { lines: topic.lines, kind: 'topic' }
  const any = talk.any ?? []
  if (!any.length) return null
  return { lines: [any[n % any.length]], kind: 'any' }
}
