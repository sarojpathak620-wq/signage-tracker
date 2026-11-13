'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, X, RotateCcw, CheckCircle2, RefreshCw, 
  Settings, Lock, Eye, Compass
} from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (blob: Blob, previewUrl: string, fileSizeKb: number) => void;
  unitName?: string;
  areaName?: string;
  lat?: number;
  lng?: number;
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  unitName = 'Hospital Unit',
  areaName = 'Area',
  lat,
  lng,
}: CameraCaptureModalProps) {
  // Step: 'camera' | 'preview'
  const [step, setStep] = useState<'camera' | 'preview'>('camera');

  // Photo & compression state
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFileSizeKb, setPhotoFileSizeKb] = useState<number | null>(null);

  // Camera stream state
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Live GPS stream while camera is open
  const [liveGps, setLiveGps] = useState<{ lat: number; lng: number } | null>(null);

  // Track live GPS
  useEffect(() => {
    if (!isOpen) return;

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLiveGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.warn('Camera live GPS error:', err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [isOpen]);

  // Start live rear camera stream
  const startCamera = async () => {
    setCameraLoading(true);
    setCameraPermissionDenied(false);
    setCameraError(null);

    // Stop existing stream if any
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by this browser.');
      }

      // Request rear camera with environment facingMode
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setCameraStream(stream);
      setCameraLoading(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch((e) => console.warn('Video play warning:', e));
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraLoading(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraPermissionDenied(true);
      } else {
        setCameraError(err.message || 'Unable to open rear camera. Please ensure permissions are enabled.');
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
  };

  // Start camera when entering 'camera' step
  useEffect(() => {
    if (isOpen && step === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, step]);

  // Reset when closing
  const handleClose = () => {
    stopCamera();
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoBlob(null);
    setPhotoPreview(null);
    setStep('camera');
    onClose();
  };

  // Capture photo from video stream and compress to max 1280px JPEG 0.7
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const now = new Date();
    const readableDateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // GPS coordinates: live GPS first, then passed lat/lng
    const finalLat = liveGps?.lat ?? lat ?? 0;
    const finalLng = liveGps?.lng ?? lng ?? 0;

    // Original dimensions
    const originalWidth = video.videoWidth || 1280;
    const originalHeight = video.videoHeight || 720;

    let targetWidth = originalWidth;
    let targetHeight = originalHeight;
    const MAX_DIMENSION = 1280;

    if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
      if (targetWidth > targetHeight) {
        targetHeight = Math.round((targetHeight * MAX_DIMENSION) / targetWidth);
        targetWidth = MAX_DIMENSION;
      } else {
        targetWidth = Math.round((targetWidth * MAX_DIMENSION) / targetHeight);
        targetHeight = MAX_DIMENSION;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

    // Draw GPS & Timestamp Watermark Bar at bottom
    const barHeight = Math.max(48, Math.round(targetHeight * 0.08));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, targetHeight - barHeight, targetWidth, barHeight);

    // Accent line
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, targetHeight - barHeight, targetWidth, 3);

    // Text: Unit and Area
    const fontSize = Math.max(12, Math.round(barHeight * 0.32));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${unitName} • ${areaName}`, 14, targetHeight - barHeight + fontSize + 4);

    // Text: GPS and Timestamp
    const subFontSize = Math.max(10, Math.round(barHeight * 0.25));
    ctx.font = `${subFontSize}px monospace`;
    ctx.fillStyle = '#94a3b8';
    const gpsLine = `GPS: ${finalLat.toFixed(5)}°, ${finalLng.toFixed(5)}° • ${readableDateStr}`;
    ctx.fillText(gpsLine, 14, targetHeight - 8);

    // Compress to JPEG with quality 0.7
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setPhotoBlob(blob);
          const sizeKb = Math.round(blob.size / 1024);
          setPhotoFileSizeKb(sizeKb);
          const previewUrl = URL.createObjectURL(blob);
          setPhotoPreview(previewUrl);
          stopCamera();
          setStep('preview');
        }
      },
      'image/jpeg',
      0.7
    );
  };

  const handleRetake = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoBlob(null);
    setPhotoPreview(null);
    setStep('camera');
  };

  const handleUsePhoto = () => {
    if (photoBlob && photoPreview && photoFileSizeKb !== null) {
      onCapture(photoBlob, photoPreview, photoFileSizeKb);
      stopCamera();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950 flex flex-col justify-between animate-in fade-in duration-150">
      
      {/* Top Mobile Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-slate-800 text-white z-20 shrink-0">
        <div className="min-w-0 pr-2">
          <div className="flex items-center space-x-1.5 text-xs text-blue-400 font-bold uppercase tracking-wider">
            <Camera className="w-3.5 h-3.5" />
            <span>Field Camera</span>
          </div>
          <h2 className="text-sm font-bold text-white truncate mt-0.5">
            {step === 'camera' ? 'Capture First Photo' : 'Confirm Photo'}
          </h2>
        </div>

        <button
          onClick={handleClose}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl bg-slate-800 text-slate-300 hover:text-white active:scale-95 transition-all cursor-pointer"
          aria-label="Close camera"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* STEP 1: Full-Screen Live Camera Viewfinder */}
      {step === 'camera' && (
        <div className="flex-1 relative bg-black flex flex-col justify-between overflow-hidden">
          
          {/* Permission Denied Guide View */}
          {cameraPermissionDenied ? (
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center text-white bg-slate-900">
              <div className="w-16 h-16 rounded-3xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4 border border-rose-500/30">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold">Camera Access Blocked</h3>
              <p className="text-xs text-slate-300 mt-2 max-w-xs leading-relaxed">
                The field camera requires camera permission to capture live signage photos.
              </p>

              <div className="mt-6 w-full max-w-sm bg-slate-800/80 p-4 rounded-2xl border border-slate-700 text-left text-xs space-y-3">
                <div className="font-bold text-white flex items-center space-x-1.5">
                  <Settings className="w-4 h-4 text-blue-400" />
                  <span>How to enable camera access:</span>
                </div>
                <div className="text-slate-300 space-y-1.5 text-[11px] leading-relaxed">
                  <p><strong>On iPhone (Safari):</strong> Go to iPhone Settings &rarr; Safari &rarr; Camera &rarr; select <strong>Allow</strong>.</p>
                  <p><strong>On Android (Chrome):</strong> Tap the tune/lock icon in address bar &rarr; Permissions &rarr; enable <strong>Camera</strong>.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={startCamera}
                className="mt-6 w-full max-w-sm min-h-[48px] py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
            </div>
          ) : cameraError ? (
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center text-white bg-slate-900">
              <p className="text-sm text-rose-400 mb-4">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="min-h-[48px] px-6 py-2.5 rounded-2xl bg-blue-600 text-white font-bold text-xs"
              >
                Retry Camera
              </button>
            </div>
          ) : (
            <>
              {/* Video Stream Element */}
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Viewfinder Alignment Grid overlay */}
                <div className="absolute inset-4 sm:inset-10 border-2 border-white/25 rounded-3xl pointer-events-none flex flex-col justify-between p-4">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-mono bg-black/60 px-2.5 py-1 rounded-full text-white backdrop-blur-md flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span>LIVE REAR CAMERA</span>
                    </span>
                    
                    {liveGps && (
                      <span className="text-[10px] font-mono bg-black/60 px-2 py-1 rounded-full text-slate-300 backdrop-blur-md">
                        GPS Active
                      </span>
                    )}
                  </div>

                  <div className="text-center text-white/80 text-xs font-semibold drop-shadow bg-black/40 backdrop-blur-xs py-1.5 px-3 rounded-full">
                    Center the outdoor signage in this frame
                  </div>
                </div>
              </div>

              {/* Bottom Camera Controls Bar */}
              <div className="relative z-20 bg-gradient-to-t from-black via-black/80 to-transparent pt-8 pb-8 px-6 flex flex-col items-center space-y-4">
                {/* Shutter Button (72px) */}
                <div className="flex items-center justify-center w-full">
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    disabled={cameraLoading}
                    className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:scale-90 transition-transform cursor-pointer shadow-2xl p-1"
                    aria-label="Capture Photo"
                  >
                    <div className="w-full h-full rounded-full bg-white active:bg-blue-500 transition-colors shadow-inner" />
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 font-medium">
                  Tap to capture photo &amp; stamp GPS
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 2: Photo Captured & Preview */}
      {step === 'preview' && (
        <div className="flex-1 flex flex-col bg-slate-950 justify-between">
          {/* Photo Preview Canvas */}
          <div className="flex-1 relative flex items-center justify-center bg-black min-h-[300px] overflow-hidden p-2">
            {photoPreview && (
              <img
                src={photoPreview}
                alt="Captured signage photo"
                className="w-full h-full max-h-[65vh] object-contain rounded-2xl"
              />
            )}
          </div>

          {/* Action Controls */}
          <div className="bg-slate-900 p-5 border-t border-slate-800 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold">Compressed JPEG</span>
              {photoFileSizeKb && (
                <span className="font-mono text-cyan-400 font-bold">~{photoFileSizeKb} KB</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="min-h-[52px] py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retake</span>
              </button>

              <button
                type="button"
                onClick={handleUsePhoto}
                className="min-h-[52px] py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Use Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
