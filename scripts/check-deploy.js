#!/usr/bin/env node
/**
 * デプロイ前チェック：問題のあるファイルが存在しないか確認
 * 存在する場合はビルドを中止し、削除を促す
 */
const fs = require("fs");
const path = require("path");

const BAD_FILES = [
  "next.config.ts",
  "eslint.config.mjs",
  "src/app/api/explain/page.tsx",
];

let hasError = false;
for (const file of BAD_FILES) {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    console.error(`[ERROR] 削除が必要: ${file}`);
    hasError = true;
  }
}

if (hasError) {
  console.error("\n上記ファイルをGitHubから削除してください。");
  process.exit(1);
}

console.log("[OK] デプロイチェック完了");
process.exit(0);
