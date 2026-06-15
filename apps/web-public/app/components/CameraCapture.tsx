import { useState, useRef, useCallback } from "react";

type CameraCaptureProps = {
  onCapture: (blob: Blob, mimeType: string) => void;
  onCancel: () => void;
};

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [mode, setMode] = useState<"idle" | "preview" | "recording">("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [captureType, setCaptureType] = useState<"photo" | "video">("photo");
  const [videoReady, setVideoReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Attach stream to video element whenever the video ref becomes available
  const attachStream = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.onloadedmetadata = () => {
        el.play().catch(() => {});
        setVideoReady(true);
      };
    }
  }, []);

  const startCamera = async (type: "photo" | "video") => {
    setCaptureType(type);
    setVideoReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: type === "video",
      });
      streamRef.current = stream;
      // If video element already exists, attach immediately
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setMode("preview");
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    // Wait for video dimensions to be available
    const width = video.videoWidth || video.clientWidth || 640;
    const height = video.videoHeight || video.clientHeight || 480;

    if (width === 0 || height === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          stopCamera();
          onCapture(blob, "image/jpeg");
        }
      },
      "image/jpeg",
      0.9
    );
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";

    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      stopCamera();
      onCapture(blob, mimeType.split(";")[0] ?? mimeType);
    };

    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setMode("recording");
    setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setVideoReady(false);
    setMode("idle");
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (mode === "idle") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-muted text-center mb-4">Choose capture mode</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => startCamera("photo")}
            className="flex-1 rounded-2xl bg-surface-raised border border-border p-4 text-center hover:bg-surface-hover transition-colors"
          >
            <span className="text-2xl block mb-1">📷</span>
            <span className="text-sm font-medium">Photo</span>
          </button>
          <button
            type="button"
            onClick={() => startCamera("video")}
            className="flex-1 rounded-2xl bg-surface-raised border border-border p-4 text-center hover:bg-surface-hover transition-colors"
          >
            <span className="text-2xl block mb-1">🎬</span>
            <span className="text-sm font-medium">Video</span>
          </button>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="w-full text-sm text-text-muted hover:text-text transition-colors mt-2"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden bg-black">
        <video
          ref={attachStream}
          autoPlay
          playsInline
          muted={captureType === "photo"}
          className="w-full aspect-video object-cover"
        />
        {mode === "recording" && (
          <div className="absolute top-3 right-3 flex items-center gap-2 bg-red-600/90 text-white text-xs font-bold px-3 py-1 rounded-full">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            {formatTime(recordingTime)}
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-center">
        {captureType === "photo" && mode === "preview" && (
          <button
            type="button"
            onClick={capturePhoto}
            disabled={!videoReady}
            className="rounded-full bg-accent px-8 py-3 text-sm font-bold text-black hover:scale-[1.03] transition-all disabled:opacity-50"
          >
            {videoReady ? "Capture 📸" : "Loading..."}
          </button>
        )}
        {captureType === "video" && mode === "preview" && (
          <button
            type="button"
            onClick={startRecording}
            disabled={!videoReady}
            className="rounded-full bg-red-500 px-8 py-3 text-sm font-bold text-white hover:scale-[1.03] transition-all disabled:opacity-50"
          >
            {videoReady ? "Start Recording 🔴" : "Loading..."}
          </button>
        )}
        {mode === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-full bg-red-600 px-8 py-3 text-sm font-bold text-white hover:scale-[1.03] transition-all animate-pulse"
          >
            Stop ⏹
          </button>
        )}
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-full bg-surface-raised border border-border px-6 py-3 text-sm text-text-muted hover:text-text transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
