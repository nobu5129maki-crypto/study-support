"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";

function ExplainContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const [explanation, setExplanation] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const fetchExplanation = useCallback(
    async (action: "next" | "simplify" = "next") => {
      if (!sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, action }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "エラーが発生しました");
        setExplanation(data.explanation);
        setStepIndex(data.stepIndex);
      } catch (err) {
        setError(err instanceof Error ? err.message : "解説の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    if (sessionId) fetchExplanation();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sessionId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="text-slate-600">セッションが見つかりません</p>
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

        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            <p className="text-slate-600">解説を考えています...</p>
          </div>
        ) : (
          <>
            <div className="flex-1 rounded-2xl bg-white p-6 shadow-sm">
              <div className="prose prose-slate max-w-none">
                <p className="whitespace-pre-wrap text-slate-700">
                  {explanation}
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
