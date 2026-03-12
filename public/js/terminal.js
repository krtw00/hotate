/**
 * terminal.js — xterm.js ターミナル管理
 * CDNから読み込んだ Terminal, FitAddon を使用する。
 * ターミナル直接入力（PC向け）と input.js 経由入力（モバイルIME向け）の両対応。
 */

const TerminalManager = (() => {
  let term = null;
  let fitAddon = null;
  let onDataCallback = null;
  // tmuxが要求したマウスモードを追跡
  let mouseMode = 'none'; // 'none' | 'x10' | 'sgr'

  // デバッグ用オーバーレイ（原因特定後に削除）
  let debugEl = null;
  let debugLog = [];
  function dbg(msg) {
    debugLog.push(msg);
    if (debugLog.length > 8) debugLog.shift();
    if (!debugEl) {
      debugEl = document.createElement('div');
      debugEl.style.cssText = 'position:fixed;top:0;left:0;right:0;background:rgba(0,0,0,0.85);color:#0f0;font:11px monospace;padding:4px;z-index:99999;pointer-events:none;white-space:pre';
      document.body.appendChild(debugEl);
    }
    debugEl.textContent = debugLog.join('\n');
  }

  function create(container) {
    if (term) destroy();

    term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', monospace",
      theme: {
        background: '#020408',
        foreground: '#e6edf3',
        cursor: '#e6edf3',
        selectionBackground: '#264f78',
        black: '#0a0e14',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#79c0ff',
        magenta: '#d2a8ff',
        cyan: '#76e3ea',
        white: '#e6edf3',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#a5d6ff',
        brightMagenta: '#e2c5ff',
        brightCyan: '#b3f0ff',
        brightWhite: '#ffffff',
      },
      scrollback: 5000,
      convertEol: true,
    });

    fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    // Direct keyboard input → WebSocket
    term.onData((data) => {
      if (onDataCallback) onDataCallback(data);
    });

    window.addEventListener('resize', () => {
      if (fitAddon) fitAddon.fit();
    });

    setupTouchScroll();
    setupWheelScroll();

    return term;
  }

  // サーバーからの出力を解析してマウスモードを追跡
  function detectMouseMode(text) {
    // SGRモード有効: \x1b[?1006h
    if (text.includes('\x1b[?1006h')) { mouseMode = 'sgr'; dbg('MODE: sgr (?1006h)'); }
    // X10モード有効: \x1b[?1000h
    else if (text.includes('\x1b[?1000h')) { mouseMode = 'x10'; dbg('MODE: x10 (?1000h)'); }
    // マウスモード無効: \x1b[?1000l or \x1b[?1006l
    if (text.includes('\x1b[?1000l') && text.includes('\x1b[?1006l')) { mouseMode = 'none'; dbg('MODE: none (disabled)'); }
    // DECSET関連のエスケープを全て記録
    const decsets = text.match(/\x1b\[\?[\d;]+[hl]/g);
    if (decsets) dbg('DECSET: ' + decsets.map(s => s.replace('\x1b', 'ESC')).join(' '));
  }

  // クライアント座標をターミナルセル座標に変換
  function clientToCell(clientX, clientY) {
    if (!term) return { col: 1, row: 1 };
    const el = term.element;
    if (!el) return { col: 1, row: 1 };
    const rect = el.getBoundingClientRect();
    const cellWidth = rect.width / term.cols;
    const cellHeight = rect.height / term.rows;
    const col = Math.max(1, Math.min(term.cols, Math.floor((clientX - rect.left) / cellWidth) + 1));
    const row = Math.max(1, Math.min(term.rows, Math.floor((clientY - rect.top) / cellHeight) + 1));
    return { col, row };
  }

  // マウスモードに応じたスクロールシーケンスを生成
  function scrollSeq(up, col, row) {
    col = col || 1;
    row = row || 1;
    if (mouseMode === 'sgr') {
      const btn = up ? 64 : 65;
      return '\x1b[<' + btn + ';' + col + ';' + row + 'M';
    }
    if (mouseMode === 'x10') {
      const btn = up ? 96 : 97;
      return '\x1b[M' + String.fromCharCode(btn, 32 + col, 32 + row);
    }
    // mouseMode=none: Up/Downキーでフォールバック
    return up ? '\x1b[A' : '\x1b[B';
  }

  function setupTouchScroll() {
    let touchStartY = null;
    let accumulated = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    const SCROLL_THRESHOLD = 15;

    // captureフェーズで最優先にタッチを横取り（xterm.jsのstopPropagation対策）
    document.addEventListener('touchstart', (e) => {
      const screen = document.getElementById('screen-terminal');
      if (!screen || !screen.classList.contains('active')) return;
      if (e.target.closest('.input-bar') || e.target.closest('.special-keys-bar')) return;
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        accumulated = 0;
      }
    }, { passive: true, capture: true });

    document.addEventListener('touchmove', (e) => {
      const screen = document.getElementById('screen-terminal');
      if (!screen || !screen.classList.contains('active')) return;
      if (e.target.closest('.input-bar') || e.target.closest('.special-keys-bar')) return;
      e.preventDefault();
      e.stopImmediatePropagation();

      if (touchStartY === null || !onDataCallback) { dbg('TOUCH: skip (startY=' + touchStartY + ' cb=' + !!onDataCallback + ')'); return; }

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      accumulated += touchStartY - currentY;
      touchStartY = currentY;
      lastTouchX = currentX;
      lastTouchY = currentY;

      const ticks = Math.trunc(accumulated / SCROLL_THRESHOLD);
      if (ticks !== 0) {
        accumulated -= ticks * SCROLL_THRESHOLD;
        const { col, row } = clientToCell(lastTouchX, lastTouchY);
        const seq = scrollSeq(ticks > 0, col, row);
        const count = Math.abs(ticks);
        dbg('TOUCH: mode=' + mouseMode + ' col=' + col + ' row=' + row + ' dir=' + (ticks > 0 ? 'up' : 'down') + ' n=' + count);
        for (let i = 0; i < count; i++) {
          onDataCallback(seq);
        }
      }
    }, { passive: false, capture: true });

    document.addEventListener('touchend', () => {
      touchStartY = null;
      accumulated = 0;
    }, { passive: true, capture: true });
  }

  function setupWheelScroll() {
    if (!term) return;
    const el = term.element;
    if (!el) return;

    el.addEventListener('wheel', (e) => {
      if (!onDataCallback) return;
      e.preventDefault();
      const lines = Math.max(1, Math.abs(Math.round(e.deltaY / 40)));
      const { col, row } = clientToCell(e.clientX, e.clientY);
      const seq = scrollSeq(e.deltaY < 0, col, row);
      for (let i = 0; i < lines; i++) {
        onDataCallback(seq);
      }
    }, { passive: false });
  }

  function onInput(callback) {
    onDataCallback = callback;
  }

  function write(base64Data) {
    if (!term) return;
    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    detectMouseMode(text);
    term.write(text);
  }

  function getSize() {
    if (!term) return { cols: 80, rows: 24 };
    return { cols: term.cols, rows: term.rows };
  }

  function fit() {
    if (fitAddon) fitAddon.fit();
  }

  function destroy() {
    if (term) {
      term.dispose();
      term = null;
      fitAddon = null;
      mouseMode = 'none';
    }
  }

  function onResize(callback) {
    if (!term) return;
    term.onResize(({ cols, rows }) => callback(cols, rows));
  }

  function focus() {
    if (term) term.focus();
  }

  return { create, write, getSize, fit, destroy, onResize, onInput, focus };
})();
