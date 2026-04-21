"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function Home() {
  const [authorized, setAuthorized] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [step, setStep] = useState(1);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // בדיקת אבטחה בתוך ה-Client
  useEffect(() => {
    // אנחנו בודקים אם העוגייה קיימת. אם לא - עפים ללוגין
    const hasAccess = document.cookie.includes('session_access');
    if (!hasAccess) {
      router.push('/signin');
    } else {
      setAuthorized(true);
    }
  }, [router]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setVideoPreview(URL.createObjectURL(uploadedFile));
      setStep(2);
    }
  };

  // אם עוד לא בדקנו אישור, לא מראים כלום (מונע "קפיצה" של התוכן)
  if (!authorized) return <div className="min-h-screen bg-[#050505]" />;

  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#A855F7]/30 flex flex-col justify-between">
      <div className="max-w-7xl mx-auto px-6 py-12 w-full">
        {/* Header */}
        <header className="flex justify-between items-center mb-16">
          <Image src="/logo.png" alt="deVee" width={100} height={32} className="opacity-80" />
          <div className="flex items-center gap-6">
            <div className="h-2 w-2 rounded-full bg-[#A855F7] animate-pulse shadow-[0_0_10px_#A855F7]"></div>
            <span className="text-[10px] tracking-[0.4em] uppercase text-white/40 italic">
              Production Suite v2.0
            </span>
          </div>
        </header>

        {/* Main Interface Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Video Preview & Dropzone */}
          <div className="lg:col-span-7 space-y-6">
            <div className="relative aspect-video bg-[#0c0c0c] border border-white/[0.05] rounded-[40px] overflow-hidden group shadow-2xl">
              {videoPreview ? (
                <video src={videoPreview} controls className="w-full h-full object-cover" />
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center space-y-6 cursor-pointer hover:bg-white/[0.01] transition-colors"
                >
                  <div className="w-20 h-20 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                    <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/40 mb-1">Drop Raw Footage</p>
                    <p className="text-[9px] text-white/10 uppercase tracking-widest">Supported: MP4, MOV, WEBM</p>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="video/*" />
                </div>
              )}
            </div>
            {file && (
              <div className="flex items-center gap-4 px-6 py-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                <div className="w-2 h-2 rounded-full bg-green-500/40 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                <span className="text-[10px] uppercase tracking-widest text-white/40">File Loaded: {file.name}</span>
              </div>
            )}
          </div>

          {/* Right Column: Controls */}
          <div className="lg:col-span-5 space-y-8">
            <div className="bg-[#0c0c0c] border border-white/[0.05] rounded-[40px] p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8">
                <span className="text-[40px] font-black text-white/[0.02] select-none">0{step}</span>
              </div>
              <div className="relative z-10">
                <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">
                  Dubber <span className="text-[#A855F7] italic">AI</span>
                </h1>
                <p className="text-white/30 text-[11px] uppercase tracking-[0.2em] mb-12">
                  Multilingual Speech Synthesis
                </p>
                <div className="space-y-12">
                  {/* Action Button: Elegant update */}
                  <button 
                    disabled={!file || isAnalyzing}
                    className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-500 group relative overflow-hidden ${
                      file && !isAnalyzing ? 'bg-[#A855F7] text-white' : 'bg-white/[0.02] text-white/20 border border-white/5'
                    }`}
                  >
                    <span className="relative z-10 uppercase tracking-[0.3em] text-[8px] font-bold">
                      {isAnalyzing ? 'Processing Audio...' : 'Start Neural Dub'}
                    </span>
                  </button>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                      <p className="text-[8px] uppercase tracking-widest text-white/20 mb-1">Target Language</p>
                      <p className="text-[10px] uppercase font-bold text-white/60 tracking-widest">English (US)</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                      <p className="text-[8px] uppercase tracking-widest text-white/20 mb-1">Voice Profile</p>
                      <p className="text-[10px] uppercase font-bold text-white/60 tracking-widest">Neural Clone</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Powered By: Standard footer for Studio */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 border-t border-white/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="deVee Label" width={40} height={12} className="opacity-40" />
          <span className="text-[7px] uppercase tracking-[0.2em] text-white/20">
            Powered By deVee Boutique Label
          </span>
        </div>
        <p className="text-[7px] tracking-[0.2em] text-white/10 uppercase">
          Neural Interface Studio
        </p>
      </footer>
    </main>
  );
}