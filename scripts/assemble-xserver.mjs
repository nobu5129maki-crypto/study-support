import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "xserver", "dist");
const htmlPath = path.join(dist, "index.html");
if (!fs.existsSync(htmlPath)) {
  console.error("xserver/dist/index.html がありません");
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, "utf8");
html = html.replaceAll("../assets/", "./assets/");
if (!html.includes("./assets/")) {
  console.error("ビルド後の index.html に相対パスの assets がありません");
  process.exit(1);
}
if (html.includes('src="/') || html.includes('href="/assets') || html.includes('href="/_next')) {
  console.error("絶対パスのアセットが残っています");
  process.exit(1);
}
fs.writeFileSync(htmlPath, html);

for (const name of ["auth.php", "gate.php", "index.php", "sw.js", ".htaccess"]) {
  fs.copyFileSync(path.join(root, "xserver", name), path.join(dist, name));
}
const apiOut = path.join(dist, "api");
fs.mkdirSync(apiOut, { recursive: true });
for (const name of fs.readdirSync(path.join(root, "xserver", "api"))) {
  if (!name.endsWith(".php")) continue;
  fs.copyFileSync(path.join(root, "xserver", "api", name), path.join(apiOut, name));
}

for (const name of ["next.svg", "vercel.svg", "file.svg", "globe.svg", "window.svg"]) {
  fs.rmSync(path.join(dist, name), { force: true });
}

const required = [
  "index.html",
  "index.php",
  "auth.php",
  "gate.php",
  "sw.js",
  ".htaccess",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-192.png",
  "icon-maskable-512.png",
  "api/analyze.php",
  "api/explain.php",
];
for (const name of required) {
  if (!fs.existsSync(path.join(dist, name))) {
    console.error("不足: " + name);
    process.exit(1);
  }
}
console.log("xserver dist を組み立てました");
