import { useCallback, useEffect, useRef, useState } from 'react';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import NewChatModal from './components/NewChatModal';
import {
  chatIdToPhone,
  deleteNotification,
  isWebhookUrlError,
  normalizeNotification,
  phoneToChatId,
  receiveNotification,
  sendMessage,
} from './api/greenApi';
import './App.css';

const LS_CREDS = 'max-chat-credentials';

function loadCreds() {
  try {
    const raw = localStorage.getItem(LS_CREDS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function chatsKey(idInstance) {
  return `max-chat-chats-${idInstance}`;
}

function loadChats(idInstance) {
  try {
    const raw = localStorage.getItem(chatsKey(idInstance));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [creds, setCreds] = useState(() => loadCreds());
  const [chats, setChats] = useState(() => (loadCreds() ? loadChats(loadCreds().idInstance) : {}));
  const [activeChatId, setActiveChatId] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const [pollingState, setPollingState] = useState('idle'); // idle | starting | polling | error | webhook-set
  const [pollingError, setPollingError] = useState('');

  const credsRef = useRef(creds);
  credsRef.current = creds;
  const activeRef = useRef(activeChatId);
  activeRef.current = activeChatId;
  // Какой инстанс сейчас загружен в `chats` — чтобы не сохранить
  // старые чаты под ключом нового инстанса при смене аккаунта.
  const loadedKey = useRef(creds ? creds.idInstance : null);

  useEffect(() => {
    if (!creds) return;
    localStorage.setItem(LS_CREDS, JSON.stringify(creds));
    loadedKey.current = creds.idInstance;
    setChats(loadChats(creds.idInstance));
    setActiveChatId(null);
  }, [creds?.idInstance, creds?.apiTokenInstance]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (creds && loadedKey.current === creds.idInstance) {
      localStorage.setItem(chatsKey(creds.idInstance), JSON.stringify(chats));
    }
  }, [chats, creds]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const upsertMessage = useCallback((chatId, msg) => {
    setChats((prev) => {
      const existing = prev[chatId] || {
        chatId,
        phone: chatIdToPhone(chatId),
        name: '',
        messages: [],
        unread: 0,
        lastTs: 0,
      };
      if (existing.messages.some((m) => m.id === msg.id)) return prev;
      const messages = [...existing.messages, msg].sort((a, b) => a.timestamp - b.timestamp);
      const isActive = activeRef.current === chatId;
      return {
        ...prev,
        [chatId]: {
          ...existing,
          messages,
          lastTs: Math.max(existing.lastTs || 0, msg.timestamp),
          unread: msg.fromMe || isActive ? existing.unread || 0 : (existing.unread || 0) + 1,
        },
      };
    });
  }, []);

  const handleNotificationBody = useCallback(
    (body) => {
      const n = normalizeNotification(body);
      if (!n) return;
      if (n.kind === 'message') {
        // Показываем входящие всегда; исходящие с телефона — тоже;
        // исходящие через API пропускаем, т.к. уже добавили оптимистично (защита от дублей по idMessage ниже).
        if (n.typeWebhook === 'outgoingAPIMessageReceived') return;
        setChats((prev) => {
          const prevChat = prev[n.chatId];
          const phone = n.senderPhone || chatIdToPhone(n.chatId);
          return {
            ...prev,
            [n.chatId]: {
              chatId: n.chatId,
              phone,
              name: prevChat?.name || n.chatName || phone,
              messages: prevChat?.messages || [],
              unread: prevChat?.unread || 0,
              lastTs: prevChat?.lastTs || 0,
            },
          };
        });
        upsertMessage(n.chatId, {
          id: n.idMessage || uid(),
          text: n.text,
          fromMe: n.fromMe,
          timestamp: n.timestamp,
          status: 'sent',
        });
      }
    },
    [upsertMessage],
  );

  // Polling loop: ReceiveNotification -> handle -> DeleteNotification
  useEffect(() => {
    if (!creds) {
      setPollingState('idle');
      return;
    }
    let stopped = false;
    setPollingState('starting');
    setPollingError('');

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    async function loop() {
      while (!stopped) {
        try {
          const data = await receiveNotification(credsRef.current, 20);
          if (stopped) break;
          if (data && data.receiptId !== undefined && data.body) {
            try {
              handleNotificationBody(data.body);
            } finally {
              try {
                await deleteNotification(credsRef.current, data.receiptId);
              } catch {
                // не критично — уведомление удалится при следующем проходе
              }
            }
            setPollingState('polling');
            setPollingError('');
          } else {
            setPollingState((s) => (s === 'starting' ? 'polling' : s));
            // пустой ответ = таймаут ожидания, просто идём дальше
          }
        } catch (err) {
          if (stopped) break;
          const msg = err?.message || 'Ошибка сети';
          if (isWebhookUrlError(msg)) {
            setPollingState('webhook-set');
            setPollingError('У инстанса задан webhookUrl. Очистите его в кабинете для HTTP API.');
            await sleep(10000);
          } else {
            setPollingState('error');
            setPollingError(msg);
            await sleep(4000);
          }
        }
      }
    }
    loop();
    return () => {
      stopped = true;
    };
  }, [creds?.idInstance, creds?.apiTokenInstance, creds?.apiUrl, handleNotificationBody]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLogin(next) {
    setCreds(next);
  }

  function handleLogout() {
    setCreds(null);
    localStorage.removeItem(LS_CREDS);
    setActiveChatId(null);
    setPollingState('idle');
  }

  function handleCreateChat(input) {
    const chatId = phoneToChatId(input);
    const phone = chatIdToPhone(chatId);
    setChats((prev) => {
      if (prev[chatId]) return prev;
      return {
        ...prev,
        [chatId]: { chatId, phone, name: phone, messages: [], unread: 0, lastTs: Date.now() },
      };
    });
    setActiveChatId(chatId);
  }

  function handleSelect(chatId) {
    setActiveChatId(chatId);
    setChats((prev) => {
      if (!prev[chatId] || !prev[chatId].unread) return prev;
      return { ...prev, [chatId]: { ...prev[chatId], unread: 0 } };
    });
  }

  function handleDeleteChat(chatId) {
    setChats((prev) => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    if (activeChatId === chatId) setActiveChatId(null);
  }

  async function handleSend(chatId, text) {
    const localId = uid();
    upsertMessage(chatId, {
      id: localId,
      text,
      fromMe: true,
      timestamp: Date.now(),
      status: 'sending',
    });
    setSending(true);
    try {
      const res = await sendMessage(credsRef.current, { chatId, message: text });
      setChats((prev) => {
        const chat = prev[chatId];
        if (!chat) return prev;
        return {
          ...prev,
          [chatId]: {
            ...chat,
            messages: chat.messages.map((m) =>
              m.id === localId ? { ...m, id: res?.idMessage ? String(res.idMessage) : localId, status: 'sent' } : m,
            ),
          },
        };
      });
    } catch (err) {
      setChats((prev) => {
        const chat = prev[chatId];
        if (!chat) return prev;
        return {
          ...prev,
          [chatId]: {
            ...chat,
            messages: chat.messages.map((m) => (m.id === localId ? { ...m, status: 'error' } : m)),
          },
        };
      });
      setToast(err.message || 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  }

  if (!creds) {
    return (
      <div className="app">
        <LoginScreen initial={loadCreds()} onSuccess={handleLogin} />
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-layout">
        <Sidebar
          chats={chats}
          activeChatId={activeChatId}
          onSelect={handleSelect}
          onNewChat={() => setShowNewChat(true)}
          onDeleteChat={handleDeleteChat}
          onLogout={handleLogout}
          creds={creds}
          pollingState={pollingState}
          pollingError={pollingError}
        />
        <ChatView chat={activeChatId ? chats[activeChatId] : null} onSend={handleSend} sending={sending} />
      </div>
      {showNewChat && (
        <NewChatModal onClose={() => setShowNewChat(false)} onCreate={handleCreateChat} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
