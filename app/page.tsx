"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

export default function Home() {
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [step, setStep] = useState(1);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.cookie.includes('session_access')) {
      setAuthorized(true);
    }
  }, []);

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
      setStep(2);
    }
  };

  // --- 1. מסך נעילה ---
  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-between p-8">
        <div /> {/* Spacer */}
        
        <div className="w-full max-w-[340px] flex flex-col items-center space-y-10">
          <div className="flex flex-col items-center space-y-4">
            <Image src="/logo.png" alt="deVee" width={100} height={32} />
            <h2 className="text-[9px] tracking-[0.5em] uppercase text-[#A855F7]/80 font-bold italic">
              Private Studio Access
            </h2>
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
              <button type="submit" disabled={loginLoading} className="w-full py-3 bg-[#A855F7] text-white rounded-xl uppercase tracking-[0.3em] text-[8px] font-black transition-all active:scale-95 disabled:opacity-50">
                {loginLoading ? 'Verifying...' : 'Enter Studio'}
              </button>
            </form>
          </div>
        </div>

        {/* פוטר סטנדרטי של הלייבל למסך הנעילה */}
        <footer className="flex flex-col items-center space-y-3 pb-4">
          <span className="text-[9px] tracking-[0.1em] text-white/40 font-light">
            Powered By deVee Boutique Label
          </span>
          <Image 
            src="/label_logo.jpg" 
            alt="deVee Label" 
            width={32} 
            height={32} 
            className="rounded-full opacity-60" 
          />
        </footer>
      </main>
    );
  }

  // --- 2. ממשק הסטודיו ---
  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans flex flex-col justify-between">
      <div className="max-w-7xl mx-auto px-6 py-12 w-full">
        <header className="flex justify-between items-center mb-20">
          <Image src="/logo.png" alt="deVee" width={85} height={28} className="opacity-70" />
          <div className="flex items-center gap-6">
            <div className="h-1.5 w-1.5 rounded-full bg-[#A855F7] animate-pulse"></div>
            <span className="text-[8px] tracking-[0.4em] uppercase text-white/20 italic font-medium">Suite v2.0</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-7">
            <div className="relative aspect-video bg-[#0c0c0c] border border-white/[0.03] rounded-[32px] overflow-hidden group">
              {videoPreview ? (
                <video src={videoPreview} controls className="w-full h-full object-cover" />
              ) : (
                <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center space-y-4 cursor-pointer hover:bg-white/[0.01]">
                  <div className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-white/10 text-lg">+</div>
                  <p className="text-[8px] uppercase tracking-[0.4em] text-white/20 font-bold">Upload Media</p>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="video/*" />
                </div>
              )}
            </div>
          </div>
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="bg-[#0c0c0c]/40 border border-white/[0.03] rounded-[32px] p-10 relative overflow-hidden backdrop-blur-sm">
              <div className="absolute top-0 right-0 p-8 text-white/[0.02] text-5xl font-black italic">0{step}</div>
              <h1 className="text-3xl font-black uppercase tracking-tighter mb-1 italic">Dubber <span className="text-[#A855F7] not-italic text-2xl">AI</span></h1>
              <p className="text-white/20 text-[9px] uppercase tracking-[0.3em] mb-12 font-medium">Neural Voice Engine</p>
              <button onClick={() => setIsAnalyzing(true)} disabled={!file || isAnalyzing} className={`w-full py-3 rounded-xl uppercase tracking-[0.3em] text-[8px] font-black transition-all ${file && !isAnalyzing ? 'bg-[#A855F7] text-white shadow-xl hover:bg-[#9333ea]' : 'bg-white/[0.02] text-white/10 border border-white/5'}`}>
                {isAnalyzing ? 'Processing...' : 'Start Neural Dub'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* פוטר סטנדרטי של הלייבל לסטודיו */}
      <footer className="w-full py-8 flex flex-col items-center justify-center space-y-3 mt-auto">
        <span className="text-[9px] tracking-[0.1em] text-white/40 font-light">
          Powered By deVee Boutique Label
        </span>
        <Image 
          src="/label_logo.jpg" 
          alt="deVee Label" 
          width={32} 
          height={32} 
          className="rounded-full opacity-60 hover:opacity-100 transition-opacity cursor-pointer" 
        />
      </footer>
    </main>
  );
}