# 勉強サポート

スマホで問題を撮影し、AIが段階的に解説してくれる学習アプリです。

## 機能

- **全科目対応**: 数学・国語・英語・理科・社会など
- **カメラ撮影**: スマホのカメラで問題を撮影、またはギャラリーから選択
- **段階的解説**: 1ステップずつ丁寧に解説
- **理解度確認**: 「ここまで理解できたかな？」で進捗を確認
- **難易度調整**: 「もう少しわかりやすく教えて」で易しい説明に切り替え

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env.local` を作成し、Gemini API キーを設定してください。

```bash
cp .env.example .env.local
```

`.env.local` を編集:

```
GEMINI_API_KEY=xxxxxxxx
```

API キーは [Google AI Studio](https://aistudio.google.com/app/apikey) で無料取得できます。

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

### 4. スマホで試す

同じネットワーク内のスマホから `http://[PCのIPアドレス]:3000` にアクセスするか、Vercel などにデプロイして HTTPS でアクセスしてください（カメラは HTTPS が必要な場合があります）。

## 使い方

1. ホーム画面で「問題を撮影する」をタップ
2. カメラを起動し、問題が写るように撮影（またはギャラリーから選択）
3. 「解説を始める」をタップ
4. 解説を読んで「わかった！次へ」で次のステップへ
5. 難しかったら「もう少しわかりやすく教えて」で易しい説明に

## 技術スタック

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Google Gemini 3 Flash (画像認識 + テキスト生成)

## ビルド

```bash
npm run build
npm start
```
