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

    // Enter key — keydown (desktop + mobile)
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !composing) {
        e.preventDefault();
        submitInput(inputEl);
      }
    });

    // Enter key — beforeinput (Android fallback)
    // Android virtual keyboards often fire insertLineBreak instead of keydown Enter
    inputEl.addEventListener('beforeinput', (e) => {
      if ((e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') && !composing) {
        e.preventDefault();
        submitInput(inputEl);
      }
    });

    // Guard against Safari double-fire
    inputEl.addEventListener('input', () => {
      if (skipNextInput) {
        skipNextInput = false;
      }
    });

    // Send button — use pointerdown (click never fires due to focus loss on input blur)
    sendBtnEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (composing) return;
      submitInput(inputEl);
      inputEl.focus();
    });

    // Special key buttons — also use pointerdown
    specialKeyEls.forEach(btn => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const key = btn.dataset.key;
        if (key) {
          sendRaw(key);
          inputEl.focus();
        }
      });
    });
  }

  function submitInput(inputEl) {
    const text = inputEl.value;
    if (text) {
      sendText(text + '\r');
    } else {
      sendText('\r');
    }
    inputEl.value = '';
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
