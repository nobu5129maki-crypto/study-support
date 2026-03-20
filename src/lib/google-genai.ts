/**
 * Vercel の next build で @google/genai を静的バンドルすると失敗することがあるため、
 * 実行時のみ dynamic import する。
 */
export async function createGoogleGenAI(apiKey: string) {
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({ apiKey });
}
