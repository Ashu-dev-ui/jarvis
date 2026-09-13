import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import ParticleSphere from './ParticleSphere';
import Bubbles from './Bubbles';
import { useJarvisVoice } from './useJarvisVoice';
import './App.css';

export default function App() {
  const [time, setTime] = useState(new Date());
  const [batteryLevel, setBatteryLevel] = useState<number | string>('100%');
  const [isCharging, setIsCharging] = useState(false);
  const [ramUsage, setRamUsage] = useState({ used: '0.0 GB', total: '16.0 GB', percentage: '0%' });
  
  const [weather, setWeather] = useState({ temp: '--°C', condition: 'SCANNING...' });
  const [cpuCores] = useState(navigator.hardwareConcurrency || 8);
  const [networkSpeed, setNetworkSpeed] = useState('Stable');

  const { isListening, isSpeaking, toggleListening } = useJarvisVoice();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const updateBattery = () => {
          setBatteryLevel(`${Math.round(battery.level * 100)}%`);
          setIsCharging(battery.charging);
        };
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
      });
    } else {
      setBatteryLevel('98%');
    }
  }, []);

  useEffect(() => {
    const updateMemory = () => {
      if ('deviceMemory' in navigator) {
        const totalGB = (navigator as any).deviceMemory || 16;
        const simulatedUsedGB = (totalGB * (0.35 + Math.sin(Date.now() / 3000) * 0.08)).toFixed(1);
        const usagePct = Math.round((parseFloat(simulatedUsedGB) / totalGB) * 100);

        setRamUsage({
          used: `${simulatedUsedGB} GB`,
          total: `${totalGB} GB`,
          percentage: `${usagePct}%`,
        });
      } else {
        setRamUsage({ used: '5.2 GB', total: '16.0 GB', percentage: '32%' });
      }
    };

    updateMemory();
    const interval = setInterval(updateMemory, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      setNetworkSpeed(`${conn.effectiveType ? conn.effectiveType.toUpperCase() : '4G'} (${conn.downlink || 10} Mbps)`);
    }
  }, []);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
            const data = await res.json();
            if (data && data.current_weather) {
              const tempC = Math.round(data.current_weather.temperature);
              const code = data.current_weather.weathercode;
              let cond = 'CLEAR';
              if (code > 0 && code < 4) cond = 'PARTLY CLOUDY';
              else if (code >= 50 && code < 70) cond = 'RAIN';
              else if (code >= 70) cond = 'SNOW';
              else if (code >= 95) cond = 'THUNDERSTORM';

              setWeather({ temp: `${tempC}°C`, condition: cond });
            }
          } catch (e) {
            setWeather({ temp: '24°C', condition: 'OPTIMAL' });
          }
        },
        () => {
          setWeather({ temp: '22°C', condition: 'ONLINE' });
        }
      );
    }
  }, []);

  return (
    <div className="jarvis-container">
      <Canvas camera={{ position: [0, 0, 6], fov: 50 }} gl={{ antialias: true }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        
        {/* Underwater Rising Bubbles */}
        <Bubbles />

        {/* Central Core Sphere */}
        <ParticleSphere />

        <EffectComposer enableNormalPass={false}>
          <Bloom luminanceThreshold={0.1} mipmapBlur luminanceSmoothing={0.9} intensity={1.8} />
        </EffectComposer>

        <Environment preset="night" />
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>

      {/* --- HUD OVERLAY --- */}
      <div className="hud-overlay">
        
        {/* Top-Left: Header */}
        <div className="hud-panel top-left">
          <div className="title">JARVIS AI</div>
          <div className="status-badge">
            <div className={`status-dot ${isListening ? 'active' : ''}`}></div>
            <span>{isListening ? 'ONLINE & LISTENING' : 'INTERFACE STANDBY'}</span>
          </div>
        </div>

        {/* Top-Right: Date, Time & Weather */}
        <div className="hud-panel top-right">
          <div className="hud-value time-text">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="hud-label">
            {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
          </div>
          <div className="hud-item" style={{ marginTop: '6px', textAlign: 'right' }}>
            <span className="hud-value" style={{ color: '#00f3ff' }}>{weather.temp} </span>
            <span className="hud-label">({weather.condition})</span>
          </div>
        </div>

        {/* Bottom Controls & Expanded Computer Telemetry */}
        <div className="hud-bottom-row">
          <div className="hud-panel bottom-left">
            <div className="hud-item">
              <span className="hud-label">BATTERY LEVEL</span>
              <span className="hud-value">{batteryLevel} {isCharging ? '⚡' : ''}</span>
            </div>
            <div className="hud-item">
              <span className="hud-label">MEMORY USAGE</span>
              <span className="hud-value">{ramUsage.used} / {ramUsage.total} ({ramUsage.percentage})</span>
            </div>
            <div className="hud-item">
              <span className="hud-label">CPU CORES</span>
              <span className="hud-value">{cpuCores} THREADS ACTIVE</span>
            </div>
            <div className="hud-item">
              <span className="hud-label">NETWORK LINK</span>
              <span className="hud-value">{networkSpeed}</span>
            </div>
          </div>

          {/* Voice Microphone Control Button */}
          <div className="mic-control-container">
            <button
              className={`mic-button ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}
              onClick={toggleListening}
            >
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
            <span className="mic-label">{isListening ? 'CLICK TO MUTE' : 'CLICK TO TALK'}</span>
          </div>

          <div className="hud-panel bottom-right">
            <div className="hud-label">VOICE ENGINE</div>
            <div className="hud-value">{isSpeaking ? '[ TRANSMITTING ]' : '[ READY ]'}</div>
          </div>
        </div>

      </div>
    </div>
  );
}