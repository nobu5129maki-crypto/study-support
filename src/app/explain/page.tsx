"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExplainScreen } from "@/components/ExplainScreen";

function ExplainPageInner() {
  const router = useRouter();
  const sessionId = useSearchParams().get("session");
  return (
    <ExplainScreen
      sessionId={sessionId}
      onHome={() => router.push("/")}
      onCapture={() => router.push("/capture")}
    />
  );
}

export default function ExplainPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-indigo-50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      }
    >
      <ExplainPageInner />
    </Suspense>
  );
}
