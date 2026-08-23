import Notepad from './Notepad.jsx'
import FileExplorer from './FileExplorer.jsx'
import Browser from './Browser.jsx'
import Messenger from './Messenger.jsx'
import Mail from './Mail.jsx'

export const APPS = {
  messenger: { title: '한빛톡', icon: '💬', comp: Messenger, w: 380, h: 520 },
  mail: { title: '메일', icon: '✉️', comp: Mail, w: 780, h: 540 },
  explorer: { title: '파일 탐색기', icon: '📁', comp: FileExplorer, w: 640, h: 420 },
  notepad: { title: '메모장', icon: '📝', comp: Notepad, w: 520, h: 400 },
  browser: { title: '브라우저', icon: '🌐', comp: Browser, w: 820, h: 560 }
}
