import { useEffect, useRef, useState } from 'react'
import { useGame } from '../engine/store.js'

const BANNER = [
  'Microsoft Windows [Version 10.0.26100.2314]',
  '(c) Microsoft Corporation. All rights reserved.',
  ''
]

const HELP = [
  '사용할 수 있는 명령:',
  '',
  '  IPCONFIG   네트워크 어댑터의 IP 구성을 표시합니다.',
  '  HOSTNAME   이 컴퓨터의 이름을 표시합니다.',
  '  WHOAMI     현재 로그온한 사용자를 표시합니다.',
  '  CLS        화면을 지웁니다.',
  '  HELP       이 도움말을 표시합니다.',
  ''
]

const ipconfig = (n) => [
  'Windows IP 구성',
  '',
  '',
  n.adapter,
  '',
  `   연결별 DNS 접미사. . . . : ${n.dns}`,
  `   IPv4 주소 . . . . . . . . : ${n.ip}`,
  `   서브넷 마스크 . . . . . . : ${n.mask}`,
  `   기본 게이트웨이 . . . . . : ${n.gateway}`,
  ''
]

export default function Cmd() {
  const net = useGame((s) => s.scenario.network)
  const prompt = `C:\\Users\\${net.user}>`
  const [lines, setLines] = useState(BANNER)
  const [input, setInput] = useState('')
  const box = useRef(null)
  const field = useRef(null)

  useEffect(() => { box.current.scrollTop = box.current.scrollHeight }, [lines])

  const run = () => {
    const typed = input.trim()
    setInput('')
    const cmd = typed.toLowerCase()
    if (cmd === 'cls') return setLines([])
    const out = !typed ? []
      : cmd === 'ipconfig' ? ipconfig(net)
        : cmd === 'hostname' ? [net.host, '']
          : cmd === 'whoami' ? [`ar\\${net.user}`, '']
            : cmd === 'help' ? HELP
              : [`'${typed}'은(는) 내부 또는 외부 명령, 실행할 수 있는 프로그램,`,
                 '또는 배치 파일이 아닙니다.', '']
    setLines((l) => [...l, prompt + ' ' + typed, ...out])
  }

  // Clicking anywhere puts the caret back in the prompt — except right after a
  // drag, where focusing would wipe the selection the player is trying to copy.
  const focusPrompt = () => {
    if (window.getSelection()?.toString()) return
    field.current.focus()
  }

  return (
    <div className="cmd" onMouseUp={focusPrompt}>
      <div className="cmd-out" ref={box}>
        {lines.map((line, i) => <div key={i}>{line || '\u00a0'}</div>)}
        <div className="cmd-line">
          <span>{prompt}</span>
          <input ref={field} value={input} autoFocus spellCheck={false}
                 aria-label="명령 입력"
                 onChange={(e) => setInput(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && run()} />
        </div>
      </div>
    </div>
  )
}
