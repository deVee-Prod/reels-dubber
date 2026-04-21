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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // דאטה פיקטיבי לטיימליין (יישלף מה-API בהמשך)
  const segments = [1, 2, 3, 4]; 

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
    }
  };

  // --- מסך נעילה ---
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

  // --- ממשק ה-Editor (הטיימליין החדש) ---
  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans flex flex-col items-center py-12 px-6">
      
      {/* Header */}
      <header className="w-full max-w-2xl flex justify-between items-center mb-12">
        <Image src="/logo.png" alt="deVee" width={80} height={26} className="opacity-70" />
        <span className="text-[8px] tracking-[0.4em] uppercase text-white/20 italic font-medium">Neural Editor v2.0</span>
      </header>

      {/* Main Stack */}
      <div className="w-full max-w-2xl space-y-8">
        
        {/* 1. Video Monitor */}
        <div className="relative aspect-video bg-[#0c0c0c] border border-white/[0.03] rounded-[32px] overflow-hidden shadow-2xl flex items-center justify-center">
          {videoPreview ? (
            <video src={videoPreview} controls className="w-full h-full object-contain" />
          ) : (
            <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center space-y-4 cursor-pointer group">
              <div className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center text-white/10 group-hover:text-[#A855F7] transition-colors font-light text-xl">+</div>
              <p className="text-[9px] uppercase tracking-[0.4em] text-white/20">Upload Raw Media</p>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="video/*" />
            </div>
          )}
        </div>

        {/* 2. Neural Timeline */}
        <div className="w-full space-y-3">
          <div className="flex justify-between items-center px-2">
            <span className="text-[8px] uppercase tracking-widest text-white/20">Timeline</span>
            <span className="text-[8px] uppercase tracking-widest text-[#A855F7] font-bold">Neural Segments</span>
          </div>
          <div className="h-16 bg-[#0c0c0c] border border-white/[0.03] rounded-2xl p-2 flex gap-1 items-center overflow-x-auto no-scrollbar">
            {file ? segments.map((s) => (
              <div key={s} className="h-full min-w-[80px] bg-[#A855F7]/10 border border-[#A855F7]/20 rounded-lg flex items-center justify-center relative group cursor-pointer hover:bg-[#A855F7]/20 transition-all">
                <span className="text-[8px] text-[#A855F7] font-black opacity-40">#{s}</span>
                <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-[8px] text-white/40 hover:text-red-500">✕</button>
              </div>
            )) : (
              <div className="w-full text-center text-[8px] uppercase tracking-[0.4em] text-white/10">Waiting for data</div>
            )}
          </div>
        </div>

        {/* 3. Action Center */}
        <div className="flex flex-col items-center space-y-6 pt-4">
          <button 
            onClick={() => setIsDubbing(true)}
            disabled={!file || isDubbing}
            className={`px-12 py-3.5 rounded-full uppercase tracking-[0.4em] text-[9px] font-black transition-all ${
              file && !isDubbing ? 'bg-[#A855F7] text-white shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:scale-105' : 'bg-white/[0.02] text-white/10 border border-white/5'
            }`}
          >
            {isDubbing ? 'Processing...' : 'DUB!'}
          </button>
          
          <p className="text-[7px] tracking-[0.3em] text-white/10 uppercase italic text-center">
            Neural sync will generate timeline segments automatically
          </p>
        </div>

      </div>

      {/* Footer Standard */}
      <footer className="mt-auto pt-20 pb-8 flex flex-col items-center space-y-3">
        <span className="text-[9px] tracking-[0.1em] text-white/40 font-light">Powered By deVee Boutique Label</span>
        <Image src="/label_logo.jpg" alt="deVee Label" width={32} height={32} className="rounded-full opacity-60 hover:opacity-100 transition-opacity cursor-pointer" />
      </footer>

    </main>
  );
}