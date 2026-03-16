/**
 * app.js — SPA管理、WebSocket接続、画面遷移
 */

const App = (() => {
  let ws = null;
  let selectedHostId = null;
  let hosts = [];
  let connectedHost = null;
  let reconnecting = false;
  let reconnectAttempts = 0;
  let intentionalDisconnect = false;
  let tmuxPollTimer = null;
  let tmuxWindows = [];

  // DOM elements
  const screenConnect = document.getElementById('screen-connect');
  const screenTerminal = document.getElementById('screen-terminal');
  const hostList = document.getElementById('host-list');
  const btnConnect = document.getElementById('btn-connect');
  const btnDisconnect = document.getElementById('btn-disconnect');
  const btnAddHost = document.getElementById('btn-add-host');
  const connectPassword = document.getElementById('connect-password');
  const authPasswordArea = document.getElementById('auth-password');
  const authKeyArea = document.getElementById('auth-key');
  const authDividerLabel = document.getElementById('auth-divider-label');
  const keyPathDisplay = document.getElementById('key-path-display');
  const connectStatus = document.getElementById('connect-status');
  const headerHost = document.getElementById('header-host');
  const headerPort = document.getElementById('header-port');
  const headerUser = document.getElementById('header-user');
  const terminalContainer = document.getElementById('terminal-container');

  // Modal elements
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalName = document.getElementById('modal-name');
  const modalHost = document.getElementById('modal-host');
  const modalPort = document.getElementById('modal-port');
  const modalUsername = document.getElementById('modal-username');
  const modalAuthPassword = document.getElementById('modal-auth-password');
  const modalAuthKey = document.getElementById('modal-auth-key');
  const modalPassword = document.getElementById('modal-password');
  const modalPasswordGroup = document.getElementById('modal-password-group');
  const modalKeypath = document.getElementById('modal-keypath');
  const modalKeypathGroup = document.getElementById('modal-keypath-group');
  const btnModalSave = document.getElementById('btn-modal-save');
  const btnModalCancel = document.getElementById('btn-modal-cancel');
  const btnModalClose = document.getElementById('btn-modal-close');
  const btnModalDelete = document.getElementById('btn-modal-delete');

  let modalMode = 'add'; // 'add' or 'edit'
  let editingHostId = null;

  // ===== Init =====
  async function init() {
    await loadHosts();
    bindEvents();
  }

  function bindEvents() {
    btnConnect.addEventListener('click', connect);
    btnDisconnect.addEventListener('click', disconnect);
    btnAddHost.addEventListener('click', () => openModal('add'));
    btnModalSave.addEventListener('click', saveHost);
    btnModalCancel.addEventListener('click', closeModal);
    btnModalClose.addEventListener('click', closeModal);
    btnModalDelete.addEventListener('click', deleteHost);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    modalAuthPassword.addEventListener('click', () => setModalAuth('password'));
    modalAuthKey.addEventListener('click', () => setModalAuth('key'));

    // Input manager init
    const sshInput = document.getElementById('ssh-input');
    const btnSend = document.getElementById('btn-send');
    const specialKeys = document.querySelectorAll('.key-btn');
    InputManager.init(sshInput, btnSend, specialKeys, sendInput);
  }

  // ===== Hosts CRUD =====
  async function loadHosts() {
    try {
      const res = await fetch('/api/hosts');
      if (!res.ok) throw new Error('Failed to load hosts');
      hosts = await res.json();
      renderHosts();
    } catch (err) {
      console.error('Failed to load hosts:', err);
    }
  }

  function renderHosts() {
    hostList.innerHTML = '';

    if (hosts.length === 0) {
      hostList.innerHTML = '<div class="text-xs text-muted text-center" style="padding: 24px;">No saved hosts. Click "Add" to create one.</div>';
      return;
    }

    const colors = ['blue', 'green', 'purple'];
    hosts.forEach((host, i) => {
      const color = colors[i % colors.length];
      const item = document.createElement('div');
      item.className = 'host-item' + (host.id === selectedHostId ? ' selected' : '');
      item.dataset.id = host.id;
      item.innerHTML = `
        <div class="host-item-left">
          <div class="host-icon ${color}">
            <svg class="icon-sm" style="color: var(--icon-color)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"/>
            </svg>
          </div>
          <div>
            <div class="flex-center gap-2">
              <span class="host-name">${escapeHtml(host.name)}</span>
              <span class="auth-badge ${host.authType}">${host.authType === 'key' ? 'KEY' : 'PASS'}</span>
            </div>
            <div class="host-detail mono">${escapeHtml(host.username)}@${escapeHtml(host.host)}:${host.port}</div>
          </div>
        </div>
        <div class="host-item-right">
          <button class="btn-edit" data-edit-id="${host.id}" title="Edit">
            <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
            </svg>
          </button>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-edit')) return;
        selectHost(host.id);
      });

      const editBtn = item.querySelector('.btn-edit');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal('edit', host.id);
      });

      hostList.appendChild(item);
    });
  }

  function selectHost(id) {
    selectedHostId = id;
    const host = hosts.find(h => h.id === id);
    if (!host) return;

    renderHosts();

    // Update auth area
    if (host.authType === 'key') {
      authPasswordArea.classList.add('hidden');
      authKeyArea.classList.remove('hidden');
      authDividerLabel.textContent = 'SSH KEY';
      keyPathDisplay.textContent = host.keyPath || '~/.ssh/id_ed25519';
    } else {
      authPasswordArea.classList.remove('hidden');
      authKeyArea.classList.add('hidden');
      authDividerLabel.textContent = 'PASSWORD';
    }

    // Update connect button
    btnConnect.disabled = false;
    btnConnect.innerHTML = `
      <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
      Connect to ${escapeHtml(host.name)}
    `;
  }

  // ===== Modal =====
  function openModal(mode, hostId) {
    modalMode = mode;
    editingHostId = hostId || null;

    if (mode === 'edit' && hostId) {
      const host = hosts.find(h => h.id === hostId);
      if (!host) return;
      modalTitle.textContent = 'Edit Host';
      modalName.value = host.name;
      modalHost.value = host.host;
      modalPort.value = host.port;
      modalUsername.value = host.username;
      modalPassword.value = '';
      modalKeypath.value = host.keyPath || '~/.ssh/id_ed25519';
      setModalAuth(host.authType);
      btnModalDelete.classList.remove('hidden');
    } else {
      modalTitle.textContent = 'Add Host';
      modalName.value = '';
      modalHost.value = '';
      modalPort.value = '22';
      modalUsername.value = '';
      modalPassword.value = '';
      modalKeypath.value = '~/.ssh/id_ed25519';
      setModalAuth('password');
      btnModalDelete.classList.add('hidden');
    }

    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  function setModalAuth(type) {
    if (type === 'key') {
      modalAuthPassword.classList.remove('active');
      modalAuthKey.classList.add('active');
      modalPasswordGroup.classList.add('hidden');
      modalKeypathGroup.classList.remove('hidden');
    } else {
      modalAuthPassword.classList.add('active');
      modalAuthKey.classList.remove('active');
      modalPasswordGroup.classList.remove('hidden');
      modalKeypathGroup.classList.add('hidden');
    }
  }

  function getModalAuthType() {
    return modalAuthKey.classList.contains('active') ? 'key' : 'password';
  }

  async function saveHost() {
    const authType = getModalAuthType();
    const data = {
      name: modalName.value.trim(),
      host: modalHost.value.trim(),
      port: parseInt(modalPort.value) || 22,
      username: modalUsername.value.trim(),
      authType,
    };

    if (!data.name || !data.host || !data.username) {
      alert('Name, Host, Username are required');
      return;
    }

    if (authType === 'password') {
      if (modalMode === 'add' && !modalPassword.value) {
        alert('Password is required');
        return;
      }
      if (modalPassword.value) data.password = modalPassword.value;
    } else {
      data.keyPath = modalKeypath.value.trim() || '~/.ssh/id_ed25519';
    }

    try {
      let res;
      if (modalMode === 'edit' && editingHostId) {
        res = await fetch(`/api/hosts/${editingHostId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        res = await fetch('/api/hosts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to save');
        return;
      }

      closeModal();
      await loadHosts();

      // Auto-select newly created host
      if (modalMode === 'add' && hosts.length > 0) {
        selectHost(hosts[hosts.length - 1].id);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function deleteHost() {
    if (!editingHostId) return;
    if (!confirm('Delete this host?')) return;

    try {
      const res = await fetch(`/api/hosts/${editingHostId}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        alert('Failed to delete');
        return;
      }
      if (selectedHostId === editingHostId) {
        selectedHostId = null;
        btnConnect.disabled = true;
        btnConnect.innerHTML = `
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          Select a host
        `;
      }
      closeModal();
      await loadHosts();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  // ===== SSH Connection =====
  function connect() {
    if (!selectedHostId) return;
    const host = hosts.find(h => h.id === selectedHostId);
    if (!host) return;

    // For password auth, include password in the host data on the server side
    // If the host uses password auth, we may need to update it
    if (host.authType === 'password' && connectPassword.value) {
      // Update password on the server before connecting
      fetch(`/api/hosts/${host.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: connectPassword.value }),
      }).then(() => {
        startSSH(host);
      }).catch(err => {
        setStatus('Error: ' + err.message, 'red');
      });
    } else {
      startSSH(host);
    }
  }

  function startSSH(host) {
    setStatus('Connecting...', 'blue');
    btnConnect.disabled = true;
    connectedHost = host;
    intentionalDisconnect = false;

    openWebSocket(host);
  }

  function openWebSocket(host) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${location.host}/ws?hostId=${host.id}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      reconnectAttempts = 0;
      reconnecting = false;
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'connected':
          if (!reconnecting) showTerminal(host);
          reconnecting = false;
          break;
        case 'output':
          TerminalManager.write(msg.payload);
          break;
        case 'pong':
          break;
        case 'tmux-result':
          handleTmuxResult(msg.id, msg.payload);
          break;
        case 'tmux-attached':
          onTmuxAttached();
          break;
        case 'tmux-detached':
          stopTmuxPoll();
          TerminalManager.fit();
          break;
        case 'error':
          setStatus('Error: ' + msg.payload.message, 'red');
          btnConnect.disabled = false;
          if (screenTerminal.classList.contains('active')) {
            alert('SSH Error: ' + msg.payload.message);
            disconnect();
          }
          break;
        case 'exit':
          disconnect();
          break;
      }
    };

    ws.onclose = () => {
      if (intentionalDisconnect) return;
      if (screenTerminal.classList.contains('active') && connectedHost) {
        attemptReconnect();
      }
    };

    ws.onerror = () => {
      if (!reconnecting) {
        setStatus('Connection failed', 'red');
        btnConnect.disabled = false;
      }
    };
  }

  function attemptReconnect() {
    const MAX_RECONNECT = 10;
    if (reconnectAttempts >= MAX_RECONNECT || !connectedHost) {
      disconnect();
      return;
    }

    reconnecting = true;
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts - 1), 10000);
    console.log(`[WS] reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT})`);

    setTimeout(() => {
      if (!connectedHost || intentionalDisconnect) return;
      openWebSocket(connectedHost);
    }, delay);
  }

  function showTerminal(host) {
    screenConnect.classList.remove('active');
    screenTerminal.classList.add('active');

    headerHost.textContent = host.name;
    headerPort.textContent = ':' + host.port;
    headerUser.textContent = host.username + '@' + host.host;

    TerminalManager.create(terminalContainer);

    // Direct terminal input → WebSocket (PC keyboard)
    TerminalManager.onInput((data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        const encoded = btoa(unescape(encodeURIComponent(data)));
        ws.send(JSON.stringify({ type: 'input', payload: encoded }));
      }
    });

    // Send initial resize
    setTimeout(() => {
      TerminalManager.fit();
      const size = TerminalManager.getSize();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', payload: size }));
      }
    }, 100);

    // Listen for terminal resize
    TerminalManager.onResize((cols, rows) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', payload: { cols, rows } }));
      }
    });

    // Focus terminal for direct keyboard input
    TerminalManager.focus();

  }

  function disconnect() {
    intentionalDisconnect = true;
    connectedHost = null;
    reconnecting = false;
    reconnectAttempts = 0;
    stopTmuxPoll();
    if (ws) {
      ws.close();
      ws = null;
    }
    TerminalManager.destroy();

    screenTerminal.classList.remove('active');
    screenConnect.classList.add('active');

    setStatus('Disconnected', 'red');
    btnConnect.disabled = false;
  }

  function sendInput(base64Data) {
    const state = ws ? ws.readyState : 'null';
    console.log(`[WS] sendInput: readyState=${state}, data=${atob(base64Data).replace(/\r/g,'\\r').replace(/\n/g,'\\n')}`);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', payload: base64Data }));
    } else {
      console.warn('[WS] sendInput DROPPED — ws not open');
    }
  }

  function setStatus(text, color) {
    const dot = connectStatus.querySelector('.status-dot');
    const label = connectStatus.querySelector('span');
    dot.className = 'status-dot ' + color;
    label.textContent = text;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== tmux tab management =====
  const tmuxTabsEl = document.getElementById('tmux-tabs');
  let tmuxSession = null; // detected tmux session name

  function onTmuxAttached() {
    if (tmuxPollTimer) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // Get attached session name
    ws.send(JSON.stringify({
      type: 'tmux-query',
      id: 'sessions',
      payload: "tmux list-sessions -F '#{session_name}:#{session_attached}'",
    }));
  }

  function stopTmuxPoll() {
    if (tmuxPollTimer) { clearInterval(tmuxPollTimer); tmuxPollTimer = null; }
    tmuxSession = null;
    tmuxWindows = [];
    if (tmuxTabsEl) { tmuxTabsEl.innerHTML = ''; tmuxTabsEl.classList.add('hidden'); }
  }

  function queryTmuxWindows() {
    if (!ws || ws.readyState !== WebSocket.OPEN || !tmuxSession) return;
    ws.send(JSON.stringify({
      type: 'tmux-query',
      id: 'windows',
      payload: `tmux list-windows -t ${tmuxSession} -F '#{window_index}:#{window_name}:#{window_active}'`,
    }));
  }

  function handleTmuxResult(id, payload) {
    const stdout = (payload.stdout || '').trim();

    if (payload.error || !stdout) {
      if (tmuxSession) {
        stopTmuxPoll();
        TerminalManager.fit();
      }
      return;
    }

    if (id === 'sessions') {
      // Parse "name:attached" lines, pick attached session
      const sessions = stdout.split('\n').filter(Boolean).map(line => {
        const idx = line.lastIndexOf(':');
        return { name: line.substring(0, idx), attached: line.substring(idx + 1) === '1' };
      });
      const target = sessions.find(s => s.attached) || sessions[0];
      if (target) {
        tmuxSession = target.name;
        queryTmuxWindows();
        tmuxPollTimer = setInterval(queryTmuxWindows, 3000);
      }
    } else if (id === 'windows') {
      // Parse "index:name:active" lines
      const lines = stdout.split('\n').filter(Boolean);
      tmuxWindows = lines.map(line => {
        const parts = line.split(':');
        return {
          index: parseInt(parts[0], 10),
          name: parts[1] || '',
          active: parts[2] === '1',
        };
      });
      renderTmuxTabs();
    }
    // id === 'switch' — ignore, next poll will update
  }

  function renderTmuxTabs() {
    if (!tmuxTabsEl) return;
    if (tmuxWindows.length === 0) {
      tmuxTabsEl.classList.add('hidden');
      return;
    }

    tmuxTabsEl.classList.remove('hidden');
    tmuxTabsEl.innerHTML = '';

    tmuxWindows.forEach(win => {
      const btn = document.createElement('button');
      btn.className = 'tmux-tab' + (win.active ? ' active' : '');
      btn.innerHTML = `<span class="tmux-tab-index">${win.index}</span>${escapeHtml(win.name)}`;
      btn.addEventListener('click', () => selectTmuxWindow(win.index));
      tmuxTabsEl.appendChild(btn);
    });

    // Detach button
    const detachBtn = document.createElement('button');
    detachBtn.className = 'tmux-tab tmux-detach-btn';
    detachBtn.textContent = 'detach';
    detachBtn.addEventListener('click', () => {
      // Send Ctrl+B d through PTY and immediately clean up tabs
      sendInput(btoa('\x02d'));
      stopTmuxPoll();
      TerminalManager.fit();
    });
    tmuxTabsEl.appendChild(detachBtn);

    TerminalManager.fit();
  }

  function selectTmuxWindow(index) {
    if (!ws || ws.readyState !== WebSocket.OPEN || !tmuxSession) return;
    // Send Ctrl+B then window index through the PTY (tmux prefix + number)
    const prefix = '\x02'; // Ctrl+B (default tmux prefix)
    sendInput(btoa(prefix + String(index)));
    setTimeout(queryTmuxWindows, 300);
  }

  // ===== Viewport resize (virtual keyboard) =====
  function setupViewportResize() {
    if (!window.visualViewport) return;

    function onViewportResize() {
      // Set CSS custom property to actual visible height
      const vh = window.visualViewport.height;
      document.documentElement.style.setProperty('--vh', vh + 'px');

      // Re-fit terminal when viewport changes (keyboard show/hide)
      if (screenTerminal.classList.contains('active')) {
        TerminalManager.fit();
      }
    }

    window.visualViewport.addEventListener('resize', onViewportResize);
    window.visualViewport.addEventListener('scroll', onViewportResize);
    onViewportResize();
  }

  // ===== Start =====
  document.addEventListener('DOMContentLoaded', () => {
    init();
    setupViewportResize();
  });

  return { connect, disconnect };
})();

// Service Worker: 古いSWを一度解除してから再登録（キャッシュ強制更新）
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) reg.unregister();
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    setTimeout(() => navigator.serviceWorker.register('/sw.js').catch(() => {}), 1000);
  });
}
