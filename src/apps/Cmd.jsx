import { useEffect, useRef, useState } from 'react'
import { hiddenCommand, useGame } from '../engine/store.js'

const BANNER = [
  'Microsoft Windows [Version 10.0.26100.2314]',
  '(c) Microsoft Corporation. All rights reserved.',
  ''
]

const HELP = [
  '사용할 수 있는 명령:',
  '',
  '  IPCONFIG   네트워크 어댑터의 IP 구성을 표시합니다.',
  '  IPCONFIG /ALL  물리적 주소를 포함한 전체 구성을 표시합니다.',
  '  PING <호스트>  지정한 호스트에 응답을 요청합니다.',
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

// The long form is where the physical (MAC) address lives — nowhere else does.
export const ipconfigAll = (n) => [
  'Windows IP 구성',
  '',
  `   호스트 이름 . . . . . . . . : ${n.host}`,
  '   노드 유형 . . . . . . . . . : 하이브리드',
  '',
  n.adapter,
  '',
  `   연결별 DNS 접미사. . . . : ${n.dns}`,
  '   설명. . . . . . . . . . . . : Realtek PCIe GbE Family Controller',
  `   물리적 주소 . . . . . . . . : ${n.mac}`,
  '   DHCP 사용 . . . . . . . . . : 예',
  `   IPv4 주소 . . . . . . . . . : ${n.ip}(기본 설정)`,
  `   서브넷 마스크 . . . . . . . : ${n.mask}`,
  `   기본 게이트웨이 . . . . . . : ${n.gateway}`,
  `   DNS 서버. . . . . . . . . . : ${n.gateway}`,
  ''
]

export const ping = (n, host) => {
  if (!host) return ['사용법: ping <호스트>', '']
  const ms = n.pingMs
  return [
    `${host}에 ping을 보내는 중 32바이트 데이터 사용:`,
    ...Array.from({ length: 4 }, (_, i) => `${host}의 응답: 바이트=32 시간=${ms + (i % 2)}ms TTL=64`),
    '',
    `${host}에 대한 ping 통계:`,
    '    패킷: 보냄 = 4, 받음 = 4, 손실 = 0 (0% 손실),',
    '왕복 시간(밀리초):',
    `    최소 = ${ms}ms, 최대 = ${ms + 1}ms, 평균 = ${ms}ms`,
    ''
  ]
}

export default function Cmd() {
  const net = useGame((s) => s.scenario.network)
  const scenario = useGame((s) => s.scenario)
  const prompt = `C:\\Users\\${net.user}>`
  const [lines, setLines] = useState(BANNER)
  const [input, setInput] = useState('')
  const box = useRef(null)
  const field = useRef(null)

  useEffect(() => { box.current.scrollTop = box.current.scrollHeight }, [lines])

  const run = () => {
    const typed = input.trim()
    setInput('')
    const [cmd, ...args] = typed.toLowerCase().split(/\s+/)
    if (cmd === 'cls') return setLines([])
    const out = !typed ? []
      : cmd === 'ipconfig' ? (args[0] === '/all' ? ipconfigAll(net) : ipconfig(net))
        : cmd === 'ping' ? ping(net, args[0])
        : cmd === 'hostname' ? [net.host, '']
          : cmd === 'whoami' ? [`ar\\${net.user}`, '']
            : cmd === 'help' ? HELP
              : hiddenCommand(scenario, cmd)
                ?? [`'${typed}'은(는) 내부 또는 외부 명령, 실행할 수 있는 프로그램,`,
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
