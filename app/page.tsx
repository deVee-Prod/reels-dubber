"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

export default function Home() {
  // ... (כל ה-States הקודמים שלך נשארים)
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  
  const [file, setFile] = useState<File | null>(null);
  const [isDubbing, setIsDubbing] = useState(false);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [transcription, setTranscription] = useState<any[]>([]); 
  const [currentTime, setCurrentTime] = useState(0); // מעקב אחרי זמן הוידאו
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ffmpegRef = useRef<any>(null);

  // פונקציה לעדכון מילה קיימת
  const handleWordEdit = (index: number, newText: string) => {
    const updated = [...transcription];
    updated[0].words[index].word = newText;
    setTranscription(updated);
  };

  // פונקציה למחיקת מילה
  const handleWordDelete = (index: number) => {
    const updated = [...transcription];
    updated[0].words.splice(index, 1);
    setTranscription(updated);
  };

  // לוגיקת קפיצה מעל מילים שנמחקו (אופציונלי - אם רוצים שהנגן ידלג)
  useEffect(() => {
    if (videoRef.current && transcription.length > 0) {
      // כאן אפשר להוסיף לוגיקה שבודקת אם יש "חור" בזמנים וקופצת
    }
  }, [currentTime]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // מוצא את המילה הנוכחית להצגה ככתובית
  const getCurrentWord = () => {
    if (!transcription[0]?.words) return null;
    return transcription[0].words.find(
      (w: any) => currentTime >= w.start && currentTime <= w.end
    );
  };

  // ... (פונקציות ה-LoadFFmpeg וה-handleDub המקוריות שלך נשארות אותו דבר)

  return (
    <main className="min-h-screen bg-black text-white font-[family-name:var(--font-geist-sans)] flex flex-col items-center px-4 py-10 selection:bg-[#A855F7]/30">
      {/* ... (חלק הלוגין נשאר זהה) */}
      
      <div className="w-full max-w-lg space-y-10 animate-in fade-in duration-1000">
        {/* אזור הוידאו עם הכתוביות */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#A855F7]/20 to-[#6366F1]/20 rounded-[32px] blur-2xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
          <div className="relative aspect-[9/16] bg-white/[0.02] border border-white/5 rounded-[28px] overflow-hidden flex items-center justify-center shadow-2xl">
            {videoPreview ? (
              <>
                <video 
                  ref={videoRef}
                  src={videoPreview} 
                  className="w-full h-full object-cover"
                  onTimeUpdate={handleTimeUpdate}
                  controls
                />
                {/* שכבת כתוביות Heebo */}
                <div className="absolute bottom-[15%] left-0 right-0 flex justify-center pointer-events-none px-6">
                   {getCurrentWord() && (
                     <span className="text-white text-3xl font-black text-center drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] tracking-tight uppercase" style={{ fontFamily: 'Heebo, sans-serif' }}>
                       {getCurrentWord().word}
                     </span>
                   )}
                </div>
              </>
            ) : (
              <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer group/upload flex flex-col items-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover/upload:bg-[#A855F7]/10 transition-colors">
                  <svg className="w-5 h-5 text-white/20 group-hover/upload:text-[#A855F7]/50 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-[8px] tracking-[0.3em] text-white/20 uppercase font-medium">Initialize Source</span>
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
        </div>

        {/* טיימליין עם עריכה ומחיקה */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[8px] tracking-[0.4em] text-white/30 uppercase font-black">Neural Timeline</h2>
            {transcription.length > 0 && <span className="text-[8px] text-[#A855F7] animate-pulse uppercase tracking-widest font-bold">Sync Active</span>}
          </div>
          
          <div className="min-h-[100px] w-full bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-wrap gap-2 items-start content-start">
            {transcription[0]?.words ? (
              transcription[0].words.map((item: any, index: number) => (
                <div 
                  key={index}
                  className={`relative group/word flex items-center bg-[#A855F7]/10 border border-[#A855F7]/20 px-3 py-1.5 rounded-lg transition-all hover:bg-[#A855F7]/20 ${currentTime >= item.start && currentTime <= item.end ? 'ring-1 ring-[#A855F7] bg-[#A855F7]/30' : ''}`}
                >
                  <input 
                    value={item.word}
                    onChange={(e) => handleWordEdit(index, e.target.value)}
                    className="bg-transparent border-none outline-none text-[10px] font-bold text-white w-auto min-w-[30px] text-center"
                    style={{ width: `${item.word.length + 1}ch` }}
                  />
                  <button 
                    onClick={() => handleWordDelete(index)}
                    className="ml-2 opacity-0 group-hover/word:opacity-100 text-white/40 hover:text-red-400 transition-all text-[8px]"
                  >
                    ✕
                  </button>
                </div>
              ))
            ) : (
              <div className="w-full h-full flex items-center justify-center py-6">
                <div className="text-center text-[7px] uppercase tracking-[0.4em] text-white/5">
                  {isDubbing ? 'Generating Neural Timeline...' : 'Waiting for source...'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* כפתור DUB */}
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
        </div>
      </div>
    </main>
  );
}