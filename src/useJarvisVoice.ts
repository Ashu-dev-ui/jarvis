import { useState, useEffect, useRef } from 'react';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export function useJarvisVoice() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('SYSTEM ACTIVE — READY FOR COMMANDS');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const shouldListenRef = useRef(false);

  // Mobile-safe audio analysis (lighter footprint, avoids freezing iOS Safari)
  const startAudioAnalysis = async () => {
    try {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
        return;
      }
      if (audioCtxRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);

      analyser.fftSize = 32; // Lower FFT size reduces CPU load on mobile devices
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        setAudioLevel(sum / dataArray.length / 255);
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.warn('Audio analysis bypassed on restricted mobile context:', err);
    }
  };

  const stopAudioAnalysis = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.suspend();
    }
    setAudioLevel(0);
  };

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // Set to false for stable mobile phrase segmentation
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }

        setTranscript(currentTranscript);

        if (event.results[event.results.length - 1].isFinal) {
          askGemini(currentTranscript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition mobile notice:', event.error);
      };

      recognition.onend = () => {
        setIsListening(false);
        stopAudioAnalysis();

        // Auto-restart loop if user intended to stay active
        if (shouldListenRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // Handled safely if blocked by mobile constraints
          }
        }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const askGemini = async (userQuery: string) => {
    if (!userQuery) return;
    setAiResponse('PROCESSING COMMAND...');

    if (!GEMINI_API_KEY) {
      const errText = 'API Key missing. Check configuration.';
      setAiResponse(errText);
      speak(errText);
      return;
    }

    const lowerQuery = userQuery.toLowerCase();

    if (lowerQuery.includes('open mail') || lowerQuery.includes('open gmail')) {
      const reply = 'Opening your email client, Boss.';
      setAiResponse(reply);
      speak(reply);
      window.open('https://mail.google.com', '_blank');
      return;
    }

    if (lowerQuery.includes('play') && lowerQuery.includes('youtube')) {
      const queryToPlay = userQuery.replace(/play|on youtube/gi, '').trim();
      const reply = `Initiating playback for ${queryToPlay || 'your request'} on YouTube, Boss.`;
      setAiResponse(reply);
      speak(reply);
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(queryToPlay)}&autoplay=1`, '_blank');
      return;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `You are JARVIS, an advanced sci-fi AI assistant. Answer user queries concisely in 1-2 short sentences so speech synthesis sounds natural. User asked: "${userQuery}"`,
                  },
                ],
              },
            ],
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        const errText = `API Error: ${data.error.message}`;
        setAiResponse(errText);
        speak(errText);
        return;
      }

      const replyText =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        'I was unable to process that query, Boss.';

      setAiResponse(replyText);
      speak(replyText);
    } catch (error) {
      const fallbackText = 'Connection error. Check network connection.';
      setAiResponse(fallbackText);
      speak(fallbackText);
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      shouldListenRef.current = false;
      recognitionRef.current.stop();
      stopAudioAnalysis();
      setIsListening(false);
    } else {
      shouldListenRef.current = true;
      try {
        recognitionRef.current.start();
        startAudioAnalysis();
        setIsListening(true);

        const introText = 'Systems online.';
        setAiResponse(introText);
        setTranscript('');
        speak(introText);
      } catch (err) {
        console.error('Mobile speech recognition start error:', err);
      }
    }
  };

  return {
    isListening,
    transcript,
    aiResponse,
    isSpeaking,
    audioLevel,
    toggleListening,
  };
}