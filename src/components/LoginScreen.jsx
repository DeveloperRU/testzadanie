import { useState } from 'react';
import { DEFAULT_API_URL, getStateInstance } from '../api/greenApi';

export default function LoginScreen({ initial, onSuccess }) {
  const [apiUrl, setApiUrl] = useState(initial?.apiUrl || DEFAULT_API_URL);
  const [idInstance, setIdInstance] = useState(initial?.idInstance || '');
  const [apiTokenInstance, setApiTokenInstance] = useState(initial?.apiTokenInstance || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const creds = {
      apiUrl: apiUrl.trim() || DEFAULT_API_URL,
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
    };
    if (!creds.idInstance || !creds.apiTokenInstance) {
      setError('Заполните idInstance и apiTokenInstance из личного кабинета GREEN-API.');
      return;
    }
    setLoading(true);
    try {
      const state = await getStateInstance(creds);
      const s = state?.stateInstance;
      if (s && s !== 'authorized') {
        setError(
          `Инстанс в состоянии "${s}". Авторизуйте его в console.green-api.com (QR-код в MAX), затем повторите вход.`,
        );
        setLoading(false);
        return;
      }
      onSuccess(creds);
    } catch (err) {
      setError(err.message || 'Не удалось подключиться. Проверьте данные.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo">MAX</div>
        <h1 className="login-title">MAX чат</h1>
        <p className="login-sub">
          Тестовое задание · React + GREEN-API · только текстовые сообщения
        </p>

        <label className="field">
          <span>apiUrl</span>
          <input
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://api.green-api.com"
            autoComplete="url"
          />
        </label>
        <label className="field">
          <span>idInstance</span>
          <input
            value={idInstance}
            onChange={(e) => setIdInstance(e.target.value)}
            placeholder="Например, 7103000000"
            inputMode="numeric"
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>apiTokenInstance</span>
          <input
            value={apiTokenInstance}
            onChange={(e) => setApiTokenInstance(e.target.value)}
            placeholder="Токен из личного кабинета"
            type="password"
            autoComplete="off"
          />
        </label>

        {error && <div className="alert alert-error">{error}</div>}

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Проверка подключения…' : 'Войти в чат'}
        </button>

        <p className="login-hint">
          Данные берутся из{' '}
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
            console.green-api.com
          </a>
          . Получение сообщений — методом ReceiveNotification / DeleteNotification (HTTP API),
          отправка — методом SendMessage.
        </p>
      </form>
    </div>
  );
}
