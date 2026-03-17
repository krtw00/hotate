import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTmuxCommand } from '../server/ssh-session.js';

test('buildTmuxCommand returns a fixed command for list-sessions', () => {
  assert.equal(
    buildTmuxCommand({ action: 'list-sessions' }),
    "tmux list-sessions -F '#{session_name}:#{session_attached}'",
  );
});

test('buildTmuxCommand shell-escapes tmux session names', () => {
  const command = buildTmuxCommand({ action: 'list-windows', session: "prod'; uname -a; '" });
  assert.match(command, /^tmux list-windows -t '/);
  assert.ok(command.includes("'\\''"));
});

test('buildTmuxCommand validates select-window payloads', () => {
  assert.throws(
    () => buildTmuxCommand({ action: 'select-window', session: 'main', index: -1 }),
    /non-negative integer/,
  );
});

test('buildTmuxCommand rejects unknown actions', () => {
  assert.throws(
    () => buildTmuxCommand({ action: 'exec', command: 'whoami' }),
    /not allowed/,
  );
});
