import { useCallback, useEffect, useRef, useState } from 'react';

const HOLD_THRESHOLD_MS = 380;

export interface CaptureToast {
  id: number;
  kind: 'screenshot' | 'video' | 'error';
  message: string;
  previewUrl?: string;
}

interface UseInGameCaptureOptions {
  enabled: boolean;
  getScreenshotDataUrl: () => string | null;
  getCaptureStream: () => MediaStream | null;
}

function formatTimestampForFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

function triggerFileDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function pickSupportedRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export function useInGameCapture({
  enabled,
  getScreenshotDataUrl,
  getCaptureStream,
}: UseInGameCaptureOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [flashActive, setFlashActive] = useState(false);
  const [toast, setToast] = useState<CaptureToast | null>(null);

  const f10DownRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const recordingStartMsRef = useRef<number>(0);
  const recordingTickRef = useRef<number | null>(null);
  const lastPreviewObjectUrlRef = useRef<string | null>(null);

  const showToast = useCallback((next: Omit<CaptureToast, 'id'>) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    if (lastPreviewObjectUrlRef.current && next.previewUrl !== lastPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(lastPreviewObjectUrlRef.current);
      lastPreviewObjectUrlRef.current = null;
    }
    if (next.previewUrl && next.previewUrl.startsWith('blob:')) {
      lastPreviewObjectUrlRef.current = next.previewUrl;
    }

    const id = Date.now();
    setToast({ id, ...next });
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
      toastTimerRef.current = null;
    }, 3600);
  }, []);

  const takeScreenshot = useCallback(() => {
    const dataUrl = getScreenshotDataUrl();
    if (!dataUrl) {
      showToast({ kind: 'error', message: 'Unable to capture screenshot right now.' });
      return;
    }

    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
    }
    setFlashActive(true);
    flashTimerRef.current = window.setTimeout(() => {
      setFlashActive(false);
      flashTimerRef.current = null;
    }, 180);

    const filename = `Vietnam-1968-Shot-${formatTimestampForFilename()}.png`;
    triggerFileDownload(dataUrl, filename);
    showToast({
      kind: 'screenshot',
      message: `Screenshot saved (${filename})`,
      previewUrl: dataUrl,
    });
  }, [getScreenshotDataUrl, showToast]);

  const stopRecording = useCallback(() => {
    if (recordingTickRef.current !== null) {
      window.clearInterval(recordingTickRef.current);
      recordingTickRef.current = null;
    }

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // ignore stop race
      }
    }
    recorderRef.current = null;
    setIsRecording(false);
    setRecordingSec(0);
  }, []);

  const startRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      showToast({ kind: 'error', message: 'Video recording is not supported in this browser.' });
      return;
    }

    const stream = getCaptureStream();
    if (!stream) {
      showToast({ kind: 'error', message: 'Unable to access gameplay video stream.' });
      return;
    }

    const mimeType = pickSupportedRecorderMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 })
        : new MediaRecorder(stream);
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        showToast({ kind: 'error', message: 'Failed to initialize video recorder.' });
        return;
      }
    }

    recordedChunksRef.current = [];
    activeStreamRef.current = stream;
    recorderRef.current = recorder;
    recordingStartMsRef.current = performance.now();
    setIsRecording(true);
    setRecordingSec(0);

    if (recordingTickRef.current !== null) {
      window.clearInterval(recordingTickRef.current);
    }
    recordingTickRef.current = window.setInterval(() => {
      const elapsed = Math.floor((performance.now() - recordingStartMsRef.current) / 1000);
      setRecordingSec(elapsed);
    }, 200);

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        recordedChunksRef.current.push(ev.data);
      }
    };

    recorder.onstop = () => {
      const chunks = recordedChunksRef.current;
      recordedChunksRef.current = [];
      const streamToStop = activeStreamRef.current;
      activeStreamRef.current = null;
      if (streamToStop) {
        for (const track of streamToStop.getVideoTracks()) {
          track.stop();
        }
      }

      if (chunks.length === 0) return;
      const outMime = recorder.mimeType || mimeType || 'video/webm';
      const ext = outMime.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: outMime });
      const blobUrl = URL.createObjectURL(blob);
      const durationSec = Math.max(0.4, (performance.now() - recordingStartMsRef.current) / 1000);
      const filename = `Vietnam-1968-Clip-${formatTimestampForFilename()}.${ext}`;
      triggerFileDownload(blobUrl, filename);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 8000);
      showToast({
        kind: 'video',
        message: `Footage saved (${durationSec.toFixed(1)}s · ${filename})`,
      });
    };

    recorder.start(250);
  }, [getCaptureStream, showToast]);

  const cancelHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  // Keyboard shortcut: Tap F10 for screenshot, Hold F10 to record footage
  useEffect(() => {
    if (!enabled) {
      f10DownRef.current = false;
      cancelHoldTimer();
      stopRecording();
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'F10') return;
      e.preventDefault();
      if (e.repeat || f10DownRef.current) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      f10DownRef.current = true;
      cancelHoldTimer();
      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null;
        if (f10DownRef.current) {
          startRecording();
        }
      }, HOLD_THRESHOLD_MS);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'F10') return;
      e.preventDefault();
      if (!f10DownRef.current) return;
      f10DownRef.current = false;

      if (holdTimerRef.current !== null) {
        cancelHoldTimer();
        takeScreenshot();
      } else {
        stopRecording();
      }
    };

    const onWindowBlur = () => {
      f10DownRef.current = false;
      cancelHoldTimer();
      stopRecording();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      f10DownRef.current = false;
      cancelHoldTimer();
      stopRecording();
    };
  }, [enabled, cancelHoldTimer, startRecording, stopRecording, takeScreenshot]);

  // Pointer press/release helpers for HUD / Touch capture button (tap = screenshot, hold = record)
  const beginCapturePress = useCallback(() => {
    if (!enabled) return;
    cancelHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      startRecording();
    }, HOLD_THRESHOLD_MS);
  }, [enabled, cancelHoldTimer, startRecording]);

  const endCapturePress = useCallback(() => {
    if (holdTimerRef.current !== null) {
      cancelHoldTimer();
      takeScreenshot();
    } else if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      stopRecording();
    }
  }, [cancelHoldTimer, stopRecording, takeScreenshot]);

  useEffect(() => {
    return () => {
      cancelHoldTimer();
      stopRecording();
      if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      if (lastPreviewObjectUrlRef.current) {
        URL.revokeObjectURL(lastPreviewObjectUrlRef.current);
      }
    };
  }, [cancelHoldTimer, stopRecording]);

  return {
    isRecording,
    recordingSec,
    flashActive,
    toast,
    takeScreenshot,
    startRecording,
    stopRecording,
    beginCapturePress,
    endCapturePress,
  };
}
