import test from 'node:test';
import assert from 'node:assert/strict';
import { applyHostUpdates, buildNewHost, ValidationError } from '../server/config.js';

test('buildNewHost requires password for password auth', () => {
  assert.throws(
    () => buildNewHost({ name: 'prod', host: 'example.com', username: 'root', authType: 'password' }),
    ValidationError,
  );
});

test('buildNewHost requires authType', () => {
  assert.throws(
    () => buildNewHost({ name: 'prod', host: 'example.com', username: 'root' }),
    /authType is required/,
  );
});

test('buildNewHost normalizes key auth hosts', () => {
  const host = buildNewHost({
    name: ' prod ',
    host: ' example.com ',
    port: '2222',
    username: ' root ',
    authType: 'key',
    keyPath: ' ~/.ssh/id_ed25519 ',
  });

  assert.equal(host.name, 'prod');
  assert.equal(host.host, 'example.com');
  assert.equal(host.port, 2222);
  assert.equal(host.username, 'root');
  assert.equal(host.authType, 'key');
  assert.equal(host.keyPath, '~/.ssh/id_ed25519');
});

test('applyHostUpdates rejects switching to password auth without a password', () => {
  assert.throws(
    () => applyHostUpdates({
      id: '1',
      name: 'prod',
      host: 'example.com',
      port: 22,
      username: 'root',
      authType: 'key',
      keyPath: '~/.ssh/id_ed25519',
    }, { authType: 'password' }),
    ValidationError,
  );
});

test('applyHostUpdates rejects switching to key auth without a key path', () => {
  assert.throws(
    () => applyHostUpdates({
      id: '1',
      name: 'prod',
      host: 'example.com',
      port: 22,
      username: 'root',
      authType: 'password',
      password: 'secret',
    }, { authType: 'key' }),
    ValidationError,
  );
});

test('applyHostUpdates keeps password auth valid when only metadata changes', () => {
  const next = applyHostUpdates({
    id: '1',
    name: 'prod',
    host: 'example.com',
    port: 22,
    username: 'root',
    authType: 'password',
    password: 'secret',
  }, { name: 'prod-2', port: 2200 });

  assert.equal(next.name, 'prod-2');
  assert.equal(next.port, 2200);
  assert.equal(next.password, 'secret');
  assert.equal(next.authType, 'password');
});
