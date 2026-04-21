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
  const [currentTime, setCurrentTime] = useState(0); // עוקב אחרי זמן הנגן
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null); // רפרנס לנגן
  const ffmpegRef = useRef<any>(null);

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

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      console.log('--- Google Sync Report ---');
      console.log('Status:', response.status);
      console.log('Payload:', result);

      if (result.transcription) {
        // במידה וה-API מחזיר מבנה מקונן, אנחנו משטחים אותו למערך מילים אחד
        const allWords = Array.isArray(result.transcription[0]?.words) 
          ? result.transcription[0].words 
          : result.transcription.flatMap((t: any) => t.words);
        setTranscription(allWords);
        setIsDubbing(false);
      } else {
        throw new Error(result.error || 'Transcription failed');
      }

    } catch (error: any) {
      console.error('DUB Error:', error);
      setIsDubbing(false);
      alert(`Debug: ${error.message}`);
    }
  };

  // פונקציה לעדכון מילה בטיימליין
  const handleWordEdit = (index: number, newText: string) => {
    const updated = [...transcription];
    updated[index].word = newText;
    setTranscription(updated);
  };

  // פונקציה למחיקת מילה מהטיימליין
  const handleWordDelete = (index: number) => {
    const updated = transcription.filter((_, i) => i !== index);
    setTranscription(updated);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setVideoPreview(URL.createObjectURL(uploadedFile));
      setTranscription([]); 
    }
  };

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-between p-8">
        <div />
        <div className="w-full max-w-[340px] flex flex-col items-center space-y-10">
          <div className="flex flex-col items-center space-y-4">
            <Image src="/logo.png" alt="deVee" width={100} height={32} />
            <h2 className="text-[9px] tracking-[0.5em] uppercase text-[#A855F7]/80 font-bold italic">Private Studio Access</h2>
          </div>
          <div className="w-full bg-[#0c0c0c]/40 border border-white/[0.04] rounded-[24px] p-8 backdrop-blur-xl">
            <form onSubmit={handleLogin} className="flex flex-col space-y-4">
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-white/[0.02] border ${loginError ? 'border-red-500/30' : 'border-white/5'} rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#A855F7]/30 transition-all text-center tracking-[0.4em] text-[11px]`}
                placeholder="ACCESS KEY"
              />
              <button type="submit" className="w-full py-3 bg-[#A855F7] text-white rounded-xl uppercase tracking-[0.3em] text-[8px] font-black">
                {loginLoading ? 'Verifying...' : 'Enter Studio'}
              </button>
            </form>
          </div>
        </div>
        <footer className="flex flex-col items-center space-y-3 pb-4">
          <span className="text-[9px] tracking-[0.1em] text-white/40 font-light">Powered By deVee Boutique Label</span>
          <Image src="/label_logo.jpg" alt="deVee Label" width={32} height={32} className="rounded-full opacity-60" />
        </footer>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans flex flex-col items-center py-12 px-6">
      
      <header className="w-full max-w-2xl flex flex-col items-center mb-16 space-y-2">
        <Image src="/logo.png" alt="deVee" width={90} height={30} className="opacity-80" />
        <span className="text-[10px] tracking-[0.3em] text-white/40 font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          REELS DUBBER
        </span>
      </header>

      <div className="w-full max-w-2xl space-y-8">
        <div className="relative aspect-video bg-[#0c0c0c] border border-white/[0.03] rounded-[32px] overflow-hidden shadow-2xl flex items-center justify-center">
          {videoPreview ? (
            <video 
              ref={videoRef}
              src={videoPreview} 
              controls 
              className="w-full h-full object-contain"
              onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
            />
          ) : (
            <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center space-y-4 cursor-pointer group">
              <div className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-white/10 group-hover:text-[#A855F7] transition-colors text-lg">+</div>
              <p className="text-[8px] uppercase tracking-[0.4em] text-white/20 font-bold">Upload Media</p>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="video/*" />
            </div>
          )}
        </div>

        <div className="w-full space-y-3">
          <div className="flex justify-between items-center px-2">
            <span className="text-[7px] uppercase tracking-[0.3em] text-white/20 font-bold">Monitor</span>
            <span className="text-[7px] uppercase tracking-[0.3em] text-[#A855F7] font-black">Timeline</span>
          </div>
          <div className="h-20 bg-[#0c0c0c] border border-white/[0.03] rounded-2xl p-2 flex gap-2 items-center overflow-x-auto no-scrollbar">
            {transcription.length > 0 ? (
              transcription.map((item, i) => (
                <div 
                  key={i} 
                  className={`h-full min-w-[100px] border rounded-lg flex flex-col items-center justify-center p-2 relative transition-all duration-200 ${
                    currentTime >= item.start && currentTime <= item.end 
                    ? 'bg-[#A855F7]/30 border-[#A855F7]' 
                    : 'bg-[#A855F7]/5 border-[#A855F7]/10'
                  }`}
                >
                  <input 
                    value={item.word}
                    onChange={(e) => handleWordEdit(i, e.target.value)}
                    className="bg-transparent border-none outline-none text-[10px] text-white font-bold text-center w-full focus:text-[#A855F7]"
                  />
                  <button 
                    onClick={() => handleWordDelete(i)}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500/50 hover:bg-red-500 rounded-full text-[7px] flex items-center justify-center transition-colors"
                  >
                    ✕
                  </button>
                  <span className="text-[6px] text-white/20 absolute bottom-1">{item.start.toFixed(1)}s</span>
                </div>
              ))
            ) : (
              <div className="w-full text-center text-[7px] uppercase tracking-[0.4em] text-white/5">
                {isDubbing ? 'Generating Neural Timeline...' : 'Waiting for source...'}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center space-y-6 pt-4">
          <button 
            onClick={handleDub}
            disabled={!file || isDubbing || !ffmpegLoaded}
            className={`px-14 py-3.5 rounded-full uppercase tracking-[0.4em] text-[8px] font-black transition-all ${
              file && !isDubbing && ffmpegLoaded ? 'bg-[#A855F7] text-white shadow-[0_0_40px_rgba(168,85,247,0.25)] hover:scale-105' : 'bg-white/[0.02] text-white/10 border border-white/5'
            }`}
          >
            {!ffmpegLoaded ? 'Loading Engine...' : isDubbing ? 'Syncing...' : 'DUB!'}
          </button>
          
          <p className="text-[7px] tracking-[0.2em] text-white/10 uppercase italic text-center max-w-[200px]">
              Neural engine will process speech and sync timeline automatically
          </p>
        </div>
      </div>

      <footer className="mt-auto pt-20 pb-4 flex flex-col items-center space-y-3">
        <span className="text-[9px] tracking-[0.1em] text-white/40 font-light">Powered By deVee Boutique Label</span>
        <Image src="/label_logo.jpg" alt="deVee Label" width={32} height={32} className="rounded-full opacity-60 hover:opacity-100 transition-opacity cursor-pointer shadow-xl" />
      </footer>
    </main>
  );
}