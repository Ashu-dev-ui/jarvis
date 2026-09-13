import { useState, useEffect, useRef } from 'react';

// Hardcoded locally to bypass .env lookup issues during development
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

  // Live microphone audio frequency analyzer for orb visualization
  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);

      analyser.fftSize = 64;
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        setAudioLevel(sum / dataArray.length / 255);
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.error('Audio analysis error:', err);
    }
  };

  const stopAudioAnalysis = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current) audioCtxRef.current.close();
    setAudioLevel(0);
  };

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
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

      recognition.onend = () => {
        setIsListening(false);
        stopAudioAnalysis();
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Send voice query to Gemini via REST API endpoint using the updated stable model ID
  const askGemini = async (userQuery: string) => {
    if (!userQuery) return;
    setAiResponse('PROCESSING QUERY VIA GEMINI...');

    if (!GEMINI_API_KEY) {
      const errText = 'API Key missing. Check configuration.';
      console.error('GEMINI_API_KEY is empty.');
      setAiResponse(errText);
      speak(errText);
      return;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
        console.error('Gemini API Error details:', data.error);
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
      console.error('Fetch Error:', error);
      const fallbackText = 'Connection error. Check browser network tab for details.';
      setAiResponse(fallbackText);
      speak(fallbackText);
    }
  };

  // Text-To-Speech Engine
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

  // Toggle listening via mic button
  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      stopAudioAnalysis();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        startAudioAnalysis();
        setIsListening(true);

        const introText = 'Hi, I am JARVIS. What would you like to ask?';
        setAiResponse(introText);
        setTranscript('');
        speak(introText);
      } catch (err) {
        console.error('Error starting speech recognition:', err);
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