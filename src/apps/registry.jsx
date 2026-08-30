import Notepad from './Notepad.jsx'
import FileExplorer from './FileExplorer.jsx'
import Browser, { DevTools } from './Browser.jsx'
import Messenger from './Messenger.jsx'
import Mail from './Mail.jsx'
import Viewer from './Viewer.jsx'
import Hwp from './Hwp.jsx'
import Pdf from './Pdf.jsx'
import Dcx from './Dcx.jsx'
import Cmd from './Cmd.jsx'
import Slides from './Slides.jsx'
import Sheet from './Sheet.jsx'
import Installer from './Installer.jsx'
import Settings from './Settings.jsx'
import Dial from './Dial.jsx'
import TaskManager from './TaskManager.jsx'
import Antivirus from './Antivirus.jsx'
import Vpn from './Vpn.jsx'
import Minesweeper from './Minesweeper.jsx'
import Solitaire from './Solitaire.jsx'

const WorkMessenger = () => <Messenger source="workMessenger" />
const PrivateMessenger = () => <Messenger source="privateMessenger" />

export const APPS = {
  messenger: { title: 'AR톡', icon: 'workchat', comp: WorkMessenger, w: 780, h: 560 },
  chat: { title: '톡톡', icon: 'chat', comp: PrivateMessenger, w: 780, h: 560 },
  mail: { title: '메일', icon: 'mail', comp: Mail, w: 780, h: 540 },
  explorer: { title: '파일 탐색기', icon: 'folder', comp: FileExplorer, w: 640, h: 420 },
  notepad: { title: '메모장', icon: 'notepad', comp: Notepad, w: 520, h: 400 },
  viewer: { title: '사진', icon: 'image', comp: Viewer, w: 720, h: 520, theme: '#2f3038' },
  hwp: { title: '한글', icon: 'hwp', comp: Hwp, w: 700, h: 620, theme: '#1f5aa8', grant: 'hangul' },
  pdf: { title: 'PDF 뷰어', icon: 'pdf', comp: Pdf, w: 700, h: 620, theme: '#b3261e' },
  dcx: { title: 'DY Viewer', icon: 'doc', comp: Dcx, w: 660, h: 580, theme: '#123a7a', grant: 'dviewer' },
  slides: { title: '슬라이드', icon: 'ppt', comp: Slides, w: 760, h: 520, theme: '#c43e1c' },
  sheet: { title: '시트', icon: 'xls', comp: Sheet, w: 780, h: 520, theme: '#217346' },
  browser: { title: '브라우저', icon: 'globe', comp: Browser, w: 820, h: 560 },
  devtools: { title: '개발자 도구', icon: 'globe', comp: DevTools, w: 640, h: 360, noLaunch: true },
  installer: { title: '설치 마법사', icon: 'cmd', comp: Installer, w: 560, h: 400, noLaunch: true },
  // 폰에는 시작 메뉴가 없어 게임을 다루는 버튼이 갈 자리가 없다. 설정 앱이
  // 그 자리다 — 데스크톱에는 시작 메뉴가 이미 있으므로 올리지 않는다.
  settings: { title: '설정', icon: 'settings', comp: Settings, w: 420, h: 520, phoneOnly: true },
  // 전화도 폰의 물건이다. PC 에는 걸 곳도 받을 곳도 없다.
  dial: { title: '전화', icon: 'phone', comp: Dial, w: 380, h: 560, phoneOnly: true },
  taskmgr: { title: '작업 관리자', icon: 'cmd', comp: TaskManager, w: 620, h: 470 },
  antivirus: { title: 'AR 백신', icon: 'shield', comp: Antivirus, w: 460, h: 480, theme: '#1f6f4a' },
  cmd: { title: '명령 프롬프트', icon: 'cmd', comp: Cmd, w: 660, h: 400, theme: '#1a1a1a' },
  vpn: { title: 'AR VPN', icon: 'vpn', comp: Vpn, w: 400, h: 330, theme: '#1f5aa8', grant: 'vpnInstalled' },
  // 회사 PC에 딸려 오는 딴짓거리. 업무 상태를 한 톨도 건드리지 않는다 —
  // 판은 창 안에서만 살고 창을 닫으면 사라진다. 다만 켜 둔 채로 일을 끝내면
  // 팀장이 그걸 본다(store.js의 slacking).
  mine: { title: '지뢰찾기', icon: 'mine', comp: Minesweeper, w: 400, h: 500 },
  solitaire: { title: '솔리테어', icon: 'cards', comp: Solitaire, w: 760, h: 600, theme: '#166534' }
}

// The start menu lists programs, not the windows other things open: the dev
// tools belong to the browser and the wizard to a setup file. And a program
// that has not been installed yet is not on this PC to list.
export const startMenuApps = (grants = {}) =>
  Object.entries(APPS).filter(([, a]) => !a.noLaunch && !a.phoneOnly && (!a.grant || grants[a.grant]))

// A restored save can name an app this build no longer has. Drawing one throws
// and takes the whole desktop with it, so drop them before anything renders.
export const knownWindows = (windows) => windows.filter((w) => APPS[w.app])

// 폰 홈에 놓이는 것들. 데스크톱 시작 메뉴와 다르다 — 폰에 없는 물건은
// 빼고, PC에서는 탐색기 안의 폴더였던 것이 폰에서는 앱이 된다.
//
// 'photos'와 'files'는 fs.휴대폰 아래를 연다. 폰이 제 것으로 가진 저장소고,
// 부름이 묻는 영수증_0723이 여기 있다.
//
// 'drive'는 PC의 저장소가 폰에 마운트된 것이다. 원격 데스크톱이 아니다.
// 이름을 '사내 드라이브'로 하면 안 된다 — drive.ar.local이 이미 그 이름을
// 쓰고 있고, 그쪽은 VPN과 hosts로 잠긴 별개의 퍼즐이다.
const PHONE_EXTRA = [
  { id: 'photos', title: '사진', icon: 'image', app: 'explorer', props: { startFolder: ['휴대폰', '갤러리'], roots: ['휴대폰'] } },
  { id: 'files', title: '파일', icon: 'folder', app: 'explorer', props: { startFolder: ['휴대폰', '다운로드'], roots: ['휴대폰'] } },
  { id: 'drive', title: '내 PC 드라이브', icon: 'folder', app: 'explorer', props: { startFolder: '문서', roots: ['문서', '다운로드', '휴지통', '로컬 디스크 (C:)'] } }
]

// 폰에 없는 물건. 작업 관리자와 백신은 PC를 관리하는 도구고, 탐색기는
// 사진·파일·드라이브로 갈라져 홈에 이미 세 번 올라와 있다.
//
// cmd는 뺀다 — 실제 폰에 명령 프롬프트는 없다. ipconfig·hostname·whoami가
// 말해 주던 값과 ping은 설정 앱의 '내 PC 연결 정보'가 대신 보여 준다(같은
// scenario.network 를 읽으므로 답이 갈리지 않는다). notepad는 남긴다 —
// hosts 를 고치는 길이 아직 거기뿐이다.
// viewer도 뺀다. 제목이 '사진'이라 폰 네이티브 photos와 홈에서 이름이
// 겹치고, 사진 뷰어는 파일을 열면 뜨는 것이지 홈에서 실행하는 앱이 아니다.
const NOT_ON_PHONE = new Set(['explorer', 'taskmgr', 'antivirus', 'viewer', 'cmd'])

export const phoneApps = (grants = {}) => [
  ...PHONE_EXTRA,
  ...Object.entries(APPS)
    .filter(([id, a]) => !a.noLaunch && !NOT_ON_PHONE.has(id) && (!a.grant || grants[a.grant]))
    .map(([id, a]) => ({ id, title: a.title, icon: a.icon, app: id }))
]
