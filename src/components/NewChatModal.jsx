import { useState } from 'react';

export default function NewChatModal({ onClose, onCreate }) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    setError('');
    try {
      onCreate(phone);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="modal-title">Новый чат</h2>
        <p className="modal-sub">Введите номер телефона получателя в MAX</p>
        <label className="field">
          <span>Номер телефона</span>
          <input
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="79991234567"
            inputMode="tel"
          />
        </label>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn-primary">
            Создать чат
          </button>
        </div>
      </form>
    </div>
  );
}
