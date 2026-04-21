"use client";

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

export default function Home() {
  // --- 1. אבטחה וגישה ---
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // --- 2. לוגיקה של ה-Dubber ---
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [step, setStep] = useState(1);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // בדיקה אם כבר יש עוגייה (בשביל רענון דף)
  useEffect(() => {
    if (document.cookie.includes('session_access')) {
      setIsAuthorized(true);
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
        setIsAuthorized(true);
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

  // --- תצוגת לוגין ---
  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="flex flex-col items-center space-y-4">
            <Image src="/logo.png" alt="deVee" width={120} height={40} />
            <h2 className="text-[10px] tracking-[0.5em] uppercase text-[#A855F7] font-bold italic">Private Access</h2>
          </div>
          <div className="bg-[#0c0c0c] border border-white/5 rounded-[30px] p-8 relative">
            <form onSubmit={handleLogin} className="space-y-6">
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-white/[0.02] border ${loginError ? 'border-red-500/50' : 'border-white/10'} rounded-[15px] py-4 px-5 text-white text-center focus:outline-none focus:border-[#A855F7]/50`}
                placeholder="ACCESS KEY"
              />
              <button type="submit" className="w-full py-4 bg-[#A855F7] text-white rounded-[15px] uppercase tracking-widest font-black">
                {loginLoading ? 'Verifying...' : 'Enter Studio'}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  // --- תצוגת הסטודיו (הקוד המלא שלך) ---
  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <header className="flex justify-between items-center mb-16">
          <Image src="/logo.png" alt="deVee" width={100} height={32} />
          <span className="text-[10px] tracking-[0.4em] uppercase text-white/40 italic">Production Suite v2.0</span>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* וידאו */}
          <div className="lg:col-span-7">
            <div className="aspect-video bg-[#0c0c0c] border border-white/5 rounded-[40px] overflow-hidden relative group">
              {videoPreview ? (
                <video src={videoPreview} controls className="w-full h-full object-cover" />
              ) : (
                <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 italic text-white/20">+</div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">Upload Raw Media</p>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="video/*" />
                </div>
              )}
            </div>
          </div>

          {/* פקדים */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#0c0c0c] border border-white/5 rounded-[40px] p-10 relative">
              <div className="absolute top-0 right-0 p-8 text-white/[0.02] text-4xl font-black">0{step}</div>
              <h1 className="text-3xl font-black uppercase mb-2">Dubber <span className="text-[#A855F7]">AI</span></h1>
              <p className="text-white/20 text-[10px] uppercase tracking-widest mb-12">Neural Voice Synthesis</p>
              
              <button 
                onClick={() => setIsAnalyzing(true)}
                disabled={!file || isAnalyzing}
                className={`w-full py-6 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all ${file ? 'bg-[#A855F7] shadow-[0_0_20px_#A855F7/20]' : 'bg-white/5 text-white/20'}`}
              >
                {isAnalyzing ? 'Processing...' : 'Analyze Speech'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}