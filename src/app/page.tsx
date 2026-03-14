"use client";

import { useState } from "react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-indigo-50 px-4 py-8">
      <main className="flex w-full max-w-md flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-800">
            勉強サポート
          </h1>
          <p className="mt-2 text-slate-600">
            問題を撮影して、わかりやすく解説してもらおう
          </p>
        </div>

        <div className="flex w-full flex-col gap-4">
          <Link
            href="/capture"
            className="flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            <span className="text-2xl">📷</span>
            問題を撮影する
          </Link>

          <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
            <h2 className="font-semibold text-slate-700">対応科目</h2>
            <p className="mt-1 text-sm text-slate-600">
              数学・国語・英語・理科・社会など、全科目に対応しています
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
