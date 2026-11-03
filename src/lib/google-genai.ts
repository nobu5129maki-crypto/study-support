import type { GoogleGenAI } from "@google/genai";

/**
 * Vercel の next build で @google/genai を静的バンドルすると失敗することがあるため、
 * 実行時のみ dynamic import する。
 */
export async function createGoogleGenAI(apiKey: string) {
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      // SDK の既定は 503 を最大5回再試行し、1リクエストの待ちも長い。
      // 混雑している最新モデルで関数全体が60秒タイムアウトになるため、
      // 再試行はせず、失敗したらすぐ次のモデルへ移す。
      timeout: 15000,
      retryOptions: { attempts: 1 },
    },
  });
}

/**
 * 利用するモデルの優先順。
 * 無料枠の上限（429 RESOURCE_EXHAUSTED）はモデルごとに別枠のため、
 * 先頭のモデルが上限に達したら次のモデルで再試行する。
 *
 * 2026-11 時点の最新 Flash は gemini-3.8-flash（画像入力対応）。
 * gemini-3-flash-preview は 2025-12 のプレビュー、gemini-3.5-flash は
 * gemini-3.6-flash へ自動転送される廃止モデルなので、別枠の予備にならない。
 * 画像を読む勉強サポートでは、より高価な gemini-4-argon ではなく Flash 系を使う。
 */
export const MODEL_CANDIDATES = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
] as const;

type GenerateArgs = Omit<
  Parameters<GoogleGenAI["models"]["generateContent"]>[0],
  "model"
>;

type GenerateConfig = NonNullable<GenerateArgs["config"]>;

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
    // DOMException の code（AbortError は 20）を HTTP ステータスと取り違えない
    if (typeof e.status === "number" && e.status >= 400 && e.status <= 599) return e.status;
    if (typeof e.code === "number" && e.code >= 400 && e.code <= 599) return e.code;
    if (typeof e.message === "string") {
      const m = e.message.match(/"code"\s*:\s*(\d{3})/);
      if (m) return Number(m[1]);
    }
  }
  // SDK は 503 を status なしの "Retryable HTTP Error: Service Unavailable" に包む
  const msg = errorMessage(err).toLowerCase();
  if (msg.includes("service unavailable") || msg.includes("high demand")) return 503;
  if (msg.includes("gateway timeout") || msg.includes("timed out") || msg.includes("aborted") || msg.includes("abort")) return 504;
  if (msg.includes("resource exhausted") || msg.includes("quota")) return 429;
  if (msg.includes("not found")) return 404;
  return 0;
}

function errorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

/**
 * 429=無料枠上限, 503/500=混雑, 404=モデル提供終了。
 * 400 でも「そのモデルでは使えない」系だけ次のモデルへ回す（APIキー不正は回さない）。
 */
function isRetryable(status: number, err: unknown): boolean {
  if (status === 429 || status === 503 || status === 504 || status === 500 || status === 404) return true;
  if (errorMessage(err).toLowerCase().includes("retryable http error")) return true;
  if (status !== 400) return false;
  const msg = errorMessage(err).toLowerCase();
  return (
    msg.includes("model") ||
    msg.includes("not found") ||
    msg.includes("unsupported") ||
    msg.includes("unknown")
  );
}

function isThinkingRejection(status: number, err: unknown): boolean {
  return status === 400 && errorMessage(err).toLowerCase().includes("thinking");
}

/**
 * 現行 API の思考レベルは "low"。古い SDK の enum は "LOW" なので文字列で渡す。
 * モデルが拒否した場合は思考指定なしで同じモデルをやり直す。
 */
function buildConfig(args: GenerateArgs, withThinking: boolean): GenerateConfig {
  const base: GenerateConfig = { ...(args.config ?? {}) };
  if (!withThinking) {
    delete base.thinkingConfig;
    return base;
  }
  const thinkingConfig = {
    ...(base.thinkingConfig ?? {}),
    thinkingLevel: "low",
  };
  return {
    ...base,
    thinkingConfig: thinkingConfig as GenerateConfig["thinkingConfig"],
  };
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
      // Flash の既定思考は medium。解説は短い往復なので low にして待ち時間を抑える。
      // minimal は 3.8 Flash ではエラーになるため使わない。
      let response;
      try {
        response = await ai.models.generateContent({
          ...args,
          model,
          config: buildConfig(args, true),
        });
      } catch (err) {
        if (!isThinkingRejection(getStatus(err), err)) throw err;
        console.warn(`[genai] model=${model} thinkingLevel=low を拒否したため思考指定なしで再試行`);
        response = await ai.models.generateContent({
          ...args,
          model,
          config: buildConfig(args, false),
        });
      }
      console.info(`[genai] model=${model}`);
      return response;
    } catch (err) {
      lastErr = err;
      lastStatus = getStatus(err);
      const retryable = isRetryable(lastStatus, err);
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
  if (lastStatus === 503 || lastStatus === 504) {
    throw new GenAIRequestError(
      "AI が混み合っています。少し待ってからもう一度お試しください。",
      503,
      "overloaded"
    );
  }
  throw new GenAIRequestError("AI との通信に失敗しました。", 502, "other");
}
