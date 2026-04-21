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

  // בדיקת אבטחה מקומית בלבד - בלי לשלוח לכתובות אחרות
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

  // --- תצוגת מסך נעילה (UI אלגנטי) ---
  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-between p-8">
        <div /> {/* Spacer */}
        <div className="w-full max-w-[360px] flex flex-col items-center space-y-12">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative group">
              <div className="absolute -inset-4 bg-[#A855F7] rounded-full blur opacity-10 group-hover:opacity-20 transition-opacity"></div>
              <Image src="/logo.png" alt="deVee" width={100} height={32} className="relative" />
            </div>
            <h2 className="text-[9px] tracking-[0.6em] uppercase text-[#A855F7]/80 font-bold italic">
              Private Studio Access
            </h2>
          </div>

          <div className="w-full bg-[#0c0c0c]/50 border border-white/[0.03] rounded-[24px] p-8 shadow-2xl backdrop-blur-xl">
            <form onSubmit={handleLogin} className="flex flex-col space-y-5">
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-white/[0.02] border ${loginError ? 'border-red-500/40' : 'border-white/5'} rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#A855F7]/30 transition-all text-center tracking-[0.3em] text-[12px]`}
                placeholder="ACCESS KEY"
              />
              <button 
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 bg-[#A855F7] hover:bg-[#9333ea] text-white rounded-xl uppercase tracking-[0.3em] text-[9px] font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50"
              >
                {loginLoading ? 'Verifying...' : 'Enter Studio'}
              </button>
            </form>
          </div>
        </div>

        {/* Footer Standard */}
        <footer className="flex flex-col items-center space-y-3">
          <div className="flex items-center gap-3 opacity-30">
            <Image src="/logo.png" alt="deVee Label" width={30} height={10} />
            <span className="text-[7px] uppercase tracking-[0.3em] text-white">
              Powered By deVee Boutique Label
            </span>
          </div>
        </footer>
      </main>
    );
  }

  // --- תצוגת הסטודיו (UI אלגנטי) ---
  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans flex flex-col justify-between">
      <div className="max-w-7xl mx-auto px-6 py-12 w-full">
        <header className="flex justify-between items-center mb-20">
          <Image src="/logo.png" alt="deVee" width={90} height={28} className="opacity-70" />
          <div className="flex items-center gap-6">
            <div className="h-1.5 w-1.5 rounded-full bg-[#A855F7] animate-pulse"></div>
            <span className="text-[9px] tracking-[0.4em] uppercase text-white/30 italic">Suite v2.0</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-7">
            <div className="relative aspect-video bg-[#0c0c0c] border border-white/[0.03] rounded-[32px] overflow-hidden group shadow-2xl">
              {videoPreview ? (
                <video src={videoPreview} controls className="w-full h-full object-cover" />
              ) : (
                <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center space-y-4 cursor-pointer hover:bg-white/[0.01] transition-colors">
                  <div className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center text-white/20 font-light text-xl">+</div>
                  <p className="text-[9px] uppercase tracking-[0.4em] text-white/20">Upload Media</p>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="video/*" />
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="bg-[#0c0c0c]/50 border border-white/[0.03] rounded-[32px] p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 text-white/[0.02] text-5xl font-black select-none">0{step}</div>
              <h1 className="text-3xl font-black uppercase tracking-tighter mb-1">Dubber <span className="text-[#A855F7] italic text-2xl">AI</span></h1>
              <p className="text-white/20 text-[9px] uppercase tracking-[0.3em] mb-12">Neural Voice Engine</p>
              
              <button 
                onClick={() => setIsAnalyzing(true)}
                disabled={!file || isAnalyzing}
                className={`w-full py-3.5 rounded-xl uppercase tracking-[0.3em] text-[9px] font-bold transition-all ${
                  file && !isAnalyzing ? 'bg-[#A855F7] text-white shadow-xl hover:bg-[#9333ea]' : 'bg-white/[0.02] text-white/10 border border-white/5'
                }`}
              >
                {isAnalyzing ? 'Processing...' : 'Start Neural Dub'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <footer className="w-full max-w-7xl mx-auto px-6 py-8 border-t border-white/[0.03] flex items-center justify-between">
        <div className="flex items-center gap-3 opacity-30">
          <Image src="/logo.png" alt="deVee Label" width={32} height={10} />
          <span className="text-[7px] uppercase tracking-[0.3em] text-white">
            Powered By deVee Boutique Label
          </span>
        </div>
        <p className="text-[7px] tracking-[0.4em] text-white/10 uppercase italic">Neural Studio</p>
      </footer>
    </main>
  );
}