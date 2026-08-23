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
