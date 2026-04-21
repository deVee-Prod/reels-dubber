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

  // דאטה פיקטיבי לטיימליין
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
      
      {/* Header - לוגו עם כיתוב Reels Dubber */}
      <header className="w-full max-w-2xl flex flex-col items-center mb-16 space-y-2">
        <Image src="/logo.png" alt="deVee" width={90} height={30} className="opacity-80" />
        <span className="text-[10px] tracking-[0.3em] text-white/40 font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          REELS DUBBER
        </span>
      </header>

      {/* Main Stack */}
      <div className="w-full max-w-2xl space-y-8">
        
        {/* Video Monitor */}
        <div className="relative aspect-video bg-[#0c0c0c] border border-white/[0.03] rounded-[32px] overflow-hidden shadow-2xl flex items-center justify-center">
          {videoPreview ? (
            <video src={videoPreview} controls className="w-full h-full object-contain" />
          ) : (
            <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center space-y-4 cursor-pointer group">
              <div className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-white/10 group-hover:text-[#A855F7] transition-colors text-lg">+</div>
              <p className="text-[8px] uppercase tracking-[0.4em] text-white/20 font-bold">Upload Media</p>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="video/*" />
            </div>
          )}
        </div>

        {/* Neural Timeline */}
        <div className="w-full space-y-3">
          <div className="flex justify-between items-center px-2">
            <span className="text-[7px] uppercase tracking-[0.3em] text-white/20 font-bold">Monitor</span>
            <span className="text-[7px] uppercase tracking-[0.3em] text-[#A855F7] font-black">Timeline</span>
          </div>
          <div className="h-16 bg-[#0c0c0c] border border-white/[0.03] rounded-2xl p-2 flex gap-1 items-center overflow-x-auto no-scrollbar">
            {file ? segments.map((s) => (
              <div key={s} className="h-full min-w-[70px] bg-[#A855F7]/10 border border-[#A855F7]/20 rounded-lg flex items-center justify-center relative group cursor-pointer hover:bg-[#A855F7]/20 transition-all">
                <span className="text-[8px] text-[#A855F7] font-black opacity-40">#{s}</span>
              </div>
            )) : (
              <div className="w-full text-center text-[7px] uppercase tracking-[0.4em] text-white/5">Waiting for source...</div>
            )}
          </div>
        </div>

        {/* Action Center */}
        <div className="flex flex-col items-center space-y-6 pt-4">
          <button 
            onClick={() => setIsDubbing(true)}
            disabled={!file || isDubbing}
            className={`px-14 py-3.5 rounded-full uppercase tracking-[0.4em] text-[8px] font-black transition-all ${
              file && !isDubbing ? 'bg-[#A855F7] text-white shadow-[0_0_40px_rgba(168,85,247,0.25)] hover:scale-105' : 'bg-white/[0.02] text-white/10 border border-white/5'
            }`}
          >
            {isDubbing ? 'Syncing...' : 'DUB!'}
          </button>
          
          <p className="text-[7px] tracking-[0.2em] text-white/10 uppercase italic text-center max-w-[200px]">
            Neural engine will process speech and sync timeline automatically
          </p>
        </div>

      </div>

      {/* Footer Standard */}
      <footer className="mt-auto pt-20 pb-4 flex flex-col items-center space-y-3">
        <span className="text-[9px] tracking-[0.1em] text-white/40 font-light">Powered By deVee Boutique Label</span>
        <Image src="/label_logo.jpg" alt="deVee Label" width={32} height={32} className="rounded-full opacity-60 hover:opacity-100 transition-opacity cursor-pointer shadow-xl" />
      </footer>

    </main>
  );
}