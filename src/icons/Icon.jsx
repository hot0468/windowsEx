// Iconify fluent-color (MIT) — trash.svg is fluent-emoji, which has no fluent-color counterpart.
import camera from './camera.svg'
import chat from './chat.svg'
import cmd from './cmd.svg'
import doc from './doc.svg'
import folder from './folder.svg'
import globe from './globe.svg'
import hwp from './hwp.svg'
import image from './image.svg'
import mail from './mail.svg'
import notepad from './notepad.svg'
import pdf from './pdf.svg'
import phone from './phone.svg'
import ppt from './ppt.svg'
import settings from './settings.svg'
import shield from './shield.svg'
import trash from './trash.svg'
import trophy from './trophy.svg'
import vpn from './vpn.svg'
import workchat from './workchat.svg'
import xls from './xls.svg'

import { fileImage } from '../assets/photos.js'
import { fileOpener } from '../engine/store.js'

const SRC = { camera, chat, cmd, doc, folder, globe, hwp, image, mail, notepad, pdf, phone, ppt, settings, shield, trash, trophy, vpn, workchat, xls }

export default function Icon({ name, size = 16 }) {
  return <img className="icon" src={SRC[name]} width={size} height={size} alt="" draggable="false" />
}

// A picture file shows the picture, the way Explorer does. Falls back to the
// type icon when the photo itself was never downloaded.
export function FileGlyph({ file, size = 36, photo = size }) {
  const shot = file.image && fileImage(file.image)
  if (!shot) return <Icon name={fileOpener(file).icon} size={size} />
  return (
    <img className="thumb" src={shot} width={photo} height={photo}
         alt="" draggable="false" title={file.name} />
  )
}
