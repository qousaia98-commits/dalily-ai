/**
 * Browser microphone recorder — MediaRecorder + AnalyserNode, no framework
 * dependency. Hard-caps recordings at MAX_RECORDING_MS and releases the
 * mic track on stop/cancel so the browser's recording indicator clears.
 * Sprint 5 Phase 4: pause / resume supported.
 */

export const MAX_RECORDING_MS = 60_000;
/** Longer cap for chat voice messages (still no live calls). */
export const MAX_CHAT_VOICE_RECORDING_MS = 120_000;

const CANDIDATE_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

export type VoiceRecorderErrorReason = "permission_denied" | "not_supported" | "unknown";

export class VoiceRecorderError extends Error {
  constructor(public readonly reason: VoiceRecorderErrorReason) {
    super(reason);
    this.name = "VoiceRecorderError";
  }
}

function pickMimeType(): string {
  for (const type of CANDIDATE_MIME_TYPES) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelData: Uint8Array | null = null;
  private chunks: Blob[] = [];
  private mimeType = "";
  private startedAt = 0;
  private pausedAccumulatedMs = 0;
  private pausedAt: number | null = null;
  private maxMs = MAX_RECORDING_MS;
  private stopResolve: ((blob: Blob) => void) | null = null;

  constructor(options?: { maxMs?: number }) {
    if (options?.maxMs && options.maxMs > 0) {
      this.maxMs = options.maxMs;
    }
  }

  async start(): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new VoiceRecorderError("not_supported");
    }
    if (typeof MediaRecorder === "undefined") {
      throw new VoiceRecorderError("not_supported");
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      console.error("[voice] getUserMedia failed:", name, error);
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new VoiceRecorderError("permission_denied");
      }
      if (name === "NotFoundError") {
        throw new VoiceRecorderError("not_supported");
      }
      throw new VoiceRecorderError("unknown");
    }

    this.mimeType = pickMimeType();
    this.chunks = [];
    this.pausedAccumulatedMs = 0;
    this.pausedAt = null;

    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.levelData = new Uint8Array(this.analyser.frequencyBinCount);
    source.connect(this.analyser);

    this.mediaRecorder = new MediaRecorder(
      this.stream,
      this.mimeType ? { mimeType: this.mimeType } : undefined,
    );
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.mediaRecorder.onerror = (event) => {
      console.error("[voice] MediaRecorder error:", event);
    };
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: this.mimeType || "audio/webm" });
      this.stopResolve?.(blob);
      this.stopResolve = null;
    };

    this.mediaRecorder.start(250);
    this.startedAt = Date.now();
  }

  pause(): void {
    if (!this.mediaRecorder || this.mediaRecorder.state !== "recording") return;
    if (typeof this.mediaRecorder.pause === "function") {
      this.mediaRecorder.pause();
      this.pausedAt = Date.now();
    }
  }

  resume(): void {
    if (!this.mediaRecorder || this.mediaRecorder.state !== "paused") return;
    if (typeof this.mediaRecorder.resume === "function") {
      if (this.pausedAt != null) {
        this.pausedAccumulatedMs += Date.now() - this.pausedAt;
        this.pausedAt = null;
      }
      this.mediaRecorder.resume();
    }
  }

  isPaused(): boolean {
    return this.mediaRecorder?.state === "paused";
  }

  getState(): "inactive" | "recording" | "paused" {
    const s = this.mediaRecorder?.state;
    if (s === "recording" || s === "paused") return s;
    return "inactive";
  }

  /** 0–1 RMS amplitude for the current frame, for UI polling via rAF. */
  getLevel(): number {
    if (this.isPaused()) return 0;
    if (!this.analyser || !this.levelData) return 0;
    this.analyser.getByteTimeDomainData(this.levelData as Uint8Array<ArrayBuffer>);
    let sumSquares = 0;
    for (const value of this.levelData) {
      const normalized = (value - 128) / 128;
      sumSquares += normalized * normalized;
    }
    return Math.min(1, Math.sqrt(sumSquares / this.levelData.length));
  }

  getElapsedMs(): number {
    if (!this.startedAt) return 0;
    const pauseExtra =
      this.pausedAt != null ? Date.now() - this.pausedAt : 0;
    const raw =
      Date.now() - this.startedAt - this.pausedAccumulatedMs - pauseExtra;
    return Math.min(Math.max(0, raw), this.maxMs);
  }

  getMaxMs(): number {
    return this.maxMs;
  }

  async stop(): Promise<Blob> {
    if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
      return new Blob(this.chunks, { type: this.mimeType || "audio/webm" });
    }

    if (this.mediaRecorder.state === "paused" && typeof this.mediaRecorder.resume === "function") {
      this.mediaRecorder.resume();
    }

    const blob = await new Promise<Blob>((resolve) => {
      this.stopResolve = resolve;
      this.mediaRecorder?.stop();
    });

    this.teardown();
    return blob;
  }

  cancel(): void {
    this.stopResolve = null;
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }
    this.teardown();
  }

  private teardown(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    void this.audioContext?.close();
    this.audioContext = null;
    this.analyser = null;
    this.levelData = null;
    this.chunks = [];
    this.pausedAccumulatedMs = 0;
    this.pausedAt = null;
    this.startedAt = 0;
  }
}
