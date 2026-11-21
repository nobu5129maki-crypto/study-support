"use client";

import { useState } from "react";
import { CaptureScreen } from "@/components/CaptureScreen";
import { ExplainScreen } from "@/components/ExplainScreen";
import { HomeScreen } from "@/components/HomeScreen";

type View =
  | { name: "home" }
  | { name: "capture" }
  | { name: "explain"; sessionId: string };

/** サブフォルダでもドメイン直下でも、URL を変えずに画面を切り替える。 */
export function XserverApp() {
  const [view, setView] = useState<View>({ name: "home" });

  if (view.name === "capture") {
    return (
      <CaptureScreen
        onBack={() => setView({ name: "home" })}
        onStart={(sessionId) => setView({ name: "explain", sessionId })}
      />
    );
  }

  if (view.name === "explain") {
    return (
      <ExplainScreen
        sessionId={view.sessionId}
        onHome={() => setView({ name: "home" })}
        onCapture={() => setView({ name: "capture" })}
      />
    );
  }

  return <HomeScreen onCapture={() => setView({ name: "capture" })} />;
}
