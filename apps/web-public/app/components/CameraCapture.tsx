import { useState, useRef, useEffect, useCallback } from "react";

type CameraCaptureProps = {
  onCapture: (blob: Blob, mimeType: string) => void;
  onCancel: () => void;
};

type Mode = "photo" | "video";
type Facing = "user" | "environment";

/** Turn a getUserMedia failure into a human-readable message. */
function describeError(err: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Camera requires a secure (HTTPS) connection.";
  }
  const name = err && typeof err === "object" && "name" in err ? (err as DOMException).name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera access was blocked. Allow camera access in your browser settings, then try again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device.";
    case "NotReadableError":
      return "Your camera is already in use by another app.";
    default:
      return "Couldn't access the camera. Please check permissions and try again.";
  }
}

/**
 * Full-screen camera. Opens a live preview, lets the user toggle between
 * photo / video, flip front/back, capture a still or record a clip, and
 * surfaces a clear message if the camera can't be accessed.
 */
export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const cancelledRef = useRef(false);

  const [mode, setMode] = useState<Mode>("photo");
  const [facing, setFacing] = useState<Facing>("environment");
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setVideoReady(false);
  }, []);

  const startStream = useCallback(
    async (m: Mode, f: Facing) => {
      setError(null);
      setStarting(true);
      setVideoReady(false);
      stopStream();
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new DOMException("Unsupported", "NotFoundError");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: f, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: m === "video",
        });
        streamRef.current = stream;
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          el.onloadedmetadata = () => {
            el.play().catch(() => {});
            setVideoReady(true);
          };
        }
      } catch (err) {
        setError(describeError(err));
      } finally {
        setStarting(false);
      }
    },
    [stopStream],
  );

  // (Re)start the camera on mount and whenever mode/facing changes.
  useEffect(() => {
    startStream(mode, facing);
    return () => stopStream();
  }, [mode, facing]);

  // Clear the recording timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    if (!width || !height) return;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror the front camera so the photo matches what the user sees.
    if (facing === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          stopStream();
          onCapture(blob, "image/jpeg");
        }
      },
      "image/jpeg",
      0.9,
    );
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";

    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    cancelledRef.current = false;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      if (cancelledRef.current) {
        cancelledRef.current = false;
        return;
      }
      const blob = new Blob(chunksRef.current, { type: mimeType });
      stopStream();
      onCapture(blob, mimeType.split(";")[0] ?? mimeType);
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    recorderRef.current?.stop();
  }

  function handleCancel() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      cancelledRef.current = true;
      recorderRef.current.stop();
    }
    stopStream();
    onCancel();
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col select-none">
      {/* Live preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover ${facing === "user" ? "scale-x-[-1]" : ""}`}
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
        <button
          type="button"
          onClick={handleCancel}
          aria-label="Close camera"
          className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center text-2xl leading-none"
        >
          ×
        </button>
        {recording ? (
          <div className="flex items-center gap-2 bg-red-600/90 text-white text-sm font-bold px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            {formatTime(recordingTime)}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            disabled={!videoReady}
            aria-label="Flip camera"
            className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center text-lg disabled:opacity-40"
          >
            ⟳
          </button>
        )}
      </div>

      <div className="flex-1" />

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/85 px-8 text-center">
          <span className="text-4xl">📷</span>
          <p className="text-white text-sm leading-relaxed max-w-xs">{error}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => startStream(mode, facing)}
              className="rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-black"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border border-white/30 px-6 py-2.5 text-sm text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      {!error && (
        <div className="relative z-10 pb-10 pt-4 bg-gradient-to-t from-black/70 to-transparent">
          {/* Mode toggle */}
          {!recording && (
            <div className="flex justify-center gap-8 mb-5">
              <button
                type="button"
                onClick={() => setMode("photo")}
                className={`text-sm font-semibold tracking-wide ${mode === "photo" ? "text-accent" : "text-white/60"}`}
              >
                PHOTO
              </button>
              <button
                type="button"
                onClick={() => setMode("video")}
                className={`text-sm font-semibold tracking-wide ${mode === "video" ? "text-accent" : "text-white/60"}`}
              >
                VIDEO
              </button>
            </div>
          )}

          {/* Shutter */}
          <div className="flex items-center justify-center">
            {mode === "photo" ? (
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!videoReady}
                aria-label="Capture photo"
                className="w-[68px] h-[68px] rounded-full ring-4 ring-white/60 flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
              >
                <span className="w-14 h-14 rounded-full bg-white" />
              </button>
            ) : (
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={!videoReady && !recording}
                aria-label={recording ? "Stop recording" : "Start recording"}
                className="w-[68px] h-[68px] rounded-full ring-4 ring-white/60 flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
              >
                {recording ? (
                  <span className="w-7 h-7 rounded-md bg-red-600" />
                ) : (
                  <span className="w-14 h-14 rounded-full bg-red-500" />
                )}
              </button>
            )}
          </div>

          {starting && !videoReady && (
            <p className="text-center text-white/60 text-xs mt-3">Starting camera…</p>
          )}
        </div>
      )}
    </div>
  );
}
