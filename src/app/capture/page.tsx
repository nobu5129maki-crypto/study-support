"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function CapturePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCapturing(true);
    } catch (err) {
      setError("カメラにアクセスできません。カメラの許可を確認してください。");
      console.error(err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const retake = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  const submitImage = useCallback(async () => {
    if (!capturedImage) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: capturedImage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "エラーが発生しました");
      router.push(`/explain?session=${encodeURIComponent(data.sessionId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }, [capturedImage, router]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-900">
      <header className="flex items-center gap-4 p-4 text-white">
        <button
          onClick={() => router.back()}
          className="rounded-full p-2 hover:bg-white/10"
          aria-label="戻る"
        >
          ←
        </button>
        <h1 className="text-lg font-semibold">問題を撮影</h1>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center p-4">
        {error && (
          <div className="mb-4 w-full rounded-xl bg-red-500/20 p-4 text-red-200">
            {error}
          </div>
        )}

        {!capturedImage ? (
          <>
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-black">
              {isCapturing ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="aspect-[3/4] w-full object-cover"
                  />
                  <div className="absolute inset-0 border-4 border-white/50" />
                </>
              ) : (
                <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-4 bg-slate-800 text-slate-400">
                  <span className="text-6xl">📷</span>
                  <p>カメラを起動して問題を撮影</p>
                  <button
                    onClick={startCamera}
                    className="rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500"
                  >
                    カメラを起動
                  </button>
                  <label className="cursor-pointer rounded-xl border border-slate-500 px-6 py-3 hover:bg-slate-700">
                    <span>ギャラリーから選択</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () =>
                            setCapturedImage(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            {isCapturing && (
              <button
                onClick={takePhoto}
                className="mt-6 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 text-2xl transition hover:bg-white/30"
                aria-label="撮影"
              >
                📸
              </button>
            )}
          </>
        ) : (
          <div className="flex w-full max-w-md flex-col gap-4">
            <div className="overflow-hidden rounded-2xl">
              <img
                src={capturedImage}
                alt="撮影した問題"
                className="w-full object-contain"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={retake}
                className="flex-1 rounded-xl border border-slate-500 py-3 font-medium text-white hover:bg-slate-700"
              >
                やり直す
              </button>
              <button
                onClick={submitImage}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {isSubmitting ? "解析中..." : "解説を始める"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
