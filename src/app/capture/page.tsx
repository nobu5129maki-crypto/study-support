"use client";

import { useRef, useState, useCallback, useEffect } from "react";
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
  // 撮影枠のサイズ（0.35=小〜1.0=大）。小さいほど1問に絞りやすい
  const [frameScale, setFrameScale] = useState(0.65);
  // 撮影枠のアスペクト比：square=正方形, landscape=横長(数学向け), portrait=縦長
  const [frameAspect, setFrameAspect] = useState<"square" | "landscape" | "portrait">("landscape");

  // ビデオ要素が表示された後にストリームを設定（真っ暗になる原因を解消）
  useEffect(() => {
    if (!isCapturing || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    // DOM 描画後にストリームを設定
    const id = requestAnimationFrame(() => {
      video.srcObject = stream;
      video.play().catch((e) => console.error("Video play error:", e));
    });
    return () => cancelAnimationFrame(id);
  }, [isCapturing]);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      // スマホは背面、PCは前面カメラ。environment が使えない場合は user にフォールバック
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 } },
          audio: false,
        });
      }
      streamRef.current = stream;
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

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.max(0.35, Math.min(1, frameScale));

    // アスペクト比に応じてクロップ領域を計算（横長=数学向け、縦長=長文向け）
    const aspectRatios = {
      square: { w: 1, h: 1 },
      landscape: { w: 2, h: 1 },  // 横長：数式・横書き問題向け
      portrait: { w: 1, h: 2 },   // 縦長：長文・縦書き向け
    };
    const { w: aw, h: ah } = aspectRatios[frameAspect];
    const maxDim = Math.min(vw / aw, vh / ah) * scale;
    const cw = Math.floor(maxDim * aw);
    const ch = Math.floor(maxDim * ah);
    const cx = Math.floor((vw - cw) / 2);
    const cy = Math.floor((vh - ch) / 2);

    canvas.width = cw;
    canvas.height = ch;
    ctx.drawImage(video, cx, cy, cw, ch, 0, 0, cw, ch);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(dataUrl);
    stopCamera();
  }, [stopCamera, frameScale, frameAspect]);

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
                    className="aspect-[3/4] w-full min-h-[300px] object-cover bg-black"
                  />
                  {/* 撮影枠：横長=数学・数式向け、縦長=長文向け */}
                  <div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-white pointer-events-none"
                    style={{
                      width: frameAspect === "portrait" ? `${frameScale * 50}%` : `${frameScale * 100}%`,
                      aspectRatio: frameAspect === "landscape" ? "2/1" : frameAspect === "portrait" ? "1/2" : "1",
                      boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                    }}
                  />
                  <div className="absolute bottom-2 left-2 right-2 space-y-2">
                    <div className="flex gap-1 p-1 rounded-lg bg-black/60">
                      <button
                        type="button"
                        onClick={() => setFrameAspect("landscape")}
                        className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition ${
                          frameAspect === "landscape"
                            ? "bg-indigo-500 text-white"
                            : "text-white/70 hover:bg-white/20"
                        }`}
                      >
                        横長
                      </button>
                      <button
                        type="button"
                        onClick={() => setFrameAspect("square")}
                        className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition ${
                          frameAspect === "square"
                            ? "bg-indigo-500 text-white"
                            : "text-white/70 hover:bg-white/20"
                        }`}
                      >
                        正方形
                      </button>
                      <button
                        type="button"
                        onClick={() => setFrameAspect("portrait")}
                        className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition ${
                          frameAspect === "portrait"
                            ? "bg-indigo-500 text-white"
                            : "text-white/70 hover:bg-white/20"
                        }`}
                      >
                        縦長
                      </button>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60">
                      <span className="text-xs text-white shrink-0">小</span>
                      <input
                        type="range"
                        min="0.35"
                        max="1"
                        step="0.05"
                        value={frameScale}
                        onChange={(e) => setFrameScale(parseFloat(e.target.value))}
                        className="flex-1 h-2 accent-indigo-400"
                      />
                      <span className="text-xs text-white shrink-0">大</span>
                    </div>
                  </div>
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
