"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

export default function Home() {
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  
  const [file, setFile] = useState<File | null>(null);
  const [isDubbing, setIsDubbing] = useState(false);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [transcription, setTranscription] = useState<any[]>([]); 
  const [currentTime, setCurrentTime] = useState(0); 
  const [subtitlePos, setSubtitlePos] = useState(25);
  const [fontScale, setFontScale] = useState(1);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null); 
  const ffmpegRef = useRef<any>(null);
  const requestRef = useRef<number>(null);

  // סנכרון 60FPS - קריטי למניעת דיליי
  const animate = () => {
    if (videoRef.current && !videoRef.current.paused) {
      setCurrentTime(videoRef.current.currentTime);
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const loadFFmpeg = async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');
    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    setFfmpegLoaded(true);
  };

  useEffect(() => {
    if (document.cookie.includes('session_access')) {
      setAuthorized(true);
      loadFFmpeg();
    }
  }, []);

  const handleDub = async () => {
    if (!file || !ffmpegLoaded || !ffmpegRef.current) return;
    setIsDubbing(true);
    const ffmpeg = ffmpegRef.current;
    const { fetchFile } = await import('@ffmpeg/util');

    try {
      await ffmpeg.writeFile('input_video', await fetchFile(file));
      await ffmpeg.exec(['-i', 'input_video', '-vn', '-ab', '128k', 'output_audio.mp3']);
      const data = await ffmpeg.readFile('output_audio.mp3');
      const audioBlob = new Blob([data as any], { type: 'audio/mp3' });
      const formData = new FormData();
      formData.append('audio', audioBlob);
      const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const result = await response.json();
      
      if (result.transcription) {
        const allWords = Array.isArray(result.transcription[0]?.words) 
          ? result.transcription[0].words 
          : result.transcription.flatMap((t: any) => t.words);
        setTranscription(allWords);
        setIsDubbing(false);
      } else {
        throw new Error(result.error || 'Transcription failed');
      }
    } catch (error: any) {
      setIsDubbing(false);
      alert(`Error: ${error.message}`);
    }
  };

  const handleWordEdit = (index: number, newText: string) => {
    const updated = [...transcription];
    updated[index].word = newText;
    setTranscription(updated);
  };

  const handleWordDelete = (index: number) => {
    const updated = transcription.filter((_, i) => i !== index);
    setTranscription(updated);
  };

  const getCurrentWord = () => {
    if (transcription.length === 0) return null;
    // ביטול אופסט לטובת זמן אמת מוחלט
    const time = currentTime; 
    return transcription.find(w => time >= w.start && time <= w.end);
  };

  const getDynamicFontSize = () => {
    if (!currentWord || transcription.length === 0) return 24 * fontScale;
    const index = transcription.findIndex(w => w.start === currentWord.start);
    const cycle = index % 3; 
    const sizes = [28, 42, 58]; 
    return sizes[cycle] * fontScale;
  };

  const startDragging = (e: React.MouseEvent) => {
    const startY = e.clientY;
    const startPos = subtitlePos;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = ((startY - moveEvent.clientY) / (videoRef.current?.clientHeight || 500)) * 100;
      setSubtitlePos(Math.min(90, Math.max(10, startPos + delta)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setVideoPreview(URL.createObjectURL(uploadedFile));
      setTranscription([]); 
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setAuthorized(true);
        loadFFmpeg();
      } else {
        setLoginError(true);
        setPassword('');
        setTimeout(() => setLoginError(false), 2000);
      }
    } catch (err) {
      console.error("Login error:", err);
    } finally {
      setLoginLoading(false);
    }
  };

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-[340px] space-y-8">
          <div className="text-center space-y-2">
            <Image src="/logo.png" alt="deVee" width={100} height={32} className="mx-auto" />
            <h2 className="text-[9px] tracking-[0.5em] uppercase text-[#A855F7]/80 font-bold italic">Private Access</h2>
          </div>
          <form onSubmit={handleLogin} className="space-y-4 bg-[#0c0c0c]/40 p-8 rounded-[24px] border border-white/5 backdrop-blur-xl">
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full bg-white/[0.02] border ${loginError ? 'border-red-500/30' : 'border-white/5'} rounded-xl py-3 px-4 text-white text-center tracking-[0.4em] text-[11px] focus:outline-none`}
              placeholder="ACCESS KEY"
            />
            <button type="submit" className="w-full py-3 bg-[#A855F7] text-white rounded-xl uppercase tracking-[0.3em] text-[8px] font-black">
              {loginLoading ? 'Verifying...' : 'Enter'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const currentWord = getCurrentWord();

  return (
    <main className="min-h-screen bg-[#050505] text-white flex flex-col items-center py-12 px-6">
      <header className="mb-16 text-center space-y-2">
        <Image src="/logo.png" alt="deVee" width={90} height={30} className="opacity-80" />
        <p className="text-[10px] tracking-[0.3em] text-white/40 font-bold uppercase">REELS DUBBER</p>
      </header>

      <div className="w-full max-w-2xl space-y-8">
        <div className="relative aspect-video bg-[#0c0c0c] border border-white/[0.03] rounded-[32px] overflow-hidden shadow-2xl flex items-center justify-center">
          {videoPreview ? (
            <div className="relative w-full h-full">
              <video 
                ref={videoRef}
                src={videoPreview} 
                controls 
                className="w-full h-full object-contain"
              />
              <div 
                className="absolute left-0 right-0 flex justify-center cursor-ns-resize active:cursor-grabbing px-6 text-center select-none"
                style={{ bottom: `${subtitlePos}%` }}
                onMouseDown={startDragging}
              >
                 {currentWord && (
                   <span 
                    key={`${currentWord.word}-${currentWord.start}`} 
                    className="text-white font-black drop-shadow-[0_4px_15px_rgba(0,0,0,1)] uppercase tracking-tighter animate-word-pop" 
                    style={{ 
                      fontFamily: 'Heebo, sans-serif', 
                      display: 'inline-block',
                      fontSize: `${getDynamicFontSize()}px`,
                      paintOrder: 'stroke fill',
                      WebkitTextStroke: '1px rgba(0,0,0,0.3)'
                    }}
                   >
                     {currentWord.word}
                   </span>
                 )}
              </div>
            </div>
          ) : (
            <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer text-center space-y-4">
              <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mx-auto text-white/20 text-xl">+</div>
              <p className="text-[8px] uppercase tracking-[0.4em] text-white/20 font-bold">Upload Media</p>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="video/*" />
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
          <span className="text-[7px] uppercase tracking-[0.3em] text-white/30 font-bold">Size</span>
          <input 
            type="range" 
            min="0.5" 
            max="1.5" 
            step="0.01" 
            value={fontScale} 
            onChange={(e) => setFontScale(parseFloat(e.target.value))}
            className="flex-1 accent-[#A855F7] h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
          />
          <span className="text-[7px] uppercase tracking-[0.3em] text-[#A855F7] font-bold">{(fontScale * 100).toFixed(0)}%</span>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between px-2 text-[7px] uppercase tracking-[0.3em] font-bold">
            <span className="text-white/20">Monitor</span>
            <span className="text-[#A855F7]">Timeline</span>
          </div>
          <div className="h-24 bg-[#0c0c0c] border border-white/[0.03] rounded-2xl p-4 flex gap-3 items-center overflow-x-auto no-scrollbar">
            {transcription.map((item, i) => (
              <div 
                key={i} 
                className={`h-full min-w-[110px] border rounded-xl flex flex-col items-center justify-center p-2 relative transition-all ${
                  currentTime >= item.start && currentTime <= item.end 
                  ? 'bg-[#A855F7]/30 border-[#A855F7]' 
                  : 'bg-white/[0.02] border-white/5'
                }`}
              >
                <input 
                  value={item.word}
                  onChange={(e) => handleWordEdit(i, e.target.value)}
                  className="bg-transparent border-none outline-none text-[11px] text-white font-bold text-center w-full"
                />
                <button onClick={() => handleWordDelete(i)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500/50 rounded-full text-[8px] flex items-center justify-center">✕</button>
                <span className="text-[7px] text-white/20 mt-1">{item.start.toFixed(1)}s</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center pt-4">
          <button 
            onClick={handleDub}
            disabled={!file || isDubbing || !ffmpegLoaded}
            className={`px-16 py-4 rounded-full uppercase tracking-[0.4em] text-[9px] font-black transition-all ${
              file && !isDubbing ? 'bg-[#A855F7] shadow-[0_0_40px_rgba(168,85,247,0.3)] hover:scale-105' : 'bg-white/5 text-white/20'
            }`}
          >
            {isDubbing ? 'Syncing...' : 'DUB!'}
          </button>
        </div>
      </div>
    </main>
  );
}