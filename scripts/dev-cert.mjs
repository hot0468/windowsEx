// 폰에서 기울기 센서를 켜려면 https 로 열어야 한다. 브라우저는 보안 컨텍스트가
// 아니면 deviceorientation 을 아예 주지 않고, localhost 는 예외지만 랜 주소
// (192.168.x.x)는 아니다.
//
// 개발용 자체 서명 인증서를 이 PC 의 IP 로 만든다. .certs/ 에 놓이면
// vite.config.js 가 알아서 https 로 연다. 커밋되지 않는다(.gitignore).
//
//   node scripts/dev-cert.mjs
//
// IP 가 바뀌면(공유기를 옮기면) 다시 돌리면 된다.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { networkInterfaces } from 'node:os'

const DIR = '.certs'
const KEY = `${DIR}/dev-key.pem`
const CERT = `${DIR}/dev-cert.pem`

// 이 PC 가 랜에서 갖는 주소들. 게이트웨이(x.x.x.1)는 이 PC 가 아니므로 뺀다.
const ips = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === 'IPv4' && !n.internal)
  .map((n) => n.address)
  .filter((a) => !a.endsWith('.1'))

const san = ['DNS:localhost', 'IP:127.0.0.1', 'IP:::1', ...ips.map((a) => `IP:${a}`)].join(',')

if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })

try {
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '3650',
    '-keyout', KEY, '-out', CERT,
    '-subj', '/CN=windowsEx dev',
    '-addext', `subjectAltName=${san}`
  ], { stdio: ['ignore', 'ignore', 'pipe'] })
} catch (e) {
  console.error('인증서를 만들지 못했습니다. openssl 이 있는지 확인하세요.')
  console.error(String(e.stderr ?? e.message).trim().split('\n').slice(-3).join('\n'))
  process.exit(1)
}

console.log('만들었습니다:', CERT)
console.log('담긴 주소:', san.replace(/(DNS|IP):/g, ''))
console.log()
console.log('이제 npm run dev 를 다시 띄우면 https 로 열립니다.')
for (const a of ips) console.log(`  폰에서: https://${a}:5173/`)
console.log()
console.log('자체 서명이라 폰이 한 번 경고합니다 — 「고급 → 계속」 을 누르세요.')
console.log('https 는 http 와 다른 출처라 세이브가 갈립니다(폰에서 빈 주로 시작).')
