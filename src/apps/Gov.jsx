import { useState } from 'react'
import { useGame, codeFits, findFile } from '../engine/store.js'
import { Lock, Search } from '../icons/line.jsx'
import Download from './Download.jsx'

const PHONE = /^01[016789]-?\d{3,4}-?\d{4}$/

const STEPS = ['민원 선택', '본인확인', '발급']

// The government portal: pick a certificate, prove who you are by phone, save
// the PDF. Progress lives in the page, so closing the tab starts over — the
// way the real site does it.
export default function Gov({ site }) {
  const gov = site.gov
  const fs = useGame((s) => s.scenario.fs)
  const restored = useGame((s) => s.restored)
  const restoreFile = useGame((s) => s.restoreFile)
  const sendCode = useGame((s) => s.sendCode)
  const anysign = useGame((s) => Boolean(s.grants.anysign))
  const [secErr, setSecErr] = useState('')
  const [q, setQ] = useState('')
  const [service, setService] = useState(null)
  const [verified, setVerified] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const step = !service ? 0 : verified ? 2 : 1
  // The real thing makes you install a plugin before it will take your name.
  const gate = Boolean(service) && !verified && !anysign
  const term = q.trim()
  const listed = gov.services.filter((s) => !term || s.title.includes(term))

  const pick = (svc) => {
    setService(svc)
    setError('')
    setSecErr('')
  }
  const home = () => {
    setService(null)
    setError('')
    setSecErr('')
  }

  const requestCode = () => {
    if (name.trim() !== gov.verify.name || !PHONE.test(phone.trim())) {
      return setError('입력하신 정보와 일치하는 회원이 없습니다. 이름과 휴대폰 번호를 확인해 주세요.')
    }
    setError('')
    setSent(true)
    setCode('')
    sendCode(gov)
  }
  const confirm = () => {
    if (codeFits(gov.verify, code)) {
      setVerified(true)
      setError('')
    } else {
      setError('인증번호가 일치하지 않습니다.')
    }
  }

  const file = service && findFile(fs, service.fileId)
  const saved = Boolean(service && restored[service.fileId])

  return (
    <div className="gov">
      <div className="gov-top">
        <button className="gov-logo" onClick={home}>{gov.name}</button>
        <span className="gov-tag">{gov.tagline}</span>
        <span className="gov-user">{verified ? `${gov.verify.name}님` : '비회원'}</span>
      </div>

      {service && (
        <ol className="gov-steps">
          {STEPS.map((label, i) => (
            <li key={label} className={i === step ? 'on' : i < step ? 'done' : ''}>
              <b>{i + 1}</b>{label}
            </li>
          ))}
        </ol>
      )}

      {!service && (
        <div className="gov-home">
          <div className="gov-hero">
            <h1>어떤 민원을 찾으세요?</h1>
            <div className="gov-search">
              <Search size={17} strokeWidth={1.9} />
              <input value={q} onChange={(e) => setQ(e.target.value)}
                     placeholder="민원 이름으로 검색" aria-label="민원 검색" spellCheck={false} />
            </div>
          </div>
          <h2 className="gov-h2">자주 찾는 민원</h2>
          <div className="gov-cards">
            {listed.map((svc) => (
              <div key={svc.id} className="gov-card">
                <div className="gov-card-title">{svc.title}</div>
                <div className="gov-card-meta">{svc.dept} · 수수료 {svc.fee}</div>
                <button className="gov-btn" onClick={() => pick(svc)}>발급</button>
              </div>
            ))}
            {listed.length === 0 && <p className="gov-none">검색 결과가 없습니다.</p>}
          </div>
        </div>
      )}

      {gate && (
        <div className="gov-panel">
          <h2>{gov.security.title}</h2>
          {gov.security.lines.map((line) => <p key={line} className="gov-sub">{line}</p>)}
          <Download item={gov.security.download} />
          <button className="gov-btn wide primary"
                  onClick={() => setSecErr(gov.security.notReady)}>
            {gov.security.recheck}
          </button>
          {secErr && <p className="pw-error">{secErr}</p>}
          <button className="gov-back" onClick={home}>← 민원 목록으로</button>
        </div>
      )}

      {service && !verified && !gate && (
        <div className="gov-panel">
          <h2>본인확인</h2>
          <p className="gov-sub">{service.title} 발급을 위해 휴대폰으로 본인확인을 진행합니다.</p>
          <label className="lg-field">
            <span>이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={sent}
                   placeholder="이름을 입력해 주세요" spellCheck={false} />
          </label>
          <label className="lg-field">
            <span>휴대폰 번호</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sent}
                   placeholder="010-0000-0000" spellCheck={false}
                   onKeyDown={(e) => e.key === 'Enter' && !sent && requestCode()} />
          </label>
          <button className="gov-btn wide" onClick={requestCode}>
            {sent ? '인증번호 다시 받기' : '인증번호 받기'}
          </button>
          {sent && (
            <>
              <p className="gov-note"><Lock size={13} strokeWidth={2} />휴대폰으로 인증번호를 보냈습니다. 문자 메시지를 확인해 주세요.</p>
              <label className="lg-field">
                <span>인증번호</span>
                <input value={code} onChange={(e) => setCode(e.target.value)}
                       placeholder="6자리 숫자" inputMode="numeric" spellCheck={false}
                       onKeyDown={(e) => e.key === 'Enter' && confirm()} />
              </label>
              <button className="gov-btn wide primary" onClick={confirm} disabled={!code.trim()}>확인</button>
            </>
          )}
          {error && <p className="pw-error">{error}</p>}
          <button className="gov-back" onClick={home}>← 민원 목록으로</button>
        </div>
      )}

      {service && verified && (
        <div className="gov-panel">
          <h2>{service.title}</h2>
          <p className="gov-sub">본인확인이 완료되었습니다. 아래 내용으로 발급됩니다.</p>
          {file && (
            <div className="gov-preview">
              <pre>{file.content}</pre>
            </div>
          )}
          <div className="gov-row">
            <button className="gov-btn primary" disabled={saved || !file}
                    onClick={() => restoreFile(service.fileId)}>
              {saved ? '다운로드 폴더에 저장됨' : 'PDF 저장'}
            </button>
            {saved && <span className="gov-saved">{file.name}</span>}
          </div>
          <button className="gov-back" onClick={home}>← 다른 민원 발급</button>
        </div>
      )}

      <div className="gov-foot">본 사이트는 게임 속 가상의 포털입니다 · 정부25 콜센터 1600-0025</div>
    </div>
  )
}
