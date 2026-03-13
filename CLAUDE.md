# Hotate

ブラウザベースSSHクライアント。モバイル端末からIME対応の日本語入力でSSH操作を行う。

## 技術スタック

- **バックエンド**: Node.js 22+ / Express / ws / ssh2
- **フロントエンド**: Vanilla JS / xterm.js (CDN) / Vanilla CSS
- **データ**: data/hosts.json (JSONファイル永続化)
- **インフラ**: Docker (node:22-alpine) / Traefik

## コマンド

```bash
npm run dev    # 開発サーバー (node --watch)
npm start      # 本番起動
```

## 構成

```
server/          # Express + WebSocket + SSH
public/          # 静的ファイル (HTML/CSS/JS)
data/            # hosts.json (永続化)
docs/            # 設計ドキュメント (Templarc)
```

## 方針

- ビルドステップなし (Vanilla JS + CDN)
- SPA画面遷移は DOM display 切替
- WebSocket ↔ SSH 間のデータは Base64 転送で統一
- IME入力は compositionstart/end で追跡
