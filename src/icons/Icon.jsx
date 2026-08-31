// Iconify fluent-color (MIT) — trash.svg is fluent-emoji, which has no fluent-color counterpart.
import camera from './camera.svg'
import files from './files.svg'
import cards from './cards.svg'
import chat from './chat.svg'
import cmd from './cmd.svg'
import doc from './doc.svg'
import exe from './exe.svg'
import folder from './folder.svg'
import globe from './globe.svg'
import hwp from './hwp.svg'
import image from './image.svg'
import mail from './mail.svg'
import map from './map.svg'
import meet from './meet.svg'
import mine from './mine.svg'
import notepad from './notepad.svg'
import pdf from './pdf.svg'
import phone from './phone.svg'
import ppt from './ppt.svg'
import settings from './settings.svg'
import shield from './shield.svg'
import steps from './steps.svg'
import trash from './trash.svg'
import trophy from './trophy.svg'
import vpn from './vpn.svg'
import workchat from './workchat.svg'
import xls from './xls.svg'

import { fileImage } from '../assets/photos.js'
import { fileOpener } from '../engine/store.js'

const SRC = { camera, cards, files, map, meet, chat, cmd, doc, exe, folder, globe, hwp, image, mail, mine, notepad, pdf, phone, ppt, settings, shield, steps, trash, trophy, vpn, workchat, xls }

export default function Icon({ name, size = 16 }) {
  return <img className="icon" src={SRC[name]} width={size} height={size} alt="" draggable="false" />
}

// A picture file shows the picture, the way Explorer does. Falls back to the
// type icon when the photo itself was never downloaded.
// 발표 자료의 미리보기에 쓸 것. 첫 슬라이드의 제목과 장수 — 아이콘 자리에
// 실제 첫 장이 보이면 덱마다 다르게 생긴다. 슬라이드가 없는 파일은 null.
export const deckThumb = (file) =>
  file?.slides?.length
    ? { title: file.slides[0].title ?? '', lines: (file.slides[0].bullets ?? []).length, count: file.slides.length }
    : null

// 작은 아이콘(목록의 18px 같은 것)에서는 슬라이드 미리보기가 얼룩으로만 보인다.
// 그 아래에서는 종류 아이콘을 그대로 쓴다.
const DECK_MIN = 24

export function FileGlyph({ file, size = 36, photo = size }) {
  const shot = file.image && fileImage(file.image)
  if (shot) {
    return (
      <img className="thumb" src={shot} width={photo} height={photo}
           alt="" draggable="false" title={file.name} />
    )
  }
  // 사진처럼, 발표 자료도 아이콘 대신 첫 장이 보인다 — 슬라이드 뷰어의 그
  // 흰 4:3 카드를 그대로 줄인 것이라 같은 물건으로 읽힌다.
  const deck = deckThumb(file)
  if (deck && photo >= DECK_MIN) {
    return (
      <span className="deck" style={{ width: photo, height: Math.round(photo * 0.75), fontSize: Math.max(5, Math.round(photo / 8)) }}
            title={`${file.name} · ${deck.count}장`} draggable="false">
        <b>{deck.title}</b>
        {Array.from({ length: Math.min(deck.lines, 3) }, (_, i) => <i key={i} />)}
        {deck.count > 1 && <em>{deck.count}</em>}
      </span>
    )
  }
  return <Icon name={fileOpener(file).icon} size={size} />
}
