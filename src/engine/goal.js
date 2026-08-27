const norm = (s) => String(s ?? '').replace(/[,\s]/g, '')

export function checkGoal(goal, { attachmentId, body }) {
  if (attachmentId !== goal.requiredAttachment) {
    return { ok: false, reason: 'attachment', reply: goal.wrongAttachmentReply }
  }
  const nbody = norm(body)
  const missing = goal.requiredKeywords.some((k) => !nbody.includes(norm(k)))
  if (missing) {
    return { ok: false, reason: 'keyword', reply: goal.missingKeywordReply }
  }
  return { ok: true, reason: null, reply: goal.successReply }
}

// A mail the player sends first. Checked in the order the world would notice:
// an unknown address bounces before anyone reads it (the caller owns the bounce); a mail that skips
// the company name, the greeting, or the sign-off gets a cool reply naming the
// one it skipped (and the boss hears about it); then the body has to actually
// name what is being asked for.

export function checkOutbound(fetch, { to, subject, body }, etiquette, player) {
  if (!fetch || norm(to).toLowerCase() !== norm(fetch.to).toLowerCase()) {
    return { ok: false, reason: 'address', reply: null }
  }
  // 이 메일은 본퀘스트다. 답장과 달리 예절을 어기면 되돌아온다.
  const [rude] = checkEtiquette(
    { ...etiquette, company: player.company, name: player.name },
    { subject, body, outbound: true }
  )
  if (rude) {
    return { ok: false, reason: rude, reply: fetch.rudeReplies[rude] }
  }
  if (fetch.requiredKeywords.some((k) => !norm(body).includes(norm(k)))) {
    return { ok: false, reason: 'keyword', reply: fetch.unclearReply }
  }
  return { ok: true, reason: null, reply: fetch.reply }
}

// 메일 예절. 판정이 아니라 매너를 본다 — 어겼다고 메일이 막히는 것은 발신 메일
// 하나뿐이고(본퀘스트), 답장에서는 박 팀장의 잔소리로만 돌아온다.
// 여는 기호는 형식일 뿐이라 걷어내고 본다: [AR주식회사]든 (AR 주식회사)든
// 회사 이름이 제목 맨 앞에 오기만 하면 된다.
const OPENERS = /^[[\](){}<>【】「」『』"'""''.,·:\-–—]+/

export function checkEtiquette(rules, { subject, body, outbound }) {
  const nbody = norm(body)
  const out = []

  if (outbound) {
    const head = norm(subject).replace(OPENERS, '')
    if (!head.toLowerCase().startsWith(norm(rules.company).toLowerCase())) out.push('subject')
  }

  // 인사를 했는지, 그리고 누가 쓰는지 밝혔는지. 이름 없는 '○○○입니다'는
  // 소개가 아니고, 끝맺음의 '김한별 드림'도 소개가 아니다.
  const greeted = rules.greetings.some((g) => nbody.includes(norm(g)))
  // 이름과 '입니다' 사이에 직함이 끼어드는 것("김한별 대리입니다")은 허용한다.
  // rules.name은 고정된 한글 이름(김한별)이라 정규식에 그대로 꽂아도 안전하다.
  const named = new RegExp(norm(rules.name) + '.{0,6}입니다').test(nbody)
  if (!greeted || !named) out.push('greeting')

  if (!rules.closings.some((c) => nbody.includes(norm(c)))) out.push('closing')

  return out
}
