---
depends_on:
  - ../02-architecture/structure.md
tags: [details, api, endpoints, rest, websocket]
ai_summary: "HotateのREST API（ホストCRUD）とWebSocket API（SSH通信）のエンドポイント仕様を定義"
---

# API設計

> Status: Draft
> 最終更新: 2026-01-28

本ドキュメントは、HotateのREST APIとWebSocket APIを定義する。

---

## API概要

| 項目 | 内容 |
|------|------|
| ベースURL | `/api` |
| 認証方式 | Basic認証（全エンドポイント共通） |
| レスポンス形式 | JSON |
| WebSocketパス | `/ws` |

---

## REST API

### エンドポイント一覧

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/hosts` | ホスト一覧取得 |
| POST | `/api/hosts` | ホスト新規作成 |
| PUT | `/api/hosts/:id` | ホスト更新 |
| DELETE | `/api/hosts/:id` | ホスト削除 |

### GET /api/hosts

保存済みホストの一覧を取得する。

#### レスポンス

| ステータス | 説明 |
|------------|------|
| 200 | 成功。ホスト配列を返却 |
| 401 | 認証エラー |

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "my-server",
    "host": "192.0.2.1",
    "port": 22,
    "username": "user",
    "authType": "password"
  },
  {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "name": "Production VPS",
    "host": "198.51.100.10",
    "port": 22,
    "username": "deploy",
    "authType": "key",
    "keyPath": "~/.ssh/id_ed25519"
  }
]
```

### POST /api/hosts

ホストを新規作成する。IDはサーバー側でcrypto.randomUUID()により生成する。

#### リクエスト

| パラメータ | 位置 | 型 | 必須 | 説明 |
|------------|------|-----|------|------|
| name | body | string | ○ | ホスト表示名 |
| host | body | string | ○ | ホスト名 or IPアドレス |
| port | body | number | - | ポート番号（デフォルト: 22） |
| username | body | string | ○ | SSHユーザー名 |
| authType | body | string | ○ | `"password"` or `"key"` |
| password | body | string | △ | authType=passwordの場合に必須 |
| keyPath | body | string | △ | authType=keyの場合に必須 |

#### レスポンス

| ステータス | 説明 |
|------------|------|
| 201 | 作成成功。作成されたホストオブジェクトを返却 |
| 400 | バリデーションエラー |
| 401 | 認証エラー |

### PUT /api/hosts/:id

既存ホスト情報を更新する。

#### リクエスト

| パラメータ | 位置 | 型 | 必須 | 説明 |
|------------|------|-----|------|------|
| id | path | string | ○ | ホストID (UUID) |
| name | body | string | - | ホスト表示名 |
| host | body | string | - | ホスト名 or IPアドレス |
| port | body | number | - | ポート番号 |
| username | body | string | - | SSHユーザー名 |
| authType | body | string | - | `"password"` or `"key"` |
| password | body | string | - | パスワード |
| keyPath | body | string | - | 秘密鍵パス |

#### レスポンス

| ステータス | 説明 |
|------------|------|
| 200 | 更新成功。更新後のホストオブジェクトを返却 |
| 400 | バリデーションエラー |
| 401 | 認証エラー |
| 404 | ホストが見つからない |

### DELETE /api/hosts/:id

ホストを削除する。

#### リクエスト

| パラメータ | 位置 | 型 | 必須 | 説明 |
|------------|------|-----|------|------|
| id | path | string | ○ | ホストID (UUID) |

#### レスポンス

| ステータス | 説明 |
|------------|------|
| 204 | 削除成功 |
| 401 | 認証エラー |
| 404 | ホストが見つからない |

---

## WebSocket API

### 接続

WebSocket接続時にクエリパラメータでホストIDを指定する。

```
ws://host:port/ws?hostId={uuid}
```

サーバーはホストIDに基づいてhosts.jsonから接続情報を取得し、SSH接続を確立する。

### メッセージ形式

すべてのメッセージはJSON形式で送受信する。

```json
{ "type": "string", "payload": "any" }
```

### クライアント → サーバー

| type | payload | 説明 |
|------|---------|------|
| `input` | `string` (Base64) | ユーザー入力をBase64エンコードしたもの |
| `resize` | `{ cols: number, rows: number }` | ターミナルリサイズ通知 |
| `tmux-query` | `object` | tmux補助操作をexecチャネルで実行。`id`フィールド必須。`payload.action` は `list-sessions` / `list-windows` / `select-window` のみ |

```json
{ "type": "tmux-query", "id": "sessions", "payload": { "action": "list-sessions" } }
```

```json
{ "type": "tmux-query", "id": "windows", "payload": { "action": "list-windows", "session": "main" } }
```

```json
{ "type": "tmux-query", "id": "switch", "payload": { "action": "select-window", "session": "main", "index": 2 } }
```

### サーバー → クライアント

| type | payload | 説明 |
|------|---------|------|
| `output` | `string` (Base64) | SSH出力をBase64エンコードしたもの |
| `connected` | `{ host: string, port: number }` | SSH接続成功通知 |
| `error` | `{ message: string }` | エラー通知（認証失敗、接続拒否等） |
| `exit` | `{ code: number }` | SSH接続終了通知 |
| `tmux-result` | `{ stdout: string, stderr: string }` or `{ error: string }` | tmux-queryの実行結果。`id`フィールドでリクエストと対応 |
| `tmux-attached` | なし | alternate screen bufferへの遷移を検出（tmux attach相当） |
| `tmux-detached` | なし | alternate screen bufferからの離脱を検出（tmux detach相当） |

```json
{ "type": "tmux-result", "id": "<queryId>", "payload": { "stdout": "0 zsh 1\n1 vim 0\n", "stderr": "" } }
```

```json
{ "type": "tmux-attached" }
```

---

## 共通仕様

### 認証

| 項目 | 内容 |
|------|------|
| 方式 | HTTP Basic認証 |
| ヘッダー | `Authorization: Basic {base64(user:pass)}` |
| 環境変数 | `HOTATE_USER`, `HOTATE_PASS` |
| 適用範囲 | REST API全エンドポイント。WebSocketはHTTPアップグレード時に認証 |

### エラーレスポンス（REST API）

| フィールド | 型 | 説明 |
|------------|-----|------|
| error | string | エラーメッセージ |

```json
{ "error": "Host not found" }
```

---

## 関連ドキュメント

- [flows.md](./flows.md) - SSH接続・コマンド送信フロー
- [structure.md](../02-architecture/structure.md) - コンポーネント構成
