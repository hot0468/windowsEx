import Notepad from './Notepad.jsx'
import FileExplorer from './FileExplorer.jsx'

const Placeholder = () => <div style={{ padding: 24, color: '#888' }}>준비 중…</div>

export const APPS = {
  messenger: { title: '한빛톡', icon: '💬', comp: Placeholder, w: 380, h: 520 },
  mail: { title: '메일', icon: '✉️', comp: Placeholder, w: 780, h: 540 },
  explorer: { title: '파일 탐색기', icon: '📁', comp: FileExplorer, w: 640, h: 420 },
  notepad: { title: '메모장', icon: '📝', comp: Notepad, w: 520, h: 400 },
  browser: { title: '브라우저', icon: '🌐', comp: Placeholder, w: 820, h: 560 }
}
