"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Timeline from './components/Timeline';

const FONTS = [
  { id: 'NotoSansTight', label: 'Noto Tight', file: '/NotoSansTight.ttf' },
  { id: 'Heebo',         label: 'Heebo',      file: '/Heebo.ttf'         },
] as const;

// Canvas preview renders at this fraction of the source resolution —
// cheaper on mobile, looks identical since the canvas is CSS-scaled anyway.
const PREVIEW_SCALE = 0.5;

type FontId = typeof FONTS[number]['id'];

const formatTime = (time: number) => {
  if (isNaN(time)) return "00:00";
  const m = Math.floor(time / 60).toString().padStart(2, '0');
  const s = Math.floor(time % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function Home() {
  const [authStatus, setAuthStatus] = useState<'checking' | 'ok' | 'no_access'>('checking');
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
  const [canUndo, setCanUndo] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); 
  const [duration, setDuration] = useState(0); 
  const [subtitlePos, setSubtitlePos] = useState(30);
  const [fontScale, setFontScale] = useState(1);
  const [globalOffset, setGlobalOffset] = useState(0); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [fontFamily, setFontFamily] = useState<FontId>('NotoSansTight');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const subtitleRef = useRef<HTMLSpanElement>(null);
  const ffmpegRef = useRef<any>(null);
  const requestRef = useRef<number>(null);
  const lastWordRef = useRef<string>("");
  const videoObjRef = useRef<HTMLVideoElement | null>(null);
  // Refs so syncAndDraw always reads live values without closing over stale state
  const subtitlePosRef = useRef(30);
  const fontFamilyRef  = useRef<FontId>('NotoSansTight');
  // Tracks current time for both the seek bar and the Timeline (iOS: audio.currentTime lags when paused)
  const currentTimeRef = useRef(0);
  // Undo history — stores snapshots of transcription before each destructive op
  const historyRef = useRef<any[][]>([]);
  // Holds the latest syncAndDraw so the RAF loop never runs a stale closure
  const syncAndDrawRef = useRef<() => void>(() => {});
  // Ref to latest togglePlay so spacebar listener never captures a stale closure
  const togglePlayRef = useRef<() => Promise<void>>(async () => {});

  // Stable callbacks for Timeline — empty deps means same reference every render,
  // so Timeline's RAF effect never restarts and the playhead loop runs without interruption
  const getTimeCallback = useCallback(() => currentTimeRef.current, []);
  const isPlayingCallback = useCallback(() => !!(audioRef.current && !audioRef.current.paused), []);

  // snapshot is the transcription array to save BEFORE a change happens
  function pushHistory(snapshot: any[]) {
    historyRef.current = [...historyRef.current.slice(-29), [...snapshot]];
    setCanUndo(true);
  }

  const handleUndo = useCallback(() => {
    const h = historyRef.current;
    if (h.length === 0) return;
    const prev = h[h.length - 1];
    historyRef.current = h.slice(0, -1);
    setTranscription(prev);
    setCanUndo(h.length > 1);
  }, []);

  const syncAndDraw = () => {
    const video = videoObjRef.current;
    const audio = audioRef.current;
    const canvas = canvasRef.current;

    if (video && audio && canvas) {
      const ctx = canvas.getContext('2d');

      // Always draw the current video frame (handles both playback and seek-while-paused)
      if (ctx && video.videoWidth > 0) {
        const targetW = Math.round(video.videoWidth * PREVIEW_SCALE);
        if (canvas.width !== targetW) {
          canvas.width = targetW;
          canvas.height = Math.round(video.videoHeight * PREVIEW_SCALE);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      // Keep video clock in sync with audio clock during playback
      if (!video.paused && !video.ended && Math.abs(video.currentTime - audio.currentTime) > 0.2) {
        video.currentTime = audio.currentTime;
      }

      if (!audio.paused && !audio.ended) {
        currentTimeRef.current = audio.currentTime;
        setCurrentTime(audio.currentTime);
      }

      // Draw subtitle directly on canvas — same font + size formula as FFmpeg export
      if (ctx && canvas.width > 0 && transcription.length > 0) {
        const time = currentTimeRef.current + globalOffset;
        const wordObj = transcription.find(w => time >= w.start && time <= w.end);
        if (wordObj) {
          const index = transcription.findIndex(w => w.start === wordObj.start);
          const baseSize = [28, 42, 58][index % 3] * fontScale;
          const fontSize = Math.round(baseSize * (canvas.height / 500));
          const x = canvas.width / 2;
          const y = canvas.height - (canvas.height * subtitlePosRef.current / 100);
          const borderW = Math.max(2, Math.round(2.4 * (canvas.height / 500)));

          ctx.save();
          ctx.font = `900 ${fontSize}px "${fontFamilyRef.current}", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          // Outline first (no shadow on stroke)
          ctx.shadowColor = 'transparent';
          ctx.lineWidth = borderW;
          ctx.lineJoin = 'round';
          ctx.strokeStyle = 'rgba(0,0,0,0.9)';
          ctx.strokeText(wordObj.word, x, y);

          // Fill with drop shadow
          ctx.shadowColor = 'rgba(0,0,0,0.95)';
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = Math.round(2 * (canvas.height / 500));
          ctx.shadowBlur = 4;
          ctx.fillStyle = '#ECE9E4';
          ctx.fillText(wordObj.word, x, y);
          ctx.restore();

          // Keep span sized but invisible — used only as the drag hit-target
          if (subtitleRef.current && lastWordRef.current !== wordObj.word + wordObj.start) {
            subtitleRef.current.style.display = 'inline-block';
            subtitleRef.current.style.fontSize = `${[28, 42, 58][index % 3] * fontScale}px`;
            lastWordRef.current = wordObj.word + wordObj.start;
          }
        } else {
          if (subtitleRef.current) subtitleRef.current.style.display = 'none';
          lastWordRef.current = '';
        }
      }
    }
  };

  // Keep ref pointed at the latest syncAndDraw every render so the RAF never uses a stale closure
  useEffect(() => { syncAndDrawRef.current = syncAndDraw; });

  // RAF loop — starts once on mount, calls the latest syncAndDraw each frame
  useEffect(() => {
    function loop() {
      syncAndDrawRef.current();
      requestRef.current = requestAnimationFrame(loop);
    }
    requestRef.current = requestAnimationFrame(loop);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, []);

  useEffect(() => { subtitlePosRef.current = subtitlePos; }, [subtitlePos]);
  useEffect(() => { fontFamilyRef.current = fontFamily; }, [fontFamily]);

  // Pre-load all fonts into the browser registry so canvas uses them immediately
  useEffect(() => {
    FONTS.forEach(({ id, file }) => {
      const font = new FontFace(id, `url(${file})`);
      font.load().then(f => document.fonts.add(f)).catch(() => {});
    });
  }, []);

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
           canvasRef.current.width = Math.round(video.videoWidth * PREVIEW_SCALE);
           canvasRef.current.height = Math.round(video.videoHeight * PREVIEW_SCALE);
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

  // Keep togglePlayRef current so the spacebar listener is never stale
  useEffect(() => { togglePlayRef.current = togglePlay; });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (e.key !== ' ') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      e.preventDefault();
      togglePlayRef.current();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleUndo]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    currentTimeRef.current = newTime;
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
    if (document.cookie.split(';').some(c => c.trim() === 'devee_auth=1')) {
      setAuthStatus('ok');
    } else {
      setAuthStatus('no_access');
    }
  }, []);

  useEffect(() => {
    if (document.cookie.includes('session_access')) {
      setAuthorized(true);
      loadFFmpeg();
    }
  }, []);

  const handleDub = async () => {
    if (!file) return;
    historyRef.current = [];
    setCanUndo(false);
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
      // 500 is the reference height — matches the canvas drawing formula exactly
      const scaleRatio = videoH / 500;

      await ffmpeg.writeFile(inputPath, await fetchFile(file));

      try {
        const selectedFont = FONTS.find(f => f.id === fontFamily) ?? FONTS[0];
        const fontUrl = `${window.location.origin}${selectedFont.file}?v=${Date.now()}`;
        const fontRes = await fetch(fontUrl);
        if (!fontRes.ok) throw new Error("Font fetch failed");
        const fontBuffer = await fontRes.arrayBuffer();
        await ffmpeg.writeFile('myfont.ttf', new Uint8Array(fontBuffer));
      } catch (e) {
        console.error("Font loading error:", e);
        alert("הפונט לא נמצא בשרת");
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
          let endT = Math.max(0, Number((item.end + currentOffset).toFixed(3)));
          
          const nextItem = transcription[index + 1];
          if (nextItem) {
              const nextStartT = Math.max(0, Number((nextItem.start + currentOffset).toFixed(3)));
              if (endT > nextStartT) {
                  endT = Math.max(startT + 0.05, nextStartT - 0.01); 
              }
          }
          
          const yPos = `h-(h*${subtitlePos}/100)-text_h`;
          const borderW = Math.max(1.5, 1.2 * scaleRatio);

          return `drawtext=fontfile='myfont.ttf':text='${safeWord}':enable='between(t,${startT},${endT})':x=(w-text_w)/2:y=${yPos}:fontsize=${fontSize}:fontcolor=0xECE9E4:bordercolor=black@0.9:borderw=2:shadowx=0:shadowy=2:shadowcolor=black@0.95:box=1:boxcolor=black@0.18:boxborderw=14`;
        });
        filterChain += `,${subtitleFilters.join(',')}`;
      }

      const result = await ffmpeg.exec([
        '-i', inputPath,
        '-vf', filterChain,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-c:a', 'copy',
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
    <footer className="w-full py-8 flex flex-col items-center space-y-4 mt-auto z-10">
      <p className="text-[10px] tracking-[0.2em] font-medium text-white/60">Powered By deVee Boutique Label</p>
      <div className="w-12 h-12 rounded-full overflow-hidden">
         <Image src="/label_logo.jpg" alt="deVee Label" width={48} height={48} className="object-cover" />
      </div>
    </footer>
  );

  if (authStatus === 'checking') {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#050505', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#fff', fontSize: '1.125rem', fontFamily: 'sans-serif' }}>Verifying Access...</p>
      </div>
    );
  }

  if (authStatus === 'no_access') {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#050505', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '2rem' }}>🔒</p>
        <p style={{ color: '#fff', fontSize: '1.1rem', fontFamily: 'sans-serif', fontWeight: 600, lineHeight: 1.5, maxWidth: 340 }}>
          This is a Premium Tool.<br />Sign in with Google at deVee Music to get access.
        </p>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem', fontFamily: 'sans-serif', lineHeight: 1.6, maxWidth: 320 }}>
          זהו כלי פרימיום.<br />התחבר עם חשבון Google שלך באתר deVee Music כדי לקבל גישה.
        </p>
        <a href="https://devee-music.com" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', fontFamily: 'sans-serif', textDecoration: 'none', letterSpacing: '0.05em' }}>
          ← Back to deVee Music
        </a>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#050505] text-white flex flex-col items-center">
  <header className="w-full text-center space-y-2 pt-8 pb-6 relative z-10">
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-56 h-20 bg-[#A855F7] blur-[55px] opacity-[0.25] pointer-events-none" />
          <Image src="/logo.png" alt="deVee" width={100} height={32} className="mx-auto relative" />
          <p className="text-[9px] tracking-[0.3em] text-white/70 font-bold uppercase">REELS DUBBER</p>
        </header>
        <main className="flex-1 flex flex-col justify-center w-full max-w-[340px] px-4">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2">
              <div className="h-px w-8 bg-[#A855F7]/30" />
              <span className="text-[#A855F7] text-[9px] tracking-[0.35em] uppercase font-semibold">AI Vocal Dubbing</span>
              <div className="h-px w-8 bg-[#A855F7]/30" />
            </div>
            <p dir="rtl" className="text-white text-[11px] tracking-[0.05em] font-light">דיבוב אוטומטי לסרטוני ריילס</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4 bg-[#0c0c0c]/40 p-8 rounded-[24px] border border-white/5 backdrop-blur-xl w-full">
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3 px-4 text-white text-center tracking-[0.4em] text-[9px] focus:outline-none placeholder:text-[9px]" 
              placeholder="ACCESS KEY" 
            />
            <button type="submit" className="w-full py-3 bg-[#A855F7] text-white rounded-xl uppercase tracking-[0.3em] text-[8px] font-black">Enter</button>
          </form>
        </main>
        <LabelFooter />
      </div>
    );
  }

  return (
  <div className="min-h-[100dvh] w-full bg-[#050505] text-white flex flex-col items-center">
  <header className="w-full text-center space-y-2 pt-8 pb-6 relative z-10">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-56 h-20 bg-[#A855F7] blur-[55px] opacity-[0.25] pointer-events-none" />
        <Image src="/logo.png" alt="deVee" width={80} height={26} className="opacity-80 mx-auto relative" />
        <p className="text-[9px] tracking-[0.3em] text-white/70 font-bold uppercase">REELS DUBBER</p>
      </header>

      <main className="w-full max-w-2xl mx-auto flex flex-col items-center flex-1 px-4 md:px-6 space-y-3 md:space-y-5 py-4 md:py-6">
        <div className="w-full space-y-3 md:space-y-5">
          <div className="relative w-full h-[48vh] md:h-auto md:aspect-video bg-[#0c0c0c] border border-white/[0.03] rounded-[24px] md:rounded-[32px] overflow-hidden shadow-2xl flex items-center justify-center">
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
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-2xl">
                      <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-white border-b-[10px] border-b-transparent ml-2" />
                    </div>
                  </div>
                )}

                <div 
                  className="absolute left-0 right-0 flex justify-center px-6 text-center select-none z-30 cursor-ns-resize active:cursor-grabbing" 
                  style={{ bottom: `${subtitlePos}%` }} 
                  onMouseDown={(e) => { e.stopPropagation(); startDragging(e); }} 
                  onTouchStart={(e) => { e.stopPropagation(); startDragging(e); }}
                >
                  {/* Text is invisible — canvas draws it. Span stays for drag-target sizing. */}
                  <span ref={subtitleRef} className="font-black uppercase tracking-tighter pointer-events-none" style={{ fontFamily: 'NotoSansTight, sans-serif', color: 'transparent', display: 'none' }} />
                </div>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()} className="h-48 md:h-64 w-full flex flex-col items-center justify-center cursor-pointer space-y-4">
                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mx-auto text-white/20 text-xl">+</div>
                <p className="text-[8px] uppercase tracking-[0.4em] text-white/20 font-bold">Upload Media</p>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="video/*" />
              </div>
            )}
          </div>

          {videoPreview && (
            <div className="flex items-center gap-3 bg-[#0c0c0c] border border-white/[0.03] rounded-2xl px-4 py-3 shadow-inner">
              <button onClick={togglePlay} className="w-9 h-9 shrink-0 rounded-full bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center active:scale-95">
                {isPlaying ? (
                  <div className="flex gap-1">
                    <div className="w-1 h-3 bg-[#A855F7] rounded-full"></div>
                    <div className="w-1 h-3 bg-[#A855F7] rounded-full"></div>
                  </div>
                ) : (
                  <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-[#A855F7] border-b-[6px] border-b-transparent ml-1"></div>
                )}
              </button>
              <input type="range" min="0" max={duration || 100} step="0.01" value={currentTime} onChange={handleSeek} className="flex-1 h-2 bg-white/5 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-[#A855F7] [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
              <div className="shrink-0 flex gap-1 text-[9px] font-mono text-white/40">
                <span className="text-white/80">{formatTime(currentTime)}</span>
                <span>/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Compact Position / Font strip */}
          <div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 rounded-2xl px-4 py-3">
            <span className="text-[7px] uppercase tracking-[0.2em] text-white/30 font-bold shrink-0">Pos</span>
            <button onClick={() => setSubtitlePos(prev => Math.max(10, prev - 5))} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[10px] active:scale-90 transition-transform">▼</button>
            <span className="text-[8px] font-mono text-[#A855F7] w-7 text-center shrink-0">{Math.round(subtitlePos)}%</span>
            <button onClick={() => setSubtitlePos(prev => Math.min(90, prev + 5))} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[10px] active:scale-90 transition-transform">▲</button>
            <div className="w-px h-3.5 bg-white/10 shrink-0 mx-1" />
            <div className="flex gap-1.5 flex-1 justify-end">
              {FONTS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFontFamily(f.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wide transition-all whitespace-nowrap ${fontFamily === f.id ? 'bg-[#A855F7] text-white' : 'bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {transcription.length > 0 && duration > 0 ? (
            <div>
              <div className="flex justify-end mb-1.5">
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95 ${canUndo ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'text-white/15 cursor-default'}`}
                >
                  ↩ Undo
                </button>
              </div>
              <Timeline
                chunks={[{
                  start: transcription[0].start,
                  end: transcription[transcription.length - 1].end,
                  words: transcription.map(item => ({ word: item.word, start: item.start, end: item.end })),
                }]}
                duration={duration}
                getCurrentTime={getTimeCallback}
                isPlaying={isPlayingCallback}
                onDragStart={() => pushHistory(transcription)}
                onWordTimingChange={(_chunkIndex, wordIndex, patch) => {
                  setTranscription(prev => prev.map((item, i) =>
                    i === wordIndex ? { ...item, ...patch } : item
                  ));
                }}
                onWordTextChange={(_chunkIndex, wordIndex, text) => {
                  pushHistory(transcription);
                  setTranscription(prev => prev.map((item, i) =>
                    i === wordIndex ? { ...item, word: text } : item
                  ));
                }}
                onWordDelete={(_chunkIndex, wordIndex) => {
                  pushHistory(transcription);
                  setTranscription(prev => prev.filter((_, i) => i !== wordIndex));
                }}
                onSeek={(t) => {
                  setCurrentTime(t);
                  currentTimeRef.current = t;
                  if (audioRef.current) audioRef.current.currentTime = t;
                  if (videoObjRef.current) videoObjRef.current.currentTime = t;
                }}
              />
            </div>
          ) : (
            <div className="h-16 bg-[#0c0c0c] border border-white/[0.03] rounded-2xl flex items-center justify-center">
              <div className="text-[8px] uppercase tracking-[0.3em] text-white/10 font-bold">Waiting for Dub...</div>
            </div>
          )}

          <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-2xl px-4 py-3">
            <span className="text-[7px] uppercase tracking-[0.3em] text-white/30 font-bold shrink-0">Size</span>
            <input type="range" min="0.5" max="1.5" step="0.01" value={fontScale} onChange={(e) => setFontScale(parseFloat(e.target.value))} className="flex-1 accent-[#A855F7]" />
          </div>

          <div className="flex flex-col gap-3 md:gap-4 pb-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={handleDub} 
                disabled={!file || isDubbing} 
                className={`flex-[3] py-4 rounded-full uppercase tracking-[0.4em] text-[9px] font-black transition-all ${file && !isDubbing ? 'bg-[#A855F7] shadow-[0_0_30px_rgba(168,85,247,0.3)]' : 'bg-white/5 text-white/20'}`}
              >
                {isDubbing ? 'Syncing...' : '1. DUB!'}
              </button>
              
              {file && transcription.length === 0 && !isDubbing && (
                <button 
                  onClick={() => exportVideo(false)} 
                  disabled={isExporting} 
                  className="flex-1 py-4 border border-white/10 rounded-full uppercase tracking-[0.4em] text-[8px] font-bold text-white/40 hover:bg-white/5 transition-all text-center"
                >
                  Test
                </button>
              )}
            </div>

            {transcription.length > 0 && (
              <button 
                onClick={() => exportVideo(true)} 
                disabled={isExporting} 
                className={`w-full py-5 rounded-full uppercase tracking-[0.5em] text-[10px] font-black transition-all ${!isExporting ? 'bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.2)] active:scale-95' : 'bg-white/5 text-white/20'}`}
              >
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