import type { FaceMesh as FaceMeshInstance } from '@mediapipe/face_mesh';
import faceMeshAssetsLoaderUrl from '@mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js?url';
import faceMeshWasmUrl from '@mediapipe/face_mesh/face_mesh_solution_wasm_bin.js?url';
import faceMeshWasmBinaryUrl from '@mediapipe/face_mesh/face_mesh_solution_wasm_bin.wasm?url';
import faceMeshSimdWasmUrl from '@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js?url';
import faceMeshSimdWasmBinaryUrl from '@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm?url';
import faceMeshGraphUrl from '@mediapipe/face_mesh/face_mesh.binarypb?url';
import faceMeshDataUrl from '@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.data?url';
import faceMeshPackedDataUrl from '@mediapipe/face_mesh/face_mesh_solution_packed_assets.data?url';
import type { StudentExamBehaviorEventData } from '@/api/schoolApi';

type WebRtcVad = import('@ozymandiasthegreat/vad').VAD;

const faceMeshAssets: Record<string, string> = {
  'face_mesh_solution_packed_assets_loader.js': faceMeshAssetsLoaderUrl,
  'face_mesh_solution_wasm_bin.js': faceMeshWasmUrl,
  'face_mesh_solution_wasm_bin.wasm': faceMeshWasmBinaryUrl,
  'face_mesh_solution_simd_wasm_bin.js': faceMeshSimdWasmUrl,
  'face_mesh_solution_simd_wasm_bin.wasm': faceMeshSimdWasmBinaryUrl,
  'face_mesh.binarypb': faceMeshGraphUrl,
  'face_mesh_solution_simd_wasm_bin.data': faceMeshDataUrl,
  'face_mesh_solution_packed_assets.data': faceMeshPackedDataUrl,
};

interface ExamBehaviorMonitorOptions {
  stream: MediaStream;
  monitorTabSwitch: boolean;
  monitorFace: boolean;
  monitorSpeech: boolean;
  sendEventToBackend: (eventData: StudentExamBehaviorEventData) => Promise<unknown>;
  onDetection: (eventData: StudentExamBehaviorEventData) => void;
  onReady: () => void;
  onError: (error: Error) => void;
}

function resampleTo16kHz(input: Float32Array, sourceRate: number) {
  const outputLength = Math.floor(input.length * 16_000 / sourceRate);
  const output = new Float32Array(outputLength);
  for (let index = 0; index < outputLength; index += 1) {
    output[index] = input[Math.min(input.length - 1, Math.floor(index * sourceRate / 16_000))];
  }
  return output;
}

export async function startExamBehaviorMonitor({
  stream,
  monitorTabSwitch,
  monitorFace,
  monitorSpeech,
  sendEventToBackend,
  onDetection,
  onReady,
  onError,
}: ExamBehaviorMonitorOptions) {
  let active = true;
  let faceLoopTimer = 0;
  let audioWatchdogTimer = 0;
  let faceProcessing = false;
  let faceProcessingFailed = false;
  let faceResultsReceived = false;
  let faceStartedAt = 0;
  let faceMesh: FaceMeshInstance | null = null;
  let faceVideo: HTMLVideoElement | null = null;
  let videoTrack: MediaStreamTrack | null = null;
  let audioContext: AudioContext | null = null;
  let audioSource: MediaStreamAudioSourceNode | null = null;
  let audioProcessor: ScriptProcessorNode | null = null;
  let audioTrack: MediaStreamTrack | null = null;
  let audioFramesReceived = false;
  let silentOutput: GainNode | null = null;
  let vad: WebRtcVad | null = null;
  let vadFailed = false;
  let hiddenAt: number | null = null;
  let faceCondition: { eventType: 'face_missing' | 'multiple_faces'; startedAt: number; sent: boolean } | null = null;
  let speechStartedAt: number | null = null;
  let speechLastVoiceAt: number | null = null;
  let speechEventSent = false;
  const speechSamples: number[] = [];

  const reportFailure = (message: string, error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    onError(new Error(`${message}: ${detail}`));
  };

  const sendEvent = (eventType: StudentExamBehaviorEventData['event_type'], timestamp: number, durationSeconds: number) => {
    if (!active) return;
    const eventData = {
      event_type: eventType,
      timestamp: new Date(timestamp).toISOString(),
      duration_seconds: Math.round(durationSeconds * 1000) / 1000,
    } satisfies StudentExamBehaviorEventData;
    onDetection(eventData);
    void sendEventToBackend(eventData).catch((error: unknown) => {
      reportFailure('Không thể gửi sự kiện giám sát phòng thi', error);
    });
  };

  const stop = () => {
    if (!active) return;
    active = false;
    window.clearTimeout(faceLoopTimer);
    window.clearTimeout(audioWatchdogTimer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    videoTrack?.removeEventListener('ended', handleVideoTrackEnded);
    audioTrack?.removeEventListener('ended', handleAudioTrackEnded);
    if (audioProcessor) {
      audioProcessor.onaudioprocess = null;
      audioProcessor.disconnect();
    }
    audioSource?.disconnect();
    silentOutput?.disconnect();
    vad?.destroy();
    void audioContext?.close().catch((error: unknown) => {
      reportFailure('Không thể đóng bộ xử lý âm thanh cục bộ', error);
    });
    faceVideo?.pause();
    if (faceVideo) faceVideo.srcObject = null;
    if (faceMesh) {
      void faceMesh.close().catch((error: unknown) => {
        reportFailure('Không thể đóng bộ nhận diện khuôn mặt cục bộ', error);
      });
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      if (hiddenAt === null) {
        hiddenAt = Date.now();
        sendEvent('tab_hidden', hiddenAt, 0);
      }
      faceCondition = null;
      return;
    }
    hiddenAt = null;
    if (!faceResultsReceived) faceStartedAt = Date.now();
  };

  const handleVideoTrackEnded = () => {
    faceCondition = null;
    faceProcessingFailed = true;
    reportFailure('Webcam đã ngừng hoạt động trong khi giám sát', new Error('Không thể tiếp tục phát hiện khuôn mặt.'));
  };

  const handleAudioTrackEnded = () => {
    vadFailed = true;
    if (audioProcessor) audioProcessor.onaudioprocess = null;
    reportFailure('Micro đã ngừng hoạt động trong khi giám sát', new Error('Không thể tiếp tục phát hiện giọng nói.'));
  };

  try {
    if (monitorTabSwitch) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        sendEvent('tab_hidden', hiddenAt, 0);
      }
    }

    if (monitorFace) {
      videoTrack = stream.getVideoTracks().find((track) => track.readyState === 'live') ?? null;
      if (!videoTrack) throw new Error('Không có luồng webcam đang hoạt động để phát hiện khuôn mặt.');
      videoTrack.addEventListener('ended', handleVideoTrackEnded);

      const { FaceMesh } = await import('@mediapipe/face_mesh');
      faceVideo = document.createElement('video');
      faceVideo.muted = true;
      faceVideo.playsInline = true;
      faceVideo.srcObject = new MediaStream([videoTrack]);
      faceMesh = new FaceMesh({
        locateFile: (file) => {
          const assetUrl = faceMeshAssets[file];
          if (!assetUrl) throw new Error(`Không tìm thấy tài nguyên Face Mesh: ${file}`);
          return assetUrl;
        },
      });
      faceMesh.setOptions({
        maxNumFaces: 2,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      faceMesh.onResults((results) => {
        if (!active || document.visibilityState === 'hidden') return;
        faceResultsReceived = true;
        const faceCount = results.multiFaceLandmarks?.length ?? 0;
        const eventType = faceCount === 0 ? 'face_missing' : faceCount > 1 ? 'multiple_faces' : null;
        if (!eventType) {
          faceCondition = null;
          return;
        }
        const now = Date.now();
        if (faceCondition?.eventType !== eventType) {
          faceCondition = { eventType, startedAt: now, sent: false };
        }
        const durationSeconds = (now - faceCondition.startedAt) / 1000;
        if (durationSeconds >= 3 && !faceCondition.sent) {
          faceCondition.sent = true;
          sendEvent(eventType, faceCondition.startedAt, durationSeconds);
        }
      });
      await faceMesh.initialize();
      if (!active) return stop;
      await faceVideo.play();
      faceStartedAt = Date.now();

      const processFaceFrame = async () => {
        if (!active || faceProcessingFailed) return;
        if (!faceResultsReceived && Date.now() - faceStartedAt >= 10_000) {
          faceProcessingFailed = true;
          reportFailure('Bộ nhận diện khuôn mặt không phản hồi', new Error('Không nhận được kết quả từ webcam trong 10 giây.'));
          return;
        }
        if (document.visibilityState !== 'hidden' && !faceProcessing && faceVideo
          && faceVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          faceProcessing = true;
          try {
            await faceMesh?.send({ image: faceVideo });
          } catch (error) {
            faceProcessingFailed = true;
            reportFailure('Không thể phân tích khung hình webcam trên thiết bị', error);
          } finally {
            faceProcessing = false;
          }
        }
        faceLoopTimer = window.setTimeout(() => { void processFaceFrame(); }, 200);
      };
      void processFaceFrame();
    }

    if (monitorSpeech) {
      audioTrack = stream.getAudioTracks().find((track) => track.readyState === 'live') ?? null;
      if (!audioTrack) throw new Error('Không có luồng micro đang hoạt động để phát hiện giọng nói.');
      audioTrack.addEventListener('ended', handleAudioTrackEnded);
      if (!window.AudioContext) throw new Error('Trình duyệt không hỗ trợ xử lý âm thanh trên thiết bị.');

      const { default: createVAD, VADEvent, VADMode } = await import('@ozymandiasthegreat/vad');
      if (!active) return stop;
      const VAD = await createVAD();
      if (!active) return stop;
      vad = new VAD(VADMode.AGGRESSIVE, 16_000);
      audioContext = new AudioContext();
      audioSource = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
      audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      silentOutput = audioContext.createGain();
      silentOutput.gain.value = 0;
      audioSource.connect(audioProcessor);
      audioProcessor.connect(silentOutput);
      silentOutput.connect(audioContext.destination);
      audioProcessor.onaudioprocess = (event) => {
        if (!active || vadFailed || !vad || !audioContext) return;
        audioFramesReceived = true;
        const samples = resampleTo16kHz(event.inputBuffer.getChannelData(0), audioContext.sampleRate);
        for (const sample of samples) speechSamples.push(sample);
        while (speechSamples.length >= 480) {
          const frame = Float32Array.from(speechSamples.splice(0, 480));
          const result = vad.processFrame(VAD.floatTo16BitPCM(frame));
          const now = Date.now();
          if (result === VADEvent.ERROR) {
            vadFailed = true;
            reportFailure('Bộ phát hiện giọng nói trả về lỗi', new Error('WebRTC VAD không xử lý được khung âm thanh.'));
            speechStartedAt = null;
            speechLastVoiceAt = null;
            speechEventSent = false;
            return;
          }
          if (result === VADEvent.VOICE) {
            speechStartedAt ??= now;
            speechLastVoiceAt = now;
            const durationSeconds = (now - speechStartedAt) / 1000;
            if (durationSeconds >= 1.5 && !speechEventSent) {
              speechEventSent = true;
              sendEvent('speech_activity', speechStartedAt, durationSeconds);
            }
          } else if (speechLastVoiceAt === null || now - speechLastVoiceAt > 300) {
            speechStartedAt = null;
            speechLastVoiceAt = null;
            speechEventSent = false;
          }
        }
      };
      await audioContext.resume();
      if (audioContext.state !== 'running') {
        throw new Error('Trình duyệt đang tạm dừng xử lý âm thanh. Hãy bật lại micro trong cửa sổ bài thi.');
      }
      audioWatchdogTimer = window.setTimeout(() => {
        if (!active || audioFramesReceived) return;
        vadFailed = true;
        reportFailure('Không nhận được dữ liệu micro', new Error('Trình duyệt không chuyển âm thanh vào bộ phát hiện.'));
      }, 5_000);
    }
    if (active) onReady();
  } catch (error) {
    stop();
    throw error;
  }

  return stop;
}
