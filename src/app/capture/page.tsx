"use client";

import { useRouter } from "next/navigation";
import { CaptureScreen } from "@/components/CaptureScreen";

export default function CapturePage() {
  const router = useRouter();
  return (
    <CaptureScreen
      onBack={() => router.push("/")}
      onStart={(sessionId) => router.push(`/explain?session=${encodeURIComponent(sessionId)}`)}
    />
  );
}
