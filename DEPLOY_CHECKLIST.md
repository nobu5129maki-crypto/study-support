# Vercel デプロイ前チェックリスト

## GitHub で削除すべきファイル（存在する場合）

以下のファイルがリポジトリに**残っているとビルドエラー**になります。GitHub 上で確認し、存在すれば削除してください。

| ファイル | 理由 |
|----------|------|
| `next.config.ts` | Next.js 14 は未対応。`next.config.js` のみ使用 |
| `eslint.config.mjs` | `.eslintrc.json` と競合 |
| `src/app/api/explain/page.tsx` | `route.ts` と同一パスで競合（"two parallel pages" エラー） |

## 必須ファイル

| ファイル | 説明 |
|----------|------|
| `next.config.js` | Next.js 設定 |
| `.eslintrc.json` | ESLint 設定 |
| `src/app/api/explain/route.ts` | 解説 API（`page.tsx` ではない） |

## 確認手順

1. GitHub リポジトリを開く
2. 上記「削除すべきファイル」が存在するか確認
3. 存在する場合は各ファイルを開き「Delete file」で削除
4. プッシュ後、Vercel が自動再デプロイ
5. ビルドログでエラー詳細を確認（失敗時は「Building」を展開）

## ビルド失敗時のエラー確認方法

「Command npm run build exited with 1」は**結果**です。実際のエラーはその**上**に表示されています。

1. Vercel ダッシュボード → プロジェクト → **Deployments**
2. 失敗したデプロイ（赤い丸）をクリック
3. **Building** のセクションを展開
4. ログを**下から上に**スクロール
5. 「exited with 1」の**数行〜数十行上**に、赤い文字で `Error:` や `Failed to compile` などが表示されています
6. そのエラー内容をメモして共有してください

## ビルドキャッシュをクリアして再デプロイ

古いキャッシュが原因の場合は以下を試してください。

1. 失敗したデプロイの **Redeploy** ボタンをクリック
2. 「Use existing Build Cache」のチェックを**外す**
3. Redeploy を実行
