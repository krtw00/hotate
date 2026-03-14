# Contributing

Hotateへのコントリビュートに興味を持っていただきありがとうございます。

## 開発環境のセットアップ

```bash
git clone https://github.com/krtw00/hotate.git
cd hotate
npm install
cp .env.example .env
npm run dev   # starts with --watch for auto-reload
```

## 開発フロー

1. issueで事前に相談（大きな変更の場合）
2. featureブランチを切る
3. 変更を加える
4. Pull Requestを作成

## コーディング規約

- ビルドステップなし（Vanilla JS + CDN）
- フレームワーク不使用。DOM操作は直接記述
- WebSocket ↔ SSH 間のデータはBase64転送で統一
- SPA画面遷移はDOM display切替

## ディレクトリ構成

```
server/          # Express + WebSocket + SSH
public/          # 静的ファイル (HTML/CSS/JS)
data/            # hosts.json (永続化)
```

## Issue / Pull Request

- Issueにはできるだけ再現手順や期待する動作を書いてください
- PRは小さく保つ。1つのPRで1つの変更
- 日本語・英語どちらでも構いません

## ライセンス

コントリビュートされたコードはMITライセンスの下で公開されます。
