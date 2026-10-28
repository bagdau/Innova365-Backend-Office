'use strict';
(() => {
  const input = document.getElementById('code');
  const button = document.getElementById('activate');
  const message = document.getElementById('message');
  const format = (value) => {
    const c = value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 12);
    return [c.slice(0, 4), c.slice(4, 8), c.slice(8)].filter(Boolean).join('-');
  };
  input.addEventListener('input', () => { input.value = format(input.value); message.className = 'msg'; });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') button.click(); });
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    message.className = 'msg';
    try {
      const result = await window.innova.activate(input.value);
      if (result.ok) { window.close(); return; }
      message.textContent = result.error || 'Не удалось активировать приложение';
    } catch { message.textContent = 'Нет связи с сервером. Повторите попытку.'; }
    message.className = 'msg err show';
    button.disabled = false;
  });
  input.focus();
})();
