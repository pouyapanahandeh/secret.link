import { useCallback, useEffect, useRef, useState } from "react";

interface FullScreenCameraProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

type CameraMode = "photo" | "video";

const MAX_VIDEO_DURATION_MS = 60_000;

/**
 * Full-screen camera overlay using the MediaStream API.
 * Supports photo capture (tap shutter) and video recording (hold shutter or toggle mode).
 * Provides front/back camera flip and a visual recording timer.
 */
export function FullScreenCamera({ onCapture, onClose }: FullScreenCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [mode, setMode] = useState<CameraMode>("photo");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [streamReady, setStreamReady] = useState(false);

  const startStream = useCallback(async (facing: "user" | "environment") => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setStreamReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreamReady(true);
      setError(null);
    } catch {
      setError("Camera access denied. Please allow camera permissions.");
    }
  }, []);

  useEffect(() => {
    startStream(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  function flipCamera() {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    startStream(next);
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
      }
    }, "image/jpeg", 0.92);
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const file = new File([blob], `video-${Date.now()}.webm`, { type: mimeType });
      onCapture(file);
      setRecording(false);
      setRecordingMs(0);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };

    recorder.start(100);
    setRecording(true);
    setRecordingMs(0);

    const start = Date.now();
    recordingTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      setRecordingMs(elapsed);
      if (elapsed >= MAX_VIDEO_DURATION_MS) {
        stopRecording();
      }
    }, 100);
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  }

  function handleShutterClick() {
    if (mode === "photo") {
      capturePhoto();
    } else {
      if (recording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  }

  const progressPct = recording ? Math.min(recordingMs / MAX_VIDEO_DURATION_MS, 1) : 0;

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video preview */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
            <span className="text-4xl">📷</span>
            <p className="text-white/80 text-sm text-center">{error}</p>
            <button
              onClick={onClose}
              className="text-accent text-sm underline"
            >
              Go back
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
          />
        )}

        {/* Recording indicator */}
        {recording && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-sm font-mono">
              {Math.floor(recordingMs / 1000)}s / 60s
            </span>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 left-6 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white text-xl hover:bg-black/60 transition-colors"
          aria-label="Close camera"
        >
          ×
        </button>

        {/* Flip camera */}
        {streamReady && (
          <button
            onClick={flipCamera}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
            aria-label="Flip camera"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>

      {/* Bottom controls */}
      <div className="bg-black/90 backdrop-blur-sm px-6 py-6 pb-8 flex flex-col items-center gap-4">
        {/* Mode toggle */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => { if (!recording) setMode("photo"); }}
            className={`text-sm font-medium transition-colors ${mode === "photo" ? "text-white" : "text-white/50"}`}
          >
            Photo
          </button>
          <button
            onClick={() => { if (!recording) setMode("video"); }}
            className={`text-sm font-medium transition-colors ${mode === "video" ? "text-white" : "text-white/50"}`}
          >
            Video
          </button>
        </div>

        {/* Shutter button */}
        <button
          onClick={handleShutterClick}
          disabled={!streamReady}
          className="relative w-20 h-20 rounded-full flex items-center justify-center disabled:opacity-40"
          aria-label={mode === "photo" ? "Take photo" : recording ? "Stop recording" : "Start recording"}
        >
          {/* Outer ring / progress */}
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="white" strokeWidth="4" opacity="0.5" />
            {recording && (
              <circle
                cx="40" cy="40" r="36"
                fill="none"
                stroke="#ef4444"
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 36}`}
                strokeDashoffset={`${2 * Math.PI * 36 * (1 - progressPct)}`}
                strokeLinecap="round"
                className="transition-all duration-100"
              />
            )}
          </svg>
          {/* Inner button */}
          <span
            className={`transition-all duration-200 ${
              mode === "video" && recording
                ? "w-8 h-8 rounded-md bg-red-500"
                : mode === "video"
                  ? "w-14 h-14 rounded-full bg-red-500"
                  : "w-14 h-14 rounded-full bg-white"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
