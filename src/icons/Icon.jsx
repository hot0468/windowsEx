// Iconify fluent-color (MIT) — trash.svg is fluent-emoji, which has no fluent-color counterpart.
import chat from './chat.svg'
import doc from './doc.svg'
import folder from './folder.svg'
import globe from './globe.svg'
import hwp from './hwp.svg'
import image from './image.svg'
import mail from './mail.svg'
import notepad from './notepad.svg'
import trash from './trash.svg'
import trophy from './trophy.svg'
import workchat from './workchat.svg'

const SRC = { chat, doc, folder, globe, hwp, image, mail, notepad, trash, trophy, workchat }

export default function Icon({ name, size = 16 }) {
  return <img className="icon" src={SRC[name]} width={size} height={size} alt="" draggable="false" />
}
