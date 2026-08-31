"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, RotateCw, X, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

type Status = "idle" | "requesting" | "scanning" | "denied" | "no-camera" | "error";

const NATIVE_BARCODE_FORMATS = [
  "code_128",
  "code_39",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "qr_code",
  "codabar",
  "itf",
];

export default function CameraBarcodeScanner({
  open,
  onOpenChange,
  onDetected,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (value: string) => void;
  label?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const detectedRef = useRef(false);
  const [status, setStatus] = useState<Status>("idle");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleHit(value: string) {
    if (detectedRef.current) return;
    detectedRef.current = true;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(80);
    onDetected(value);
    onOpenChange(false);
  }

  async function start() {
    stop();
    detectedRef.current = false;

    if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      return;
    }

    setStatus("requesting");

    // Prefer the native BarcodeDetector when available (fast path, mainly Chrome/Android).
    const hasNativeDetector = "BarcodeDetector" in window && !!window.BarcodeDetector;
    const constraints: MediaStreamConstraints = {
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    };

    try {
      if (hasNativeDetector) {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("scanning");
        detectorRef.current = new window.BarcodeDetector!({ formats: NATIVE_BARCODE_FORMATS });
        rafRef.current = requestAnimationFrame(tickNative);
      } else {
        // Cross-browser fallback (Safari/iOS, Firefox, desktop, etc.) using ZXing, which
        // decodes frames in JS instead of relying on a native browser API. Let ZXing own
        // getUserMedia + attaching the stream to <video> itself — manually attaching the
        // stream first and then handing it to ZXing causes a double play()/srcObject
        // assignment that iOS Safari (and thus Chrome on iOS, which uses WebKit) aborts.
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(constraints, videoRef.current!, (result) => {
          if (result) {
            handleHit(result.getText());
          }
          // The callback also fires on every frame with no match found — ignore those.
        });
        zxingControlsRef.current = controls;
        streamRef.current = (videoRef.current?.srcObject as MediaStream) ?? null;
        setStatus("scanning");
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
        setStatus("denied");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setStatus("no-camera");
      } else {
        setStatus("error");
      }
    }
  }

  async function tickNative() {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector) return;
    if (video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tickNative);
      return;
    }
    try {
      const codes = await detector.detect(video);
      if (codes.length > 0 && codes[0].rawValue) {
        handleHit(codes[0].rawValue);
        return;
      }
    } catch {
      // Ignore transient per-frame decode errors and keep scanning.
    }
    rafRef.current = requestAnimationFrame(tickNative);
  }

  function stop() {
    if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    detectorRef.current = null;
    zxingControlsRef.current?.stop();
    zxingControlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black" style={{ pointerEvents: "auto" }}>
      <div className="pt-safe flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm font-medium">{label ?? "Scan Barcode"}</p>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="tap-shrink flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
          aria-label="Tutup scanner"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden bg-slate-950">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />

        {status === "scanning" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-36 w-[80%] max-w-sm animate-pulse rounded-2xl border-2 border-thread-400 shadow-[0_0_0_2000px_rgba(0,0,0,0.5)]" />
          </div>
        )}

        {status === "requesting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center text-sm text-white">
            Meminta izin kamera...
          </div>
        )}

        {status === "denied" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center text-white">
            <ZapOff className="h-8 w-8 text-thread-400" />
            <p className="text-sm">
              Akses kamera ditolak. Buka pengaturan situs di browser HP kamu, izinkan Kamera untuk halaman ini, lalu coba lagi.
            </p>
            <Button variant="outline" onClick={start}>
              <RotateCw className="mr-2 h-4 w-4" /> Coba Lagi
            </Button>
          </div>
        )}

        {status === "no-camera" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center text-white">
            <Camera className="h-8 w-8 text-thread-400" />
            <p className="text-sm">Kamera tidak ditemukan di perangkat ini.</p>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center text-white">
            <p className="text-sm">Tidak bisa mengakses kamera. Pastikan kamera tidak sedang dipakai aplikasi lain.</p>
            <Button variant="outline" onClick={start}>
              <RotateCw className="mr-2 h-4 w-4" /> Coba Lagi
            </Button>
          </div>
        )}
      </div>

      <p className="pb-safe px-4 py-3 text-center text-xs text-white/60">
        Arahkan kamera ke barcode hingga terdeteksi otomatis
      </p>
    </div>,
    document.body
  );
}
