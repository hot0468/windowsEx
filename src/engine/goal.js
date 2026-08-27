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
// an unknown address bounces before anyone reads it (the caller owns the bounce); a mail with no greeting or
// sign-off gets a cool reply (and the boss hears about it); then the body has
// to actually name what is being asked for.
const hasAny = (body, words = []) => words.some((w) => norm(body).includes(norm(w)))

export function checkOutbound(fetch, { to, body }) {
  if (!fetch || norm(to).toLowerCase() !== norm(fetch.to).toLowerCase()) {
    return { ok: false, reason: 'address', reply: null }
  }
  if (!hasAny(body, fetch.greetings) || !hasAny(body, fetch.closings)) {
    return { ok: false, reason: 'rude', reply: fetch.rudeReply }
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
    if (!head.startsWith(norm(rules.company))) out.push('subject')
  }

  // 인사를 했는지, 그리고 누가 쓰는지 밝혔는지. 이름 없는 '○○○입니다'는
  // 소개가 아니고, 끝맺음의 '김한별 드림'도 소개가 아니다.
  const greeted = rules.greetings.some((g) => nbody.includes(norm(g)))
  const named = nbody.includes(norm(rules.name) + '입니다')
  if (!greeted || !named) out.push('greeting')

  if (!rules.closings.some((c) => nbody.includes(norm(c)))) out.push('closing')

  return out
}
