/**
 * input.js — IME対応入力管理
 * compositionstart/end でIME状態を追跡し、変換確定後にのみ送信する。
 * 特殊キーマッピング（Tab, Ctrl+C等）にも対応。
 */

const InputManager = (() => {
  let composing = false;
  let onSend = null; // callback: (base64String) => void
  let skipNextInput = false;

  function init(inputEl, sendBtnEl, specialKeyEls, sendCallback) {
    onSend = sendCallback;

    // IME composition tracking
    inputEl.addEventListener('compositionstart', () => {
      composing = true;
    });

    inputEl.addEventListener('compositionend', (e) => {
      composing = false;
      // Safari fires an extra input event after compositionend
      skipNextInput = true;
      sendText(e.data);
      inputEl.value = '';
    });

    // Enter key or normal input submission
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !composing) {
        e.preventDefault();
        const text = inputEl.value;
        if (text) {
          sendText(text + '\n');
        } else {
          sendText('\n');
        }
        inputEl.value = '';
      }
    });

    // Guard against Safari double-fire
    inputEl.addEventListener('input', () => {
      if (skipNextInput) {
        skipNextInput = false;
      }
    });

    // Send button
    sendBtnEl.addEventListener('click', () => {
      if (composing) return;
      const text = inputEl.value;
      if (text) {
        sendText(text + '\n');
      } else {
        sendText('\n');
      }
      inputEl.value = '';
      inputEl.focus();
    });

    // Special key buttons
    specialKeyEls.forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (key) {
          sendRaw(key);
          inputEl.focus();
        }
      });
    });
  }

  function sendText(text) {
    if (!onSend) return;
    const encoded = btoa(unescape(encodeURIComponent(text)));
    onSend(encoded);
  }

  function sendRaw(str) {
    if (!onSend) return;
    // Convert escape sequences from data-key attributes
    const resolved = str
      .replace(/\\t/g, '\t')
      .replace(/\\n/g, '\n')
      .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    const bytes = new TextEncoder().encode(resolved);
    const base64 = btoa(String.fromCharCode(...bytes));
    onSend(base64);
  }

  return { init };
})();
