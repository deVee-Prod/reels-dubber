"use client";

import { useState, useEffect, useRef } from 'react';

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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ffmpegRef = useRef<any>(null);

  // טעינת FFmpeg
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
    loadFFmpeg();
  }, []);

  // הפונקציה שהייתה חסרה וגרמה לשגיאה!
  const handleDub = async () => {
    if (!file) return;
    setIsDubbing(true);

    try {
      // 1. חילוץ אודיו מהוידאו בעזרת FFmpeg
      const ffmpeg = ffmpegRef.current;
      const inputData = await file.arrayBuffer();
      await ffmpeg.writeFile('input.mp4', new Uint8Array(inputData));
      await ffmpeg.exec(['-i', 'input.mp4', '-vn', '-acodec', 'libmp3lame', '-ar', '16000', 'output.mp3']);
      const outputData = await ffmpeg.readFile('output.mp3');
      const audioBlob = new Blob([outputData], { type: 'audio/mp3' });

      // 2. שליחה ל-API שלנו (שעובד עם gemini-2.5-flash)
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.transcription) {
        setTranscription(data.transcription);
      }
    } catch (error) {
      console.error('Dubbing error:', error);
    } finally {
      setIsDubbing(false);
    }
  };

  const handleWordEdit = (index: number, newText: string) => {
    const updated = [...transcription];
    if (updated[0]?.words) {
      updated[0].words[index].word = newText;
      setTranscription(updated);
    }
  };

  const handleWordDelete = (index: number) => {
    const updated = [...transcription];
    if (updated[0]?.words) {
      updated[0].words.splice(index, 1);
      setTranscription(updated);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const getCurrentWord = () => {
    if (!transcription[0]?.words) return null;
    return transcription[0].words.find(
      (w: any) => currentTime >= w.start && currentTime <= w.end
    );
  };

  if (!authorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-8 text-center">
          <h1 className="text-[10px] tracking-[0.5em] text-white/20 uppercase font-black">Secure Access</h1>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="ENTER PASSCODE"
            className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-6 py-4 text-center text-sm tracking-widest focus:border-[#A855F7]/50 outline-none transition-all"
          />
          <button 
            onClick={() => {
              if (password === '1008') setAuthorized(true);
              else setLoginError(true);
            }}
            className="w-full bg-white text-black py-4 rounded-2xl text-[10px] font-black tracking-[0.3em] hover:bg-[#A855F7] hover:text-white transition-all"
          >
            VERIFY IDENTITY
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg space-y-10">
        <div className="relative aspect-[9/16] bg-white/[0.02] border border-white/5 rounded-[28px] overflow-hidden shadow-2xl">
          {videoPreview ? (
            <>
              <video 
                ref={videoRef}
                src={videoPreview} 
                className="w-full h-full object-cover"
                onTimeUpdate={handleTimeUpdate}
                controls
              />
              <div className="absolute bottom-[15%] left-0 right-0 flex justify-center pointer-events-none px-6">
                 {getCurrentWord() && (
                   <span className="text-white text-3xl font-black text-center drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]" style={{ fontFamily: 'Heebo, sans-serif' }}>
                     {getCurrentWord().word}
                   </span>
                 )}
              </div>
            </>
          ) : (
            <div onClick={() => fileInputRef.current?.click()} className="h-full w-full cursor-pointer flex flex-col items-center justify-center space-y-4">
              <span className="text-[8px] tracking-[0.3em] text-white/20 uppercase">Upload Video</span>
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              setVideoPreview(URL.createObjectURL(f));
            }
          }} accept="video/*" className="hidden" />
        </div>

        <div className="min-h-[100px] w-full bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-wrap gap-2">
          {transcription[0]?.words?.map((item: any, index: number) => (
            <div key={index} className={`relative group flex items-center bg-[#A855F7]/10 border border-[#A855F7]/20 px-3 py-1.5 rounded-lg ${currentTime >= item.start && currentTime <= item.end ? 'ring-1 ring-[#A855F7]' : ''}`}>
              <input 
                value={item.word}
                onChange={(e) => handleWordEdit(index, e.target.value)}
                className="bg-transparent border-none outline-none text-[10px] font-bold text-white w-auto text-center"
                style={{ width: `${item.word.length + 1}ch` }}
              />
              <button onClick={() => handleWordDelete(index)} className="ml-2 opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 text-[8px]">✕</button>
            </div>
          )) || <div className="text-[7px] uppercase tracking-widest text-white/10 w-full text-center py-6">Waiting for source...</div>}
        </div>

        <div className="flex flex-col items-center">
          <button 
            onClick={handleDub}
            disabled={!file || isDubbing || !ffmpegLoaded}
            className={`px-14 py-3.5 rounded-full uppercase tracking-[0.4em] text-[8px] font-black transition-all ${file && !isDubbing && ffmpegLoaded ? 'bg-[#A855F7] text-white' : 'bg-white/5 text-white/10'}`}
          >
            {isDubbing ? 'Syncing...' : 'DUB!'}
          </button>
        </div>
      </div>
    </main>
  );
}