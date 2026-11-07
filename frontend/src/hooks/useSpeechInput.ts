import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechResultEvent extends Event {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResult };
}

interface SpeechErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionSession extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionSession;

function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function speechErrorMessage(error: string) {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Không có quyền sử dụng micro hoặc dịch vụ nhận diện giọng nói. Hãy kiểm tra quyền trong trình duyệt.';
    case 'audio-capture':
      return 'Không tìm thấy micro. Hãy kiểm tra thiết bị và thử lại.';
    case 'network':
      return 'Không thể kết nối dịch vụ nhận diện giọng nói. Hãy kiểm tra kết nối mạng.';
    case 'no-speech':
      return 'Không nghe thấy giọng nói. Hãy thử lại.';
    case 'aborted':
      return 'Nhận diện giọng nói đã bị gián đoạn. Hãy thử lại.';
    default:
      return `Không thể nhận diện giọng nói (${error}). Hãy thử lại.`;
  }
}

export function useSpeechInput(onTranscript: (text: string) => void) {
  const sessionRef = useRef<SpeechRecognitionSession | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const [listening, setListening] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');

  const cancel = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      session.onresult = null;
      session.onerror = null;
      session.onend = null;
      session.abort();
    }
    setListening(false);
    setStopping(false);
    setInterim('');
    setError('');
  }, []);

  useEffect(() => () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      session.onresult = null;
      session.onerror = null;
      session.onend = null;
      session.abort();
    }
  }, []);

  const toggle = () => {
    if (sessionRef.current) {
      if (!stopping) {
        setStopping(true);
        sessionRef.current.stop();
      }
      return;
    }
    setError('');
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setError('Trình duyệt này không hỗ trợ nhập giọng nói. Hãy nhập bằng bàn phím hoặc thử trình duyệt khác.');
      return;
    }
    if (!window.isSecureContext) {
      setError('Nhập giọng nói cần kết nối HTTPS hoặc localhost.');
      return;
    }

    const session = new SpeechRecognition();
    session.lang = 'vi-VN';
    session.continuous = true;
    session.interimResults = true;
    session.onresult = (event) => {
      if (sessionRef.current !== session) return;
      let finalText = '';
      let interimText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (finalText.trim()) onTranscriptRef.current(finalText.trim());
      setInterim(interimText.trim());
    };
    session.onerror = (event) => {
      if (sessionRef.current === session) setError(speechErrorMessage(event.error));
    };
    session.onend = () => {
      if (sessionRef.current !== session) return;
      sessionRef.current = null;
      setListening(false);
      setStopping(false);
      setInterim('');
    };
    sessionRef.current = session;
    setListening(true);
    try {
      session.start();
    } catch (startError) {
      sessionRef.current = null;
      setListening(false);
      setError(`Không thể bật nhận diện giọng nói: ${startError instanceof Error ? startError.message : 'Lỗi trình duyệt.'}`);
    }
  };

  return { listening, stopping, interim, error, toggle, cancel };
}
