/**
 * terminal.js — xterm.js ターミナル管理
 */

const TerminalManager = (() => {
  let term = null;
  let fitAddon = null;
  let onDataCallback = null;
  let mouseMode = "none";
  let selectMode = false;
  let anchorRow = null; // 選択開始行
  let cleanups = [];

  function addCleanup(fn) {
    cleanups.push(fn);
  }

  function create(container) {
    if (term) destroy();

    term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', monospace",
      theme: {
        background: "#020408",
        foreground: "#e6edf3",
        cursor: "#e6edf3",
        selectionBackground: "#264f78",
        black: "#0a0e14",
        red: "#f85149",
        green: "#3fb950",
        yellow: "#d29922",
        blue: "#79c0ff",
        magenta: "#d2a8ff",
        cyan: "#76e3ea",
        white: "#e6edf3",
        brightBlack: "#6e7681",
        brightRed: "#ffa198",
        brightGreen: "#56d364",
        brightYellow: "#e3b341",
        brightBlue: "#a5d6ff",
        brightMagenta: "#e2c5ff",
        brightCyan: "#b3f0ff",
        brightWhite: "#ffffff",
      },
      scrollback: 5000,
      convertEol: true,
    });

    fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    const onDataDisposable = term.onData((data) => {
      if (onDataCallback) onDataCallback(data);
    });
    addCleanup(() => onDataDisposable.dispose());

    const onResize = () => {
      if (fitAddon) fitAddon.fit();
    };
    window.addEventListener("resize", onResize);
    addCleanup(() => window.removeEventListener("resize", onResize));

    setupCopyPaste();
    setupSelectMode();
    setupTouchScroll();
    setupWheelScroll();
    setupAutoClipboard();

    return term;
  }

  function setupCopyPaste() {
    if (!term) return;

    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown") return true;
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.shiftKey && e.key === "C") {
        e.preventDefault(); copySelection(); return false;
      }
      if (ctrl && e.shiftKey && e.key === "V") {
        e.preventDefault(); pasteFromClipboard(); return false;
      }
      if (ctrl && !e.shiftKey && e.key === "c") {
        if (term.hasSelection()) {
          e.preventDefault(); copySelection(); return false;
        }
        return true;
      }
      if (ctrl && !e.shiftKey && e.key === "v") {
        e.preventDefault(); pasteFromClipboard(); return false;
      }
      return true;
    });

    const onPaste = (e) => {
      const screen = document.getElementById("screen-terminal");
      if (!screen || !screen.classList.contains("active")) return;
      const text = e.clipboardData && e.clipboardData.getData("text");
      if (text && onDataCallback) {
        e.preventDefault();
        onDataCallback(text);
      }
    };
    document.addEventListener("paste", onPaste);
    addCleanup(() => document.removeEventListener("paste", onPaste));

    const el = term.element;
    if (el) {
      const onContextMenu = (e) => {
        e.preventDefault();
        if (term.hasSelection()) { copySelection(); }
        else { pasteFromClipboard(); }
      };
      el.addEventListener("contextmenu", onContextMenu);
      addCleanup(() => el.removeEventListener("contextmenu", onContextMenu));
    }
  }

  // タッチで行選択
  function setupSelectMode() {
    if (!term) return;
    const el = term.element;
    if (!el) return;

    const onTouchEnd = (e) => {
      if (!selectMode) return;
      e.preventDefault();
      e.stopImmediatePropagation();

      const touch = e.changedTouches[0];
      const { row } = clientToCell(touch.clientX, touch.clientY);
      // buffer row (viewport relative)
      const bufRow = row - 1;

      if (anchorRow === null) {
        // 1st tap: select single line
        anchorRow = bufRow;
        term.select(0, bufRow, term.cols);
        showToast("Line " + row + " selected — tap another line for range");
      } else {
        // 2nd tap: select range
        const startRow = Math.min(anchorRow, bufRow);
        const endRow = Math.max(anchorRow, bufRow);
        const lineCount = endRow - startRow + 1;
        term.select(0, startRow, term.cols * lineCount);
        anchorRow = null;
        showToast(lineCount + " lines selected — tap Copy");
      }
    };
    el.addEventListener("touchend", onTouchEnd, { capture: true });
    addCleanup(() => el.removeEventListener("touchend", onTouchEnd, { capture: true }));
  }

  function copySelection() {
    if (!term) return;
    const sel = term.getSelection();
    if (!sel) return;
    navigator.clipboard.writeText(sel).then(() => {
      term.clearSelection();
      showToast("Copied");
    }).catch(() => {});
  }

  function pasteFromClipboard() {
    navigator.clipboard.readText().then((text) => {
      if (text && onDataCallback) onDataCallback(text);
    }).catch(() => {});
  }

  function doCopy() {
    if (!term) return;
    if (term.hasSelection()) {
      copySelection();
    } else {
      term.selectAll();
      copySelection();
    }
    // コピー後にセレクトモード解除
    if (selectMode) {
      selectMode = false;
      anchorRow = null;
      const btn = document.getElementById("btn-select");
      if (btn) btn.style.background = "";
    }
  }

  function doPaste() {
    pasteFromClipboard();
  }

  function toggleSelect() {
    selectMode = !selectMode;
    anchorRow = null;
    if (selectMode) {
      term.clearSelection();
      showToast("Select mode: tap a line");
    }
    return selectMode;
  }

  function showToast(msg) {
    let t = document.getElementById("copy-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "copy-toast";
      t.style.cssText = "position:fixed;top:48px;left:50%;transform:translateX(-50%);background:#3fb950;color:#000;padding:4px 16px;border-radius:4px;font-size:12px;font-family:monospace;z-index:9999;opacity:0;transition:opacity .2s;pointer-events:none;";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    setTimeout(() => { t.style.opacity = "0"; }, 1500);
  }

  function detectMouseMode(text) {
    const prev = mouseMode;
    if (text.includes("\x1b[?1006h")) { mouseMode = "sgr"; }
    else if (text.includes("\x1b[?1000h")) { mouseMode = "x10"; }
    if (text.includes("\x1b[?1000l") && text.includes("\x1b[?1006l")) { mouseMode = "none"; }
    if (mouseMode !== prev) {
      console.log("[hotate:mouse]", prev, "→", mouseMode);
    }
    // デバッグ: 画面上にmouseModeを表示
    let dbg = document.getElementById("hotate-mouse-dbg");
    if (!dbg) {
      dbg = document.createElement("div");
      dbg.id = "hotate-mouse-dbg";
      dbg.style.cssText = "position:fixed;top:4px;right:4px;background:rgba(0,0,0,0.8);color:#0f0;font-size:12px;padding:2px 6px;z-index:99999;border-radius:4px;pointer-events:none;";
      document.body.appendChild(dbg);
    }
    dbg.textContent = "mouse:" + mouseMode;
  }

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

  function scrollSeq(up, col, row) {
    col = col || 1; row = row || 1;
    if (mouseMode === "sgr") {
      const btn = up ? 64 : 65;
      return "\x1b[<" + btn + ";" + col + ";" + row + "M";
    }
    if (mouseMode === "x10") {
      const btn = up ? 96 : 97;
      return "\x1b[M" + String.fromCharCode(btn, 32 + col, 32 + row);
    }
    return up ? "\x1b[A" : "\x1b[B";
  }

  function setupTouchScroll() {
    let touchStartY = null;
    let accumulated = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    const SCROLL_THRESHOLD = 15;

    const onTouchStart = (e) => {
      const screen = document.getElementById("screen-terminal");
      if (!screen || !screen.classList.contains("active")) return;
      if (e.target.closest(".input-bar") || e.target.closest(".special-keys-bar") || e.target.closest(".tmux-tabs-bar")) return;
      if (selectMode) return;
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        accumulated = 0;
      }
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    addCleanup(() => document.removeEventListener("touchstart", onTouchStart, { capture: true }));

    const onTouchMove = (e) => {
      const screen = document.getElementById("screen-terminal");
      if (!screen || !screen.classList.contains("active")) return;
      if (e.target.closest(".input-bar") || e.target.closest(".special-keys-bar") || e.target.closest(".tmux-tabs-bar")) return;
      if (selectMode) return;
      e.preventDefault();
      e.stopImmediatePropagation();

      if (touchStartY === null || !onDataCallback) return;
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
        console.log("[hotate:scroll]", "mode=" + mouseMode, "dir=" + (ticks > 0 ? "up" : "down"), "ticks=" + count, "seq=" + JSON.stringify(seq));
        for (let i = 0; i < count; i++) { onDataCallback(seq); }
      }
    };
    document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    addCleanup(() => document.removeEventListener("touchmove", onTouchMove, { capture: true }));

    const onTouchEnd = (e) => {
      if (selectMode) return;
      touchStartY = null;
      accumulated = 0;
    };
    document.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
    addCleanup(() => document.removeEventListener("touchend", onTouchEnd, { capture: true }));
  }

  function setupWheelScroll() {
    if (!term) return;
    const el = term.element;
    if (!el) return;
    const onWheel = (e) => {
      if (!onDataCallback) return;
      // Shift+wheel: use xterm.js native scrollback (bypass tmux)
      if (e.shiftKey) return;
      e.preventDefault();
      const lines = Math.max(1, Math.abs(Math.round(e.deltaY / 40)));
      const { col, row } = clientToCell(e.clientX, e.clientY);
      const seq = scrollSeq(e.deltaY < 0, col, row);
      for (let i = 0; i < lines; i++) { onDataCallback(seq); }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    addCleanup(() => el.removeEventListener("wheel", onWheel));
  }

  function setupAutoClipboard() {
    if (!term) return;
    // Auto-copy on selection (works for both normal and Shift+drag in tmux mouse mode)
    const onSelectionChangeDisposable = term.onSelectionChange(() => {
      if (!term.hasSelection()) return;
      const sel = term.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel).then(() => {
          showToast("Copied");
        }).catch(() => {});
      }
    });
    addCleanup(() => onSelectionChangeDisposable.dispose());
  }

  function onInput(callback) { onDataCallback = callback; }

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

  function fit() { if (fitAddon) fitAddon.fit(); }

  function destroy() {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    if (term) { term.dispose(); term = null; }
    fitAddon = null;
    onDataCallback = null;
    mouseMode = "none";
    selectMode = false;
    anchorRow = null;
  }

  function onResize(callback) {
    if (!term) return;
    term.onResize(({ cols, rows }) => callback(cols, rows));
  }

  function focus() { if (term) term.focus(); }

  return { create, write, getSize, fit, destroy, onResize, onInput, focus, doCopy, doPaste, toggleSelect };
})();
