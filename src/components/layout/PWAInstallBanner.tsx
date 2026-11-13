'use client';

import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if already running as installed PWA (standalone)
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    if (isStandaloneMode) {
      return;
    }

    // Check if user dismissed banner recently
    const dismissed = localStorage.getItem('st_pwa_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      setShowBanner(true);
    }

    // Capture Chrome / Edge / Android install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSInstructions(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('st_pwa_dismissed', String(Date.now()));
  };

  if (!showBanner || isStandalone) return null;

  return (
    <>
      {/* Floating Mobile PWA Install Banner */}
      <aside aria-label="Install App" className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 z-40 max-w-sm bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700/80 animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold leading-tight truncate">Install Signage Tracker</div>
              <div className="text-[11px] text-slate-300 truncate">Fast access &amp; offline ready</div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              Add to Home
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* iOS Safari Instruction Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full text-slate-900 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Add to Home Screen</h3>
              <button onClick={() => setShowIOSInstructions(false)} className="p-1 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Install <strong>Signage Tracker</strong> on your iPhone / iPad in two quick steps:
            </p>

            <div className="space-y-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                  <Share className="w-4 h-4" />
                </div>
                <span>1. Tap the <strong>Share</strong> button at the bottom of Safari.</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <span>2. Scroll down and tap <strong>Add to Home Screen</strong>.</span>
              </div>
            </div>

            <button
              onClick={() => { setShowIOSInstructions(false); handleDismiss(); }}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

