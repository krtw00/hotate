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

## Documentation Policy

- 長い設計 docs は持たず、保守対象は `README.md` `ARCHITECTURE.md` `DEPLOY.md` `CONTRIBUTING.md` に限定する
- 実装変更で運用手順や構成が変わる場合だけ、対応する 1 ファイルを更新する
- 将来の理想像ではなく、今の実装と運用に効く情報だけを書く
- スクリーンショットや詳細設計メモは恒久文書にしない

## Documentation Policy (JA)

- 長大な設計書は置かず、保守対象は `README.md` `ARCHITECTURE.md` `DEPLOY.md` `CONTRIBUTING.md` に限定します
- 実装変更で構成や運用手順が変わった場合のみ、対応する文書を更新してください
- 理想論ではなく、現行実装と現行運用に効く情報だけを残してください
- スクリーンショットや詳細メモは恒久文書として保持しません

## ライセンス

コントリビュートされたコードはMITライセンスの下で公開されます。
