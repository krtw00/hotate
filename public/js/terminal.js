/**
 * terminal.js — xterm.js ターミナル管理
 * CDNから読み込んだ Terminal, FitAddon を使用する。
 * ターミナル直接入力（PC向け）と input.js 経由入力（モバイルIME向け）の両対応。
 */

const TerminalManager = (() => {
  let term = null;
  let fitAddon = null;
  let onDataCallback = null;

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

    setupTouchScroll(container);

    return term;
  }

  function setupTouchScroll(container) {
    let touchStartY = null;
    let accumulated = 0;
    const SCROLL_THRESHOLD = 15;

    // capture フェーズでターミナル画面全体のtouchmoveを抑止
    const screen = document.getElementById('screen-terminal');
    screen.addEventListener('touchmove', (e) => {
      if (e.target.closest('.input-bar') || e.target.closest('.special-keys-bar')) return;
      e.preventDefault();
    }, { passive: false, capture: true });

    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        accumulated = 0;
      }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (touchStartY === null || !onDataCallback) return;
      e.preventDefault();

      const currentY = e.touches[0].clientY;
      accumulated += touchStartY - currentY;
      touchStartY = currentY;

      const ticks = Math.trunc(accumulated / SCROLL_THRESHOLD);
      if (ticks !== 0) {
        accumulated -= ticks * SCROLL_THRESHOLD;
        const button = ticks > 0 ? 64 : 65;
        const count = Math.abs(ticks);
        for (let i = 0; i < count; i++) {
          onDataCallback('\x1b[<' + button + ';1;1M');
        }
      }
    }, { passive: false });

    container.addEventListener('touchend', () => {
      touchStartY = null;
      accumulated = 0;
    }, { passive: true });
  }

  function onInput(callback) {
    onDataCallback = callback;
  }

  function write(base64Data) {
    if (!term) return;
    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
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
