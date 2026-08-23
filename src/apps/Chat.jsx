import { useGame } from '../engine/store.js'

export default function Chat() {
  const chat = useGame((s) => s.scenario.privateChat)
  return (
    <div className="messenger">
      <div className="chat-header">{chat.title}</div>
      <div className="msg-list">
        {chat.messages.map((m, i) => (
          <div key={i} className={'bubble ' + (m.me ? 'me' : 'them')}>
            {!m.me && <b>{m.from}</b>}{m.text}
          </div>
        ))}
      </div>
    </div>
  )
}
