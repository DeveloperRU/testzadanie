// GREEN-API (MAX) HTTP client.
// Docs:
//  - SendMessage: POST {{apiUrl}}/waInstance{{idInstance}}/sendMessage/{{apiTokenInstance}}
//  - ReceiveNotification: GET {{apiUrl}}/waInstance{{idInstance}}/receiveNotification/{{apiTokenInstance}}?receiveTimeout=N
//  - DeleteNotification: DELETE {{apiUrl}}/waInstance{{idInstance}}/deleteNotification/{{apiTokenInstance}}/{{receiptId}}
//  - GetStateInstance: GET {{apiUrl}}/waInstance{{idInstance}}/getStateInstance/{{apiTokenInstance}}

export const DEFAULT_API_URL = 'https://api.green-api.com';

export function normalizeApiUrl(raw) {
  const v = (raw || '').trim();
  if (!v) return DEFAULT_API_URL;
  return v.replace(/\/+$/, '');
}

export function normalizeCredentials({ apiUrl, idInstance, apiTokenInstance }) {
  return {
    apiUrl: normalizeApiUrl(apiUrl),
    idInstance: String(idInstance || '').trim(),
    apiTokenInstance: String(apiTokenInstance || '').trim(),
  };
}

/**
 * Convert user input (phone number or chatId) to GREEN-API chatId.
 * - "+7 (999) 123-45-67" -> "79991234567@c.us"
 * - "79991234567@c.us"   -> as is
 * - "10000000" (MAX user id) -> as is
 */
export function phoneToChatId(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('Введите номер телефона');
  if (raw.includes('@')) {
    const [user, domain] = raw.split('@');
    if (!user || !domain) throw new Error('Некорректный chatId');
    return `${user.trim()}@${domain.trim()}`;
  }
  let digits = raw.replace(/\D/g, '');
  if (!digits) throw new Error('Некорректный номер телефона');
  // 8XXXXXXXXXX (RU) -> 7XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  }
  // Короткий числовой id пользователя MAX (без суффикса) — оставляем как есть
  if (digits.length < 10 && /^\d+$/.test(raw)) {
    return digits;
  }
  if (digits.length < 10) {
    throw new Error('Номер слишком короткий');
  }
  return `${digits}@c.us`;
}

export function chatIdToPhone(chatId) {
  return String(chatId || '').replace(/@.*$/, '');
}

async function requestJson(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    throw new Error('Сеть недоступна. Проверьте интернет и apiUrl.');
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const detail =
      (data && (data.message || data.error || data.detail)) ||
      (typeof data === 'string' ? data : '') ||
      text ||
      `HTTP ${res.status}`;
    throw new Error(`GREEN-API: ${res.status} — ${String(detail).slice(0, 300)}`);
  }
  return data;
}

function base(creds) {
  const c = normalizeCredentials(creds);
  if (!c.idInstance) throw new Error('Не заполнен idInstance');
  if (!c.apiTokenInstance) throw new Error('Не заполнен apiTokenInstance');
  return `${c.apiUrl}/waInstance${c.idInstance}`;
}

export async function getStateInstance(creds) {
  const url = `${base(creds)}/getStateInstance/${normalizeCredentials(creds).apiTokenInstance}`;
  return requestJson(url, { method: 'GET' });
}

export async function sendMessage(creds, { chatId, message }) {
  const c = normalizeCredentials(creds);
  const text = String(message || '').trim();
  if (!chatId) throw new Error('Нет chatId');
  if (!text) throw new Error('Пустое сообщение');
  if (text.length > 4000) throw new Error('Сообщение длиннее 4000 символов');
  const url = `${base(creds)}/sendMessage/${c.apiTokenInstance}`;
  return requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message: text }),
  });
}

export async function receiveNotification(creds, timeoutSeconds = 20) {
  const c = normalizeCredentials(creds);
  const t = Math.min(60, Math.max(5, Number(timeoutSeconds) || 20));
  const url = `${base(creds)}/receiveNotification/${c.apiTokenInstance}?receiveTimeout=${t}`;
  return requestJson(url, { method: 'GET' });
}

export async function deleteNotification(creds, receiptId) {
  const c = normalizeCredentials(creds);
  if (receiptId === undefined || receiptId === null) {
    throw new Error('Нет receiptId');
  }
  const url = `${base(creds)}/deleteNotification/${c.apiTokenInstance}/${receiptId}`;
  return requestJson(url, { method: 'DELETE' });
}

/** Достаёт текст из messageData для текстовых типов, иначе возвращает заглушку. */
export function extractMessageText(messageData) {
  if (!messageData) return { text: '', isText: false, type: 'unknown' };
  const type = messageData.typeMessage || 'unknown';
  const tm = messageData.textMessageData?.textMessage;
  if (typeof tm === 'string' && tm) return { text: tm, isText: true, type };
  const etm = messageData.extendedTextMessageData?.text;
  if (typeof etm === 'string' && etm) return { text: etm, isText: true, type };
  const qm =
    messageData.quotedMessageData?.textMessage ||
    messageData.quotedMessageData?.extendedTextMessageData?.text;
  if (typeof qm === 'string' && qm) return { text: qm, isText: true, type };
  return { text: `[Сообщение типа ${type} — поддерживается только текст]`, isText: false, type };
}

/**
 * Нормализует входящее уведомление к виду, удобному для UI.
 * Возвращает null, если уведомление не является сообщением.
 */
export function normalizeNotification(body) {
  if (!body || typeof body !== 'object') return null;
  const typeWebhook = body.typeWebhook;
  const ts = body.timestamp
    ? body.timestamp * 1000
    : Date.now();
  const idMessage = body.idMessage ? String(body.idMessage) : `${typeWebhook}-${ts}`;

  if (
    typeWebhook === 'incomingMessageReceived' ||
    typeWebhook === 'outgoingMessageReceived' ||
    typeWebhook === 'outgoingAPIMessageReceived'
  ) {
    const senderData = body.senderData || {};
    const messageData = body.messageData || {};
    const chatId = senderData.chatId || senderData.sender || '';
    if (!chatId) return null;
    const { text, isText, type } = extractMessageText(messageData);
    const fromMe =
      typeWebhook === 'outgoingMessageReceived' ||
      typeWebhook === 'outgoingAPIMessageReceived';
    return {
      kind: 'message',
      typeWebhook,
      chatId: String(chatId),
      chatName: senderData.chatName || senderData.senderName || senderData.senderContactName || '',
      senderPhone: senderData.senderPhoneNumber ? String(senderData.senderPhoneNumber) : '',
      text,
      isText,
      messageType: type,
      fromMe,
      timestamp: ts,
      idMessage,
    };
  }
  if (typeWebhook === 'outgoingMessageStatus') {
    return { kind: 'status', typeWebhook, timestamp: ts, idMessage };
  }
  if (typeWebhook === 'stateInstanceChanged') {
    return {
      kind: 'state',
      typeWebhook,
      timestamp: ts,
      state: body.stateInstance?.stateInstance,
    };
  }
  return { kind: 'other', typeWebhook, timestamp: ts, idMessage };
}

export function isWebhookUrlError(message) {
  return /custom webhook url is set/i.test(String(message || ''));
}
