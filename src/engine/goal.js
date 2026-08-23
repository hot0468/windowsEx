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
