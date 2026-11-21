/** Vercel は /api/... 、エックスサーバーの静的書き出しは同じ階層の PHP。 */
export function studyApiUrl(name: "analyze" | "explain"): string {
  if (process.env.NEXT_PUBLIC_XSERVER === "1") {
    return `api/${name}.php`;
  }
  return `/api/${name}`;
}
