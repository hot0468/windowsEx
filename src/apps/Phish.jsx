import { useState } from 'react'
import { useGame } from '../engine/store.js'
import { Lock } from '../icons/line.jsx'

// A login page that looks like the company's and isn't. Anything typed into it
// counts as handed over.
export default function Phish({ site }) {
  const p = site.phish
  const phished = useGame((s) => s.phished)
  const [who, setWho] = useState('')
  const [pw, setPw] = useState('')
  const [sent, setSent] = useState(false)

  const submit = () => {
    if (sent) return
    setSent(true)
    phished(p.after)
  }
  const onKey = (e) => e.key === 'Enter' && submit()

  return (
    <div className="lg">
      <div className="lg-hero">
        <h1>{p.title}</h1>
        <p>{p.sub}</p>
      </div>
      <div className="lg-card">
        {sent ? (
          <p className="ph-done">{p.done}</p>
        ) : (
          <>
            <label className="lg-field">
              <span>{p.idLabel}</span>
              <input value={who} onChange={(e) => setWho(e.target.value)} onKeyDown={onKey}
                     placeholder={`${p.idLabel}를 입력해주세요.`} spellCheck={false} />
            </label>
            <label className="lg-field">
              <span>비밀번호</span>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                     onKeyDown={onKey} placeholder="비밀번호를 입력해주세요." />
            </label>
            <p className="lg-hint ph-warn"><Lock size={13} strokeWidth={2} />{p.urgency}</p>
            <button className="lg-submit" onClick={submit}>{p.button}</button>
          </>
        )}
        <p className="lg-foot">{p.foot}</p>
      </div>
    </div>
  )
}
