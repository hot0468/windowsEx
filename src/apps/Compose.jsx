import { useRef, useState } from 'react'
import { useGame, WORK_FOLDER, findFile } from '../engine/store.js'
import FileDialog from './FileDialog.jsx'
import { useFileDrop } from './dragFile.js'
import {
  AlignCenter, AlignLeft, Bold, ClearFormat, Italic, List,
  Paperclip, Send, Strikethrough, Underline, X
} from '../icons/line.jsx'

const FONTS = ['맑은 고딕', '굴림', '바탕', 'Arial']
const SIZES = ['12px', '14px', '16px', '18px']

// ponytail: execCommand is deprecated but is the whole rich-text editor here —
// swap for a real editor only if formatting ever has to round-trip somewhere.
const TOOLS = [
  { cmd: 'bold', label: '굵게', Icon: Bold },
  { cmd: 'italic', label: '기울임', Icon: Italic },
  { cmd: 'underline', label: '밑줄', Icon: Underline },
  { cmd: 'strikeThrough', label: '취소선', Icon: Strikethrough },
  { cmd: 'insertUnorderedList', label: '목록', Icon: List },
  { cmd: 'justifyLeft', label: '왼쪽 정렬', Icon: AlignLeft },
  { cmd: 'justifyCenter', label: '가운데 정렬', Icon: AlignCenter },
  { cmd: 'removeFormat', label: '서식 지우기', Icon: ClearFormat }
]

export default function Compose({ mail, onSend, onCancel }) {
  const fs = useGame((s) => s.scenario.fs)
  const me = useGame((s) => s.scenario.player)
  const pinned = useGame((s) => s.pinned)
  const [att, setAtt] = useState('')
  const [picking, setPicking] = useState(false)
  const [font, setFont] = useState(FONTS[0])
  const [size, setSize] = useState(SIZES[1])
  const body = useRef(null)
  const drop = useFileDrop(setAtt)

  const attached = att ? findFile(fs, att) : null
  const run = (cmd) => {
    body.current.focus()
    document.execCommand(cmd)
  }

  return (
    <div className="mw">
      <div className="mw-actions">
        <button className="btn-primary" onClick={() => onSend({ attachmentId: att || null, body: body.current.innerText })}>
          <Send size={15} strokeWidth={1.8} />보내기
        </button>
        <button className="sm-cancel" onClick={onCancel}>취소</button>
      </div>

      <div className="mw-fields">
        <div className="mw-row">
          <span className="mw-label">보내는사람</span>
          <span className="mw-value">{me.name} &lt;{me.email}&gt;</span>
        </div>
        <div className="mw-row">
          <span className="mw-label">받는사람</span>
          <span className="mw-value">{mail.from}</span>
        </div>
        <div className="mw-row">
          <span className="mw-label">제목</span>
          <span className="mw-value">RE: {mail.subject}</span>
        </div>
        <div className="mw-row mw-attach">
          <span className="mw-label">파일첨부</span>
          <div className="mw-value">
            <div className="mw-attach-top">
              <button className="attach" onClick={() => setPicking(true)}>내 PC</button>
              <span className="mw-quota">일반 {attached ? '1개' : '0KB'}/10MB</span>
            </div>
            <div className={'mw-drop' + (drop.over ? ' over' : '')} {...drop.dropProps}>
              {!attached && (
                <span className="mw-drop-empty">
                  파일을 마우스로 끌어 오거나 '내 PC'를 누르세요
                </span>
              )}
              {attached && (
                <span className="attach-chip">
                  <Paperclip size={13} strokeWidth={1.9} />{attached.name}
                  <button onClick={() => setAtt('')} title="첨부 취소">
                    <X size={12} strokeWidth={2.2} />
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mw-tools">
        <select value={font} onChange={(e) => setFont(e.target.value)} aria-label="글꼴">
          {FONTS.map((f) => <option key={f}>{f}</option>)}
        </select>
        <select value={size} onChange={(e) => setSize(e.target.value)} aria-label="글자 크기">
          {SIZES.map((v) => <option key={v}>{v}</option>)}
        </select>
        <span className="mw-sep" />
        {TOOLS.map(({ cmd, label, Icon }, i) => (
          <span key={cmd} style={{ display: 'contents' }}>
            {(i === 4 || i === 7) && <span className="mw-sep" />}
            <button className="mw-tool" title={label} onClick={() => run(cmd)}>
              <Icon size={15} strokeWidth={1.9} />
            </button>
          </span>
        ))}
      </div>

      <div className="mw-body" ref={body} contentEditable suppressContentEditableWarning
           role="textbox" aria-label="메일 본문"
           style={{ fontFamily: font, fontSize: size }} />

      {picking && (
        <FileDialog start={pinned.length ? ['바탕화면', WORK_FOLDER] : '문서'}
                    onPick={(f) => { setAtt(f.id); setPicking(false) }}
                    onClose={() => setPicking(false)} />
      )}
    </div>
  )
}
