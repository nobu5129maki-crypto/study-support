"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { studyApiUrl } from "@/lib/apiUrl";

const MAX_IMAGE_EDGE = 1600;

async function fileToResizedDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image load failed"));
      el.src = objectUrl;
    });
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) throw new Error("invalid image");
    const ratio = Math.min(1, MAX_IMAGE_EDGE / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

type Props = {
  onBack: () => void;
  onStart: (sessionId: string) => void;
};

export function CaptureScreen({ onBack, onStart }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [frameScale, setFrameScale] = useState(0.65);
  const [frameAspect, setFrameAspect] = useState<"square" | "landscape" | "portrait">("landscape");

  useEffect(() => {
    if (!isCapturing || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    const id = requestAnimationFrame(() => {
      video.srcObject = stream;
      video.play().catch((e) => console.error("Video play error:", e));
    });
    return () => cancelAnimationFrame(id);
  }, [isCapturing]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const startCamera = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setIsStartingCamera(true);
    setError(null);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      }
      streamRef.current = stream;
      setIsCapturing(true);
    } catch (err) {
      const insecure = typeof window !== "undefined" && !window.isSecureContext;
      setError(
        !navigator.mediaDevices?.getUserMedia || insecure
          ? "この環境ではカメラを使えません（HTTPS が必要です）。「ギャラリーから選択」をご利用ください。"
          : "カメラにアクセスできません。カメラの許可を確認するか、「ギャラリーから選択」をご利用ください。"
      );
      console.error(err);
    } finally {
      startingRef.current = false;
      setIsStartingCamera(false);
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
    if (!vw || !vh) {
      setError("カメラ映像の準備中です。少し待ってからもう一度撮影してください。");
      return;
    }
    const scale = Math.max(0.35, Math.min(1, frameScale));

    const dispW = video.clientWidth || vw;
    const dispH = video.clientHeight || vh;
    const coverScale = Math.max(dispW / vw, dispH / vh);
    const frameDispW = frameAspect === "portrait" ? dispW * scale * 0.5 : dispW * scale;
    const frameRatio = frameAspect === "landscape" ? 2 : frameAspect === "portrait" ? 0.5 : 1;
    let frameDispH = frameDispW / frameRatio;
    let frameW = frameDispW;
    if (frameDispH > dispH) {
      frameDispH = dispH;
      frameW = frameDispH * frameRatio;
    }

    const cw = Math.min(vw, Math.floor(frameW / coverScale));
    const ch = Math.min(vh, Math.floor(frameDispH / coverScale));
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
    setError(null);
    try {
      const res = await fetch(studyApiUrl("analyze"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: capturedImage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error ||
            (res.status === 413
              ? "画像サイズが大きすぎます。撮影枠を小さくするか、もう一度撮影してください。"
              : res.status >= 500
                ? "サーバーが混み合っています。少し待ってからもう一度お試しください。"
                : "エラーが発生しました")
        );
      }
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          `study_session_${data.sessionId}`,
          JSON.stringify({ problemText: data.problemText, subject: data.subject })
        );
      }
      onStart(String(data.sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }, [capturedImage, onStart]);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-900">
      <header className="flex shrink-0 items-center gap-4 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full p-2 hover:bg-white/10"
          aria-label="戻る"
        >
          ←
        </button>
        <h1 className="text-lg font-semibold">問題を撮影</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <div className="m-auto flex w-full max-w-md flex-col items-center">
          {error && (
            <div className="mb-4 w-full max-w-md rounded-xl bg-red-500/20 p-4 text-red-200" role="alert">
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
                    {isStartingCamera ? (
                      <>
                        <div
                          className="h-12 w-12 animate-spin rounded-full border-4 border-slate-600 border-t-indigo-400"
                          role="status"
                          aria-label="カメラを起動しています"
                        />
                        <p>カメラを起動しています…</p>
                      </>
                    ) : (
                      <>
                        <span className="text-6xl">📷</span>
                        <p>カメラを起動して問題を撮影</p>
                        <button
                          type="button"
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
                            className="hidden"
                            onChange={async (e) => {
                              const input = e.target;
                              const file = input.files?.[0];
                              if (!file) return;
                              setError(null);
                              try {
                                setCapturedImage(await fileToResizedDataUrl(file));
                              } catch (err) {
                                console.error(err);
                                setError("画像を読み込めませんでした。別の画像を選んでください。");
                              } finally {
                                input.value = "";
                              }
                            }}
                          />
                        </label>
                      </>
                    )}
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
              {isCapturing && (
                <button
                  type="button"
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
                <img src={capturedImage} alt="撮影した問題" className="w-full object-contain" />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={retake}
                  className="flex-1 rounded-xl border border-slate-500 py-3 font-medium text-white hover:bg-slate-700"
                >
                  やり直す
                </button>
                <button
                  type="button"
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
    </div>
  );
}
