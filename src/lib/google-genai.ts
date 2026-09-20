import type { GoogleGenAI } from "@google/genai";

/**
 * Vercel の next build で @google/genai を静的バンドルすると失敗することがあるため、
 * 実行時のみ dynamic import する。
 */
export async function createGoogleGenAI(apiKey: string) {
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({ apiKey });
}

/**
 * 利用するモデルの優先順。
 * 無料枠の上限（429 RESOURCE_EXHAUSTED）はモデルごとに別枠のため、
 * 先頭のモデルが上限に達したら次のモデルで再試行する。
 */
export const MODEL_CANDIDATES = [
  "gemini-3-flash-preview",
  // gemini-2.5-flash は新規ユーザーには 404（提供終了）のため、現行モデルを予備にする
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
] as const;

type GenerateArgs = Omit<
  Parameters<GoogleGenAI["models"]["generateContent"]>[0],
  "model"
>;

/** アプリ側で扱いやすい形にした API エラー */
export class GenAIRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly kind: "quota" | "overloaded" | "other"
  ) {
    super(message);
    this.name = "GenAIRequestError";
  }
}

function getStatus(err: unknown): number {
  if (typeof err === "object" && err !== null) {
    const e = err as { status?: unknown; code?: unknown; message?: unknown };
    if (typeof e.status === "number") return e.status;
    if (typeof e.code === "number") return e.code;
    if (typeof e.message === "string") {
      const m = e.message.match(/"code"\s*:\s*(\d{3})/);
      if (m) return Number(m[1]);
    }
  }
  return 0;
}

/**
 * 429（無料枠の上限）/ 503（混雑）/ 404（モデル提供終了）のときは次の候補モデルで再試行して生成する。
 * すべて失敗した場合は GenAIRequestError を投げる。
 */
export async function generateContentWithFallback(
  ai: GoogleGenAI,
  args: GenerateArgs
) {
  let lastErr: unknown = null;
  let lastStatus = 0;
  for (const model of MODEL_CANDIDATES) {
    try {
      return await ai.models.generateContent({ ...args, model });
    } catch (err) {
      lastErr = err;
      lastStatus = getStatus(err);
      // 429=無料枠上限, 503/500=混雑・一時障害, 404=モデル提供終了 → いずれも次のモデルで再試行
      const retryable =
        lastStatus === 429 || lastStatus === 503 || lastStatus === 500 || lastStatus === 404;
      console.warn(`[genai] model=${model} failed status=${lastStatus}${retryable ? " -> 次のモデルで再試行" : ""}`);
      if (!retryable) break;
    }
  }
  console.error(lastErr);
  if (lastStatus === 429) {
    throw new GenAIRequestError(
      "AI の利用回数が上限に達しました。しばらく時間をおいてからもう一度お試しください。",
      429,
      "quota"
    );
  }
  if (lastStatus === 503) {
    throw new GenAIRequestError(
      "AI が混み合っています。少し待ってからもう一度お試しください。",
      503,
      "overloaded"
    );
  }
  throw new GenAIRequestError("AI との通信に失敗しました。", 502, "other");
}
