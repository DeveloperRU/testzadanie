import { useState } from 'react';
import { chatIdToPhone } from '../api/greenApi';

function avatarLetter(name, phone) {
  const s = (name || phone || '?').trim();
  return (s[0] || '?').toUpperCase();
}

export default function Sidebar({
  chats,
  activeChatId,
  onSelect,
  onNewChat,
  onDeleteChat,
  onLogout,
  creds,
  pollingState,
  pollingError,
}) {
  const [query, setQuery] = useState('');
  const list = Object.values(chats).sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
  const filtered = query.trim()
    ? list.filter((c) =>
        `${c.name || ''} ${c.phone || ''} ${c.chatId}`.toLowerCase().includes(query.toLowerCase()),
      )
    : list;

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="me">
          <div className="avatar avatar-me">GA</div>
          <div className="me-info">
            <div className="me-title">MAX чат</div>
            <div className="me-sub">idInstance {creds.idInstance}</div>
          </div>
        </div>
        <button className="icon-btn" title="Выйти" onClick={onLogout}>
          ⎋
        </button>
      </div>

      <div className={`conn conn-${pollingState}`}>
        <span className="dot" />
        {pollingState === 'polling' && 'Получение сообщений включено'}
        {pollingState === 'starting' && 'Подключение…'}
        {pollingState === 'error' && `Ошибка получения: ${pollingError || ''}`.slice(0, 90)}
        {pollingState === 'webhook-set' && 'Очистите webhookUrl в кабинете для HTTP API'}
        {pollingState === 'idle' && 'Ожидание'}
      </div>

      <div className="sidebar-actions">
        <input
          className="search"
          placeholder="Поиск по чатам"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn-primary btn-small" onClick={onNewChat}>
          + Новый чат
        </button>
      </div>

      <div className="chat-list">
        {filtered.length === 0 && (
          <div className="empty-list">
            Чатов пока нет.
            <br />
            Нажмите «+ Новый чат» и введите номер телефона получателя.
          </div>
        )}
        {filtered.map((c) => {
          const last = c.messages[c.messages.length - 1];
          return (
            <div
              key={c.chatId}
              className={`chat-item ${c.chatId === activeChatId ? 'active' : ''}`}
              onClick={() => onSelect(c.chatId)}
            >
              <div className="avatar">{avatarLetter(c.name, c.phone || chatIdToPhone(c.chatId))}</div>
              <div className="chat-item-body">
                <div className="chat-item-top">
                  <span className="chat-item-name">{c.name || c.phone || c.chatId}</span>
                  <span className="chat-item-time">
                    {last ? new Date(last.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <div className="chat-item-bottom">
                  <span className="chat-item-preview">
                    {last ? `${last.fromMe ? 'Вы: ' : ''}${last.text}` : c.phone || c.chatId}
                  </span>
                  {c.unread > 0 && <span className="badge">{c.unread}</span>}
                </div>
              </div>
              <button
                className="chat-del"
                title="Удалить чат из списка"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(c.chatId);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div className="sidebar-foot">GREEN-API · SendMessage + HTTP API polling</div>
    </aside>
  );
}
