import Notepad from './Notepad.jsx'
import FileExplorer from './FileExplorer.jsx'
import Browser from './Browser.jsx'
import Messenger from './Messenger.jsx'
import Mail from './Mail.jsx'
import Viewer from './Viewer.jsx'
import Hwp from './Hwp.jsx'
import Cmd from './Cmd.jsx'
import Slides from './Slides.jsx'
import Sheet from './Sheet.jsx'

const WorkMessenger = () => <Messenger source="workMessenger" />
const PrivateMessenger = () => <Messenger source="privateMessenger" />

export const APPS = {
  messenger: { title: 'AR톡', icon: 'workchat', comp: WorkMessenger, w: 780, h: 560 },
  chat: { title: '톡톡', icon: 'chat', comp: PrivateMessenger, w: 780, h: 560 },
  mail: { title: '메일', icon: 'mail', comp: Mail, w: 780, h: 540 },
  explorer: { title: '파일 탐색기', icon: 'folder', comp: FileExplorer, w: 640, h: 420 },
  notepad: { title: '메모장', icon: 'notepad', comp: Notepad, w: 520, h: 400 },
  viewer: { title: '사진', icon: 'image', comp: Viewer, w: 720, h: 520, theme: '#2f3038' },
  hwp: { title: '한글', icon: 'hwp', comp: Hwp, w: 700, h: 620, theme: '#1f5aa8' },
  slides: { title: '슬라이드', icon: 'ppt', comp: Slides, w: 760, h: 520, theme: '#c43e1c' },
  sheet: { title: '시트', icon: 'xls', comp: Sheet, w: 780, h: 520, theme: '#217346' },
  browser: { title: '브라우저', icon: 'globe', comp: Browser, w: 820, h: 560 },
  cmd: { title: '명령 프롬프트', icon: 'cmd', comp: Cmd, w: 660, h: 400, theme: '#1a1a1a' }
}
