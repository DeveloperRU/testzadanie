import { useEffect, useRef, useState } from 'react';

export default function ChatView({ chat, onSend, sending }) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    setDraft('');
  }, [chat?.chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat?.messages?.length, chat?.chatId]);

  if (!chat) {
    return (
      <main className="chat-main chat-empty">
        <div className="empty-chat-card">
          <div className="login-logo">MAX</div>
          <h2>Выберите чат или создайте новый</h2>
          <p>
            Введите номер телефона получателя — сообщение уйдёт через метод SendMessage,
            а ответ появится автоматически через ReceiveNotification.
          </p>
        </div>
      </main>
    );
  }

  function submit(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    onSend(chat.chatId, text);
    setDraft('');
  }

  return (
    <main className="chat-main">
      <header className="chat-header">
        <div className="avatar">{(chat.name || chat.phone || '?')[0]?.toUpperCase()}</div>
        <div className="chat-header-info">
          <div className="chat-header-name">{chat.name || chat.phone || chat.chatId}</div>
          <div className="chat-header-sub">{chat.phone ? `+${chat.phone.replace(/^\+/, '')} · ${chat.chatId}` : chat.chatId}</div>
        </div>
      </header>

      <div className="messages">
        {chat.messages.length === 0 && (
          <div className="day-hint">Пока пусто. Напишите первое сообщение 👇</div>
        )}
        {chat.messages.map((m) => (
          <div key={m.id} className={`bubble-row ${m.fromMe ? 'me' : 'peer'}`}>
            <div className={`bubble ${m.status === 'error' ? 'bubble-error' : ''}`}>
              <div className="bubble-text">{m.text}</div>
              <div className="bubble-meta">
                <span>
                  {new Date(m.timestamp).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {m.fromMe && <span>{m.status === 'sending' ? ' ···' : m.status === 'error' ? ' ⚠' : ' ✓'}</span>}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="composer" onSubmit={submit}>
        <input
          className="composer-input"
          placeholder="Сообщение"
          value={draft}
          maxLength={4000}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn-primary btn-send" type="submit" disabled={!draft.trim() || sending}>
          ➤
        </button>
      </form>
    </main>
  );
}
