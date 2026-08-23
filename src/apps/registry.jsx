import Notepad from './Notepad.jsx'
import FileExplorer from './FileExplorer.jsx'
import Browser from './Browser.jsx'
import Messenger from './Messenger.jsx'
import Mail from './Mail.jsx'

const WorkMessenger = () => <Messenger source="workMessenger" />
const PrivateMessenger = () => <Messenger source="privateMessenger" />

export const APPS = {
  messenger: { title: '한빛톡', icon: 'workchat', comp: WorkMessenger, w: 780, h: 560 },
  chat: { title: '톡톡', icon: 'chat', comp: PrivateMessenger, w: 780, h: 560 },
  mail: { title: '메일', icon: 'mail', comp: Mail, w: 780, h: 540 },
  explorer: { title: '파일 탐색기', icon: 'folder', comp: FileExplorer, w: 640, h: 420 },
  notepad: { title: '메모장', icon: 'notepad', comp: Notepad, w: 520, h: 400 },
  browser: { title: '브라우저', icon: 'globe', comp: Browser, w: 820, h: 560 }
}
