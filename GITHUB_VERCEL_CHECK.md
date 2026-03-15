# GitHub / Vercel 総点検チェックリスト

## ビルドエラー時の確認手順

### 1. GitHub で削除すべきファイル（必ず確認）

以下のファイルが**リポジトリに存在する場合、ビルドが失敗**します。
GitHub のリポジトリで確認し、存在すれば削除してください。

| ファイル | 削除方法 |
|----------|----------|
| `next.config.ts` | ファイルを開く → 「Delete file」→ コミット |
| `eslint.config.mjs` | 同上 |
| `src/app/api/explain/page.tsx` | 同上 |

### 2. 必須ファイル（存在することを確認）

| ファイル | 説明 |
|----------|------|
| `next.config.js` | Next.js 設定（.ts ではない） |
| `.eslintrc.json` | ESLint 設定 |
| `src/app/api/explain/route.ts` | 解説 API |
| `package.json` | 依存関係 |
| `package-lock.json` | ロックファイル（推奨） |

### 3. プロジェクト構造（正しい状態）

```
study-support/
├── next.config.js      ← これを使用
├── .eslintrc.json
├── package.json
├── package-lock.json
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/route.ts
│   │   │   └── explain/route.ts   ← page.tsx ではない
│   │   ├── capture/page.tsx
│   │   ├── explain/page.tsx
│   │   └── page.tsx
│   └── components/
│       └── FlowerConfetti.tsx
└── scripts/
    └── check-deploy.js
```

### 4. Vercel ビルドログでエラー確認

「Command npm run build exited with 1」の**上**に実際のエラーがあります。

1. Vercel → プロジェクト → Deployments
2. 失敗したデプロイをクリック
3. **Building** を展開
4. ログを**下から上に**スクロール
5. 赤い `[ERROR]` や `Failed to compile` を探す

**check-deploy.js のエラー例:**
```
[ERROR] 削除が必要: next.config.ts
上記ファイルをGitHubから削除してください。
```
→ 表示されたファイルを GitHub から削除

### 5. ビルドキャッシュをクリア

1. 失敗したデプロイの **Redeploy**
2. 「Use existing Build Cache」のチェックを**外す**
3. Redeploy 実行
