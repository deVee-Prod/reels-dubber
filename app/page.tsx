"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

const formatTime = (time: number) => {
  if (isNaN(time)) return "00:00";
  const m = Math.floor(time / 60).toString().padStart(2, '0');
  const s = Math.floor(time % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function Home() {
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  
  const [file, setFile] = useState<File | null>(null);
  const [isDubbing, setIsDubbing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0); 
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<any[]>([]); 
  const [currentTime, setCurrentTime] = useState(0); 
  const [duration, setDuration] = useState(0); 
  const [subtitlePos, setSubtitlePos] = useState(25);
  const [fontScale, setFontScale] = useState(1);
  const [globalOffset, setGlobalOffset] = useState(0); 
  const [isPlaying, setIsPlaying] = useState(false); 
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const subtitleRef = useRef<HTMLSpanElement>(null); 
  const ffmpegRef = useRef<any>(null);
  const requestRef = useRef<number>(null);
  const lastWordRef = useRef<string>("");
  const videoObjRef = useRef<HTMLVideoElement | null>(null);

  const syncAndDraw = () => {
    const video = videoObjRef.current;
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    
    if (video && audio && canvas) {
      if (!video.paused && !video.ended) {
         const ctx = canvas.getContext('2d');
         if (ctx && video.videoWidth > 0) {
           if (canvas.width !== video.videoWidth) {
             canvas.width = video.videoWidth;
             canvas.height = video.videoHeight;
           }
           ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
         }
         if (Math.abs(video.currentTime - audio.currentTime) > 0.2) {
            video.currentTime = audio.currentTime;
         }
      }
      if (!audio.paused && !audio.ended) {
        setCurrentTime(audio.currentTime);
      }
      if (subtitleRef.current && transcription.length > 0) {
        const time = audio.currentTime + globalOffset;
        const wordObj = transcription.find(w => time >= w.start && time <= w.end);
        if (wordObj) {
          if (lastWordRef.current !== wordObj.word + wordObj.start) {
            subtitleRef.current.innerText = wordObj.word;
            subtitleRef.current.style.display = "inline-block";
            const index = transcription.findIndex(w => w.start === wordObj.start);
            const sizes = [28, 42, 58];
            const dynamicSize = sizes[index % 3] * fontScale;
            subtitleRef.current.style.fontSize = `${dynamicSize}px`;
            lastWordRef.current = wordObj.word + wordObj.start;
          }
        } else {
          subtitleRef.current.style.display = "none";
          lastWordRef.current = "";
        }
      }
    }
    requestRef.current = requestAnimationFrame(syncAndDraw);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(syncAndDraw);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [transcription, fontScale, globalOffset]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      if (videoPreview) URL.revokeObjectURL(videoPreview);
      setFile(uploadedFile);
      const buffer = await uploadedFile.arrayBuffer();
      const blob = new Blob([buffer], { type: uploadedFile.type }); 
      const url = URL.createObjectURL(blob);
      setVideoPreview(url);
      setTranscription([]); 
      setIsPlaying(false);
      setCurrentTime(0);

      const video = document.createElement('video');
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      
      video.addEventListener('loadeddata', () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current && video.videoWidth > 0) {
           canvasRef.current.width = video.videoWidth;
           canvasRef.current.height = video.videoHeight;
           ctx.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      });
      video.load();
      videoObjRef.current = video;
    }
  };

  const togglePlay = async () => {
    const video = videoObjRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;
    if (audio.paused) {
      video.muted = true;
      try {
        await video.play();
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Playback failed", err);
      }
    } else {
      video.pause();
      audio.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoObjRef.current) videoObjRef.current.currentTime = newTime;
    if (audioRef.current) audioRef.current.currentTime = newTime;
  };

  const loadFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');
      const ffmpeg = new FFmpeg();
      
      ffmpeg.on('progress', ({ progress }) => {
        setExportProgress(Math.round(progress * 100));
      });
      
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      ffmpegRef.current = ffmpeg;
      return ffmpeg;
    } catch (err) {
      console.error("FFmpeg Load Error:", err);
      return null;
    }
  };

  useEffect(() => {
    if (document.cookie.includes('session_access')) {
      setAuthorized(true);
      loadFFmpeg(); 
    }
  }, []);

  const handleDub = async () => {
    if (!file) return;
    setIsDubbing(true);
    
    let ffmpeg = ffmpegRef.current;
    if (!ffmpeg) ffmpeg = await loadFFmpeg();
    if (!ffmpeg) { setIsDubbing(false); return; }

    const { fetchFile } = await import('@ffmpeg/util');
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    try {
      await ffmpeg.writeFile(`temp_input.${ext}`, await fetchFile(file));
      await ffmpeg.exec(['-i', `temp_input.${ext}`, '-vn', '-ab', '128k', 'output_audio.mp3']);
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
      }
    } catch (error: any) {
      alert(`Error in DUB: ${error.message}`);
    } finally {
      setIsDubbing(false);
    }
  };

  const exportVideo = async (withSubtitles: boolean) => {
    if (!file) return;
    setIsExporting(true);
    setExportProgress(0);
    
    let ffmpeg = ffmpegRef.current;
    if (!ffmpeg) ffmpeg = await loadFFmpeg();
    if (!ffmpeg) { setIsExporting(false); return; }

    const { fetchFile } = await import('@ffmpeg/util');

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      const inputPath = `input_${Date.now()}.${ext}`;
      const outputPath = `output_${Date.now()}.${ext}`;

      const videoH = videoObjRef.current?.videoHeight || 1920;
      const previewH = canvasRef.current?.clientHeight || 500;
      const scaleRatio = videoH / previewH;

      await ffmpeg.writeFile(inputPath, await fetchFile(file));

      try {
        const fontUrl = `${window.location.origin}/Heebo.ttf?v=${Date.now()}`;
        const fontRes = await fetch(fontUrl);
        if (!fontRes.ok) throw new Error("Font fetch failed");
        const fontBuffer = await fontRes.arrayBuffer();
        await ffmpeg.writeFile('myfont.ttf', new Uint8Array(fontBuffer));
      } catch (e) {
        console.error("Font loading error:", e);
        alert("הפונט לא נמצא בשרת.");
        setIsExporting(false);
        return;
      }

      let filterChain = `scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`;

      if (withSubtitles && transcription.length > 0) {
        const currentOffset = globalOffset;

        const subtitleFilters = transcription.map((item, index) => {
          const baseSize = [28, 42, 58][index % 3] * fontScale;
          const fontSize = Math.round(baseSize * scaleRatio); 
          
          let safeWord = item.word.replace(/'/g, "").replace(/:/g, "\\:").replace(/,/g, "\\,");
          
          const startT = Math.max(0, Number((item.start + currentOffset).toFixed(3)));
          const endT = Math.max(0, Number((item.end + currentOffset).toFixed(3)));
          
          const yPos = `h-(h*${subtitlePos}/100)-text_h`;

          // טקסט לבן נקי לחלוטין בלי שום אפקטים
          return `drawtext=fontfile='myfont.ttf':text='${safeWord}':enable='between(t,${startT},${endT})':x=(w-text_w)/2:y=${yPos}:fontsize=${fontSize}:fontcolor=white`;
        });
        filterChain += `,${subtitleFilters.join(',')}`;
      }

      const result = await ffmpeg.exec([
        '-i', inputPath,
        '-vf', filterChain,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '32', 
        '-c:a', 'aac',
        outputPath
      ]);

      if (result !== 0) throw new Error("Encoding failed");

      const data = await ffmpeg.readFile(outputPath);
      const videoBlob = new Blob([data as any], { type: ext === 'mov' ? 'video/quicktime' : 'video/mp4' });
      const downloadUrl = URL.createObjectURL(videoBlob);

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `deVee_Export_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      await ffmpeg.deleteFile(inputPath);
      await ffmpeg.deleteFile(outputPath);
      await ffmpeg.deleteFile('myfont.ttf');

    } catch (err: any) {
      console.error("Export failed:", err);
      alert("הייצוא נכשל: " + err.message);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
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
    } catch (err) { console.error(err); } finally { setLoginLoading(false); }
  };

  const startDragging = (e: any) => {
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const startY = clientY;
    const startPos = subtitlePos;
    const onMove = (moveEvent: any) => {
      const currentY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const delta = ((startY - currentY) / (canvasRef.current?.clientHeight || 500)) * 100;
      setSubtitlePos(Math.min(90, Math.max(10, startPos + delta)));
    };
    const onEnd = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  };

  const LabelFooter = () => (
    <footer className="w-full py-12 flex flex-col items-center space-y-4 opacity-40 mt-auto">
      <p className="text-[10px] tracking-[0.2em] font-medium text-white/60">Powered By deVee Boutique Label</p>
      <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 relative shadow-2xl">
         <Image src="/label_logo.jpg" alt="deVee Label" width={48} height={48} className="object-cover scale-110" />
      </div>
    </footer>
  );

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-center">
        <Image src="/logo.png" alt="deVee" width={100} height={32} className="mb-8" />
        <form onSubmit={handleLogin} className="space-y-4 bg-[#0c0c0c]/40 p-8 rounded-[24px] border border-white/5 backdrop-blur-xl w-full max-w-[340px]">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3 px-4 text-white text-center tracking-[0.4em] text-[11px] focus:outline-none" placeholder="ACCESS KEY" />
          <button type="submit" className="w-full py-3 bg-[#A855F7] text-white rounded-xl uppercase tracking-[0.3em] text-[8px] font-black">Enter</button>
        </form>
        <LabelFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center">
      <main className="flex-1 w-full max-w-2xl flex flex-col items-center py-12 px-6 space-y-8">
        <header className="text-center space-y-2">
          <Image src="/logo.png" alt="deVee" width={90} height={30} className="opacity-80 mx-auto" />
          <p className="text-[10px] tracking-[0.3em] text-white/40 font-bold uppercase">REELS DUBBER</p>
        </header>

        <div className="w-full space-y-8 pb-10">
          <div className="relative aspect-video bg-[#0c0c0c] border border-white/[0.03] rounded-[32px] overflow-hidden shadow-2xl flex items-center justify-center group">
            {videoPreview ? (
              <div className="relative w-full h-full cursor-pointer" onClick={togglePlay}>
                <audio ref={audioRef} src={videoPreview} preload="auto" className="hidden" playsInline onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} />
                <canvas ref={canvasRef} className="w-full h-full object-contain" />
                
                {isExporting && (
                  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
                    <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden mb-4">
                      <div className="h-full bg-[#A855F7] transition-all duration-300" style={{ width: `${exportProgress}%` }}></div>
                    </div>
                    <p className="text-[10px] font-black tracking-[0.5em] text-white uppercase animate-pulse">Burning {exportProgress}%</p>
                  </div>
                )}

                {!isPlaying && !isExporting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity">
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-2xl">
                      <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[22px] border-l-white border-b-[12px] border-b-transparent ml-2" />
                    </div>
                  </div>
                )}

                <div 
                  className="absolute left-0 right-0 flex justify-center px-6 text-center select-none z-30 cursor-ns-resize active:cursor-grabbing" 
                  style={{ bottom: `${subtitlePos}%` }} 
                  onMouseDown={(e) => { e.stopPropagation(); startDragging(e); }} 
                  onTouchStart={(e) => { e.stopPropagation(); startDragging(e); }}
                >
                  <span ref={subtitleRef} className="text-white font-black drop-shadow-[0_4px_15px_rgba(0,0,0,1)] uppercase tracking-tighter pointer-events-none" style={{ fontFamily: 'sans-serif', display: 'none' }} />
                </div>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()} className="h-full w-full flex flex-col items-center justify-center cursor-pointer space-y-4">
                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mx-auto text-white/20 text-xl">+</div>
                <p className="text-[8px] uppercase tracking-[0.4em] text-white/20 font-bold">Upload Media</p>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="video/*" />
              </div>
            )}
          </div>

          {videoPreview && (
             <div className="flex flex-col gap-4 bg-[#0c0c0c] border border-white/[0.03] rounded-2xl p-4 shadow-inner">
               <div className="flex items-center justify-between px-2">
                 <button onClick={togglePlay} className="w-12 h-12 rounded-full bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center hover:bg-[#A855F7]/20 transition-all active:scale-95">
                    {isPlaying ? (
                      <div className="flex gap-1.5">
                        <div className="w-1.5 h-4 bg-[#A855F7] rounded-full"></div>
                        <div className="w-1.5 h-4 bg-[#A855F7] rounded-full"></div>
                      </div>
                    ) : (
                      <div className="w-0 h-0 border-t-[7px] border-t-transparent border-l-[12px] border-l-[#A855F7] border-b-[7px] border-b-transparent ml-1"></div>
                    )}
                 </button>
                 <div className="flex gap-2 text-[10px] font-mono text-white/40 uppercase tracking-widest">
                    <span className="text-white bg-white/5 px-2 py-1 rounded-md">{formatTime(currentTime)}</span>
                    <span className="py-1">/</span>
                    <span className="py-1">{formatTime(duration)}</span>
                 </div>
               </div>
               <div className="px-2">
                 <input type="range" min="0" max={duration || 100} step="0.01" value={currentTime} onChange={handleSeek} className="w-full h-1.5 bg-white/5 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#A855F7] [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
               </div>
             </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
              <span className="text-[7px] uppercase tracking-[0.3em] text-white/30 font-bold">Size</span>
              <input type="range" min="0.5" max="1.5" step="0.01" value={fontScale} onChange={(e) => setFontScale(parseFloat(e.target.value))} className="flex-1 accent-[#A855F7]" />
            </div>
            <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-2xl p-4">
              <span className="text-[7px] uppercase tracking-[0.3em] text-white/30 font-bold">Sync</span>
              <div className="flex items-center space-x-3">
                <button onClick={() => setGlobalOffset(prev => prev - 0.05)} className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 transition-colors">-</button>
                <span className="text-[8px] font-mono text-[#A855F7]">{globalOffset.toFixed(2)}s</span>
                <button onClick={() => setGlobalOffset(prev => prev + 0.05)} className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 transition-colors">+</button>
              </div>
            </div>
          </div>

          <div className="h-24 bg-[#0c0c0c] border border-white/[0.03] rounded-2xl p-4 flex gap-3 items-center overflow-x-auto no-scrollbar">
            {transcription.length > 0 ? (
              transcription.map((item, i) => (
                <div key={i} className={`h-full min-w-[110px] border rounded-xl flex flex-col items-center justify-center p-2 relative transition-all ${currentTime >= item.start && currentTime <= item.end ? 'bg-[#A855F7]/30 border-[#A855F7]' : 'bg-white/[0.02] border-white/5'}`}>
                  <input value={item.word} onChange={(e) => {
                     const updated = [...transcription];
                     updated[i].word = e.target.value;
                     setTranscription(updated);
                  }} className="bg-transparent border-none outline-none text-[11px] text-white font-bold text-center w-full focus:text-[#A855F7]" />
                  <button onClick={() => { const updated = transcription.filter((_, idx) => idx !== i); setTranscription(updated); }} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500/50 rounded-full text-[8px] flex items-center justify-center hover:bg-red-500 transition-colors">✕</button>
                </div>
              ))
            ) : (
              <div className="w-full text-center text-[8px] uppercase tracking-[0.3em] text-white/10 font-bold">Waiting for Dub...</div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex justify-center gap-4">
              <button onClick={handleDub} disabled={!file || isDubbing} className={`flex-1 py-4 rounded-full uppercase tracking-[0.4em] text-[9px] font-black transition-all ${file && !isDubbing ? 'bg-[#A855F7] shadow-[0_0_30px_rgba(168,85,247,0.3)]' : 'bg-white/5 text-white/20'}`}>
                {isDubbing ? 'Syncing / Loading...' : '1. DUB!'}
              </button>
              
              {file && transcription.length === 0 && !isDubbing && (
                <button onClick={() => exportVideo(false)} disabled={isExporting} className="px-8 py-4 border border-white/10 rounded-full uppercase tracking-[0.4em] text-[8px] font-bold text-white/40 hover:bg-white/5 transition-all">
                  Test Export
                </button>
              )}
            </div>

            {transcription.length > 0 && (
              <button onClick={() => exportVideo(true)} disabled={isExporting} className={`w-full py-5 rounded-full uppercase tracking-[0.5em] text-[10px] font-black transition-all ${!isExporting ? 'bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-95' : 'bg-white/5 text-white/20'}`}>
                {isExporting ? `Burning ${exportProgress}%` : '2. DOWNLOAD FINAL'}
              </button>
            )}
          </div>
        </div>
      </main>
      <LabelFooter />
    </div>
  );
}