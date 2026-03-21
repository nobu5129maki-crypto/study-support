"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import Link from "next/link";
import { FlowerConfetti } from "@/components/FlowerConfetti";
import { normalizeMathSymbols } from "@/lib/mathNotation";

type SessionData = {
  problemText: string;
  subject: string;
};

// LaTeX記法を完全除去（$7x$ $(7x+5)$ など）
function stripLatex(text: string): string {
  if (!text) return text;
  const L = "\uE001", R = "\uE002";  // 一時プレースホルダ
  let result = text
    .replace(/&#36;/g, "$")
    .replace(/\\\(/g, L)
    .replace(/\\\)/g, R);
  for (let i = 0; i < 10; i++) {
    const prev = result;
    result = result
      .replace(/\$+([^$]*?)\$+/g, "$1")
      .replace(new RegExp(L + "([\\s\\S]*?)" + R, "g"), "$1");
    if (result === prev) break;
  }
  // 残った$系文字を全て除去（半角・全角・その他）
  return normalizeMathSymbols(
    result.replace(/[\$＄﹩\u0024\uFF04\uFE69]/g, "").trim()
  );
}

function ExplainContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const [sessionData, setSessionData] = useState<SessionData | null | "pending">("pending");
  const [explanation, setExplanation] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [difficultyLevel, setDifficultyLevel] = useState(0);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"next" | "simplify" | null>(
    null
  );
  const hasShownConfetti = useRef(false);

  const fetchExplanation = useCallback(
    async (action: "next" | "simplify" = "next") => {
      if (!sessionData || sessionData === "pending") return;
      setLoadingAction(action);
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            problemText: sessionData.problemText,
            subject: sessionData.subject,
            messages,
            stepIndex,
            difficultyLevel,
            action,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "エラーが発生しました");
        setExplanation(stripLatex(data.explanation));
        setStepIndex(data.stepIndex);
        setDifficultyLevel(data.difficultyLevel);
        if (data.messages) setMessages(data.messages);
        if (data.isComplete) {
          setIsComplete(true);
          if (!hasShownConfetti.current) {
            hasShownConfetti.current = true;
            setShowConfetti(true);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "解説の取得に失敗しました");
      } finally {
        setLoading(false);
        setLoadingAction(null);
      }
    },
    [sessionId, sessionData, messages, stepIndex, difficultyLevel]
  );

  useEffect(() => {
    if (!sessionId) return;
    const stored = typeof window !== "undefined" && sessionStorage.getItem(`study_session_${sessionId}`);
    if (stored) {
      try {
        const data = JSON.parse(stored) as SessionData;
        setSessionData(data);
      } catch {
        setSessionData(null);
      }
    } else {
      setSessionData(null);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionData && sessionData !== "pending") fetchExplanation();
  }, [sessionData]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sessionId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="text-slate-600">問題のデータが見つかりません。ホームから問題を撮影してください。</p>
        <Link
          href="/"
          className="rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white"
        >
          ホームに戻る
        </Link>
      </div>
    );
  }

  if (sessionId && sessionData === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="text-slate-600">問題のデータが読み込めませんでした。ホームからもう一度問題を撮影してください。</p>
        <Link
          href="/"
          className="rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white"
        >
          ホームに戻る
        </Link>
      </div>
    );
  }

  const isInitialLoad =
    sessionData === "pending" || (loading && !explanation);
  const isFetchingNext = loading && !!explanation;

  return (
    <div className="flex min-h-[100dvh] min-h-screen flex-col bg-gradient-to-b from-sky-50 to-indigo-50">
      {showConfetti && <FlowerConfetti onComplete={() => setShowConfetti(false)} />}
      <header className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-white/80 p-4 backdrop-blur">
        <Link
          href="/"
          className="rounded-full p-2 text-slate-600 hover:bg-slate-100"
          aria-label="戻る"
        >
          ←
        </Link>
        <h1 className="text-lg font-semibold text-slate-800">
          解説（ステップ {stepIndex}）
          {isFetchingNext && (
            <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-500 align-middle" aria-hidden />
          )}
        </h1>
      </header>

      <main className="flex min-h-0 flex-1 flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error && (
          <div className="mb-4 shrink-0 rounded-xl bg-red-100 p-4 text-red-700">
            {error}
          </div>
        )}

        {isInitialLoad ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"
              role="status"
              aria-label="読み込み中"
            />
            <p className="text-center text-slate-600">解説を考えています…</p>
            <p className="max-w-xs text-center text-sm text-slate-500">
              初回は数十秒かかることがあります
            </p>
          </div>
        ) : (
          <>
            {/* min-h-0 + overflow-y で長文を切らず縦スクロール */}
            <div className="relative min-h-0 flex-1">
              <div className="h-full min-h-[12rem] overflow-y-auto overflow-x-auto rounded-2xl bg-white p-5 shadow-sm sm:p-6">
                <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-slate-800 [overflow-wrap:anywhere]">
                  {stripLatex(explanation)}
                </p>
              </div>
              {/* 「次へ」後も前の文が見える＋進行が分かるオーバーレイ */}
              {isFetchingNext && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/90 px-4 backdrop-blur-[2px]"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                  <p className="text-center font-medium text-slate-800">
                    {loadingAction === "simplify"
                      ? "わかりやすい説明を準備しています…"
                      : "次のステップを準備しています…"}
                  </p>
                  <p className="max-w-[280px] text-center text-sm text-slate-600">
                    通信中です。下に前の説明が透けて見えていれば正常に進んでいます。
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex shrink-0 flex-col gap-3">
              <p className="text-center text-sm font-medium text-slate-600">
                {isComplete ? "お疲れさまでした！" : "ここまで理解できたかな？"}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => fetchExplanation("simplify")}
                  disabled={loading}
                  className="flex-1 rounded-xl border-2 border-slate-300 py-4 font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                >
                  {isFetchingNext && loadingAction === "simplify"
                    ? "説明し直し中…"
                    : "もう少しわかりやすく教えて"}
                </button>
                {!isComplete && (
                  <button
                    type="button"
                    onClick={() => fetchExplanation("next")}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-indigo-600 py-4 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-90"
                  >
                    {isFetchingNext && loadingAction === "next"
                      ? "次へ進行中…"
                      : "わかった！次へ"}
                  </button>
                )}
              </div>
              <Link
                href="/capture"
                className="mt-1 flex items-center justify-center gap-2 rounded-xl border-2 border-indigo-200 py-3 font-medium text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-50"
              >
                📷 カメラ撮影に戻る
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function ExplainPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      }
    >
      <ExplainContent />
    </Suspense>
  );
}
