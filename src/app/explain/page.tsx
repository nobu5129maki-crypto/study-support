"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";

type SessionData = {
  problemText: string;
  subject: string;
};

// LaTeX記法 $(7x+5)$ $7x$ を除去（複数パスで確実に）
function stripLatex(text: string): string {
  let result = text;
  // $...$ パターンを繰り返し除去（ネスト対応）
  for (let i = 0; i < 5; i++) {
    const prev = result;
    result = result
      .replace(/\$+([^$]*)\$+/g, "$1")
      .replace(/\\\$+([^$\\]*)\\\$+/g, "$1")
      .replace(/\\\(([\s\S]*?)\\\)/g, "$1");
    if (result === prev) break;
  }
  return result.replace(/[\$＄]/g, "");
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

  const fetchExplanation = useCallback(
    async (action: "next" | "simplify" = "next") => {
      if (!sessionData || sessionData === "pending") return;
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "解説の取得に失敗しました");
      } finally {
        setLoading(false);
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

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-sky-50 to-indigo-50">
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white/80 p-4 backdrop-blur">
        <Link
          href="/"
          className="rounded-full p-2 text-slate-600 hover:bg-slate-100"
          aria-label="戻る"
        >
          ←
        </Link>
        <h1 className="text-lg font-semibold text-slate-800">
          解説（ステップ {stepIndex}）
        </h1>
      </header>

      <main className="flex flex-1 flex-col p-4">
        {error && (
          <div className="mb-4 rounded-xl bg-red-100 p-4 text-red-700">
            {error}
          </div>
        )}

        {(loading && !explanation) || sessionData === "pending" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            <p className="text-slate-600">解説を考えています...</p>
          </div>
        ) : (
          <>
            <div className="flex-1 rounded-2xl bg-white p-6 shadow-sm overflow-x-auto">
              <div className="prose prose-slate max-w-none min-w-0">
                <p className="whitespace-pre-wrap text-slate-700">
                  {stripLatex(explanation)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <p className="text-center text-sm font-medium text-slate-600">
                ここまで理解できたかな？
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => fetchExplanation("simplify")}
                  disabled={loading}
                  className="flex-1 rounded-xl border-2 border-slate-300 py-4 font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
                >
                  もう少しわかりやすく教えて
                </button>
                <button
                  onClick={() => fetchExplanation("next")}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-indigo-600 py-4 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  わかった！次へ
                </button>
              </div>
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
