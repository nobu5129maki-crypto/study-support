#!/usr/bin/env node
/**
 * ビルド前チェック（prebuild）
 * 1. App Router で同一ディレクトリに page.tsx と route.ts が共存していないか確認
 *    （"two parallel pages" / "conflicting route" ビルドエラーの原因）
 * 2. Next.js 14 で使えない・競合する設定ファイルが残っていないか確認
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "src", "app");

const PAGE_FILES = ["page.tsx", "page.ts", "page.jsx", "page.js"];
const ROUTE_FILES = ["route.ts", "route.js"];

// Next.js 14 では next.config.ts は未対応、eslint.config.mjs は .eslintrc.json と競合する
const BAD_FILES = ["next.config.ts", "eslint.config.mjs"];

const errors = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const names = entries.filter((e) => e.isFile()).map((e) => e.name);
  const hasPage = PAGE_FILES.some((f) => names.includes(f));
  const hasRoute = ROUTE_FILES.some((f) => names.includes(f));
  if (hasPage && hasRoute) {
    errors.push(
      `page と route が同じディレクトリに共存しています: ${path.relative(root, dir) || "."}`
    );
  }
  for (const e of entries) {
    if (e.isDirectory() && e.name !== "node_modules") walk(path.join(dir, e.name));
  }
}

walk(appDir);

for (const file of BAD_FILES) {
  if (fs.existsSync(path.join(root, file))) {
    errors.push(`削除が必要なファイルがあります: ${file}`);
  }
}

if (errors.length > 0) {
  console.error("[prebuild] ビルド前チェックでエラーが見つかりました:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("[prebuild] App Router の競合チェック OK");
