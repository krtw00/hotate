# Hotate

日本語 | [English](README.md)

モバイル端末からIME対応の日本語入力でSSH操作ができる、ブラウザベースのSSHクライアント。

## ドキュメント

- [ARCHITECTURE.md](ARCHITECTURE.md) -- 現在のシステム構成と重要な境界
- [DEPLOY.md](DEPLOY.md) -- 本番デプロイとロールバック手順
- [CONTRIBUTING.md](CONTRIBUTING.md) -- コントリビュート方針と文書更新ルール

## 特徴

- **IME対応の日本語入力** -- `compositionstart/end` で変換を追跡し、確定後にのみ送信
- **xterm.js ターミナル** -- 256色・5000行スクロールバック・JetBrains Mono フォント
- **特殊キーツールバー** -- Tab, Ctrl+C/D/Z/L, 矢印キー, Esc をタッチで入力
- **ホスト管理** -- SSH接続プロファイルの追加・編集・削除（パスワード / SSH鍵認証）
- **タッチ操作** -- モバイルでのスクロール・テキスト選択に対応
- **コピー＆ペースト** -- 選択時の自動コピー、右クリックメニュー、クリップボード連携
- **tmux連携** -- `tmux attach` を自動検出し、ウィンドウタブバーで切り替え・デタッチ
- **Basic認証** -- 環境変数でユーザー名・パスワードを設定
- **ビルドステップなし** -- Vanilla JS + CDN。編集してリロードするだけ

## クイックスタート

```bash
cp .env.example .env
# .env を編集して HOTATE_USER / HOTATE_PASS を設定

# スタンドアロン (ポート直接公開)
docker compose -f docker-compose.standalone.yml up -d

# Traefik リバースプロキシ経由
docker compose up -d
```

`http://localhost:3000`（スタンドアロン）または設定したドメインでアクセス。

## 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `HOTATE_USER` | `admin` | Basic認証ユーザー名 |
| `HOTATE_PASS` | `changeme` | Basic認証パスワード |
| `PORT` | `3000` | 待ち受けポート |
| `APP_DOMAIN` | `hotate.example.com` | Traefik用ドメイン（docker-compose.yml のみ） |
| `SSH_KEY_DIR` | `~/.ssh` | SSH鍵のマウント元ディレクトリ |

## アーキテクチャ

```
ブラウザ (xterm.js) <-- WebSocket (Base64) --> Node.js (Express) <-- ssh2 --> SSHサーバー
```

```
server/          # Express + WebSocket + SSH
public/          # 静的ファイル (HTML/CSS/JS)
data/            # hosts.json (永続化)
```

現在の保守対象の構成説明は [ARCHITECTURE.md](ARCHITECTURE.md) を参照してください。

## 開発

```bash
npm install
cp .env.example .env
npm run dev   # node --watch で自動リロード
```

## コントリビュート

[CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT](LICENSE)
