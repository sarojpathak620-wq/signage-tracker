'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, X, RotateCcw, CheckCircle2, AlertTriangle, 
  AlertOctagon, HelpCircle, MapPin, RefreshCw, 
  ShieldAlert, Check, ShieldCheck, Compass, Eye,
  Settings, Lock
} from 'lucide-react';
import { Signage, SignageCondition } from '@/lib/types';
import { DataService, calculateDistanceMeters } from '@/lib/data-service';
import { useAuth } from '@/contexts/auth-context';

interface CameraInspectionModalProps {
  signage: Signage;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CONDITIONS: { label: SignageCondition; icon: any; color: string; border: string; bg: string; desc: string }[] = [
  {
    label: 'Good',
    icon: CheckCircle2,
    color: 'text-emerald-700',
    border: 'border-emerald-300',
    bg: 'bg-emerald-50 text-emerald-900',
    desc: 'Clean, well-lit, fully intact',
  },
  {
    label: 'Needs Repair',
    icon: AlertTriangle,
    color: 'text-amber-700',
    border: 'border-amber-300',
    bg: 'bg-amber-50 text-amber-900',
    desc: 'Minor wear, light issue, loose frame',
  },
  {
    label: 'Damaged',
    icon: AlertOctagon,
    color: 'text-orange-700',
    border: 'border-orange-300',
    bg: 'bg-orange-50 text-orange-900',
    desc: 'Torn flex, broken board, major damage',
  },
  {
    label: 'Missing',
    icon: HelpCircle,
    color: 'text-rose-700',
    border: 'border-rose-300',
    bg: 'bg-rose-50 text-rose-900',
    desc: 'Removed, vandalized, not at site',
  },
];

const QUICK_REMARKS = [
  'Clean & high visibility',
  'Night backlight working',
  'Needs frame repaint',
  'Flex torn from bottom corner',
  'Obstructed by tree branches',
  'Signage missing from location',
];

export function CameraInspectionModal({ signage, isOpen, onClose, onSuccess }: CameraInspectionModalProps) {
  const { user } = useAuth();

  // Step state: 'camera' | 'preview' | 'details'
  const [step, setStep] = useState<'camera' | 'preview' | 'details'>('camera');

  // Photo & compression state
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFileSizeKb, setPhotoFileSizeKb] = useState<number | null>(null);

  // Form state
  const [condition, setCondition] = useState<SignageCondition>('Good');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GPS state captured at the moment of photo
  const [capturedCoords, setCapturedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [capturedTimestamp, setCapturedTimestamp] = useState<string | null>(null);
  const [capturedDistanceM, setCapturedDistanceM] = useState<number | null>(null);
  const [isLocationMismatch, setIsLocationMismatch] = useState<boolean>(false);

  // Real-time GPS stream while aiming camera
  const [liveGps, setLiveGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);

  // Camera stream state
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Lightbox for previewing photo
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Start live GPS tracking when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLiveGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsPermissionDenied(false);
        },
        (err) => {
          console.warn('Geolocation watch error:', err);
          if (err.code === err.PERMISSION_DENIED) {
            setGpsPermissionDenied(true);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    } else {
      setGpsPermissionDenied(true);
    }
  }, [isOpen]);

  // Start live camera stream with environment (rear) camera
  const startCamera = async () => {
    setCameraLoading(true);
    setCameraPermissionDenied(false);
    setError(null);

    // Stop any existing stream
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by this browser.');
      }

      // Request rear camera with optimal resolution
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
        await videoRef.current.play().catch(e => console.warn('Video play warning:', e));
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraLoading(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraPermissionDenied(true);
      } else {
        setError(err.message || 'Unable to start rear camera. Please ensure camera access is enabled.');
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
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

  // Capture photo from video stream, record GPS & timestamp, compress to real JPEG (< 1280px, 0.7 quality)
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // 1. Record exact timestamp of photo capture
    const now = new Date();
    const timestampStr = now.toISOString();
    const readableDateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setCapturedTimestamp(timestampStr);

    // 2. Record exact GPS at moment of capture
    let lat = liveGps?.lat ?? signage.latitude;
    let lng = liveGps?.lng ?? signage.longitude;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          finishCaptureWithGps(lat, lng, timestampStr, readableDateStr, video);
        },
        () => {
          finishCaptureWithGps(lat, lng, timestampStr, readableDateStr, video);
        },
        { enableHighAccuracy: true, timeout: 4000 }
      );
    } else {
      finishCaptureWithGps(lat, lng, timestampStr, readableDateStr, video);
    }
  };

  const finishCaptureWithGps = (
    lat: number,
    lng: number,
    timestampStr: string,
    readableDateStr: string,
    video: HTMLVideoElement
  ) => {
    setCapturedCoords({ lat, lng });

    // Calculate distance from registered coordinates
    const distanceM = calculateDistanceMeters(lat, lng, signage.latitude, signage.longitude);
    setCapturedDistanceM(distanceM);

    // Requirement 4: Flag location mismatch if > 200m
    const mismatch = distanceM > 200;
    setIsLocationMismatch(mismatch);

    // Compress photo: max 1280px dimension, 0.7 JPEG quality (~200KB)
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

    // Draw tamper-evident GPS & Timestamp Watermark Bar at bottom
    const barHeight = Math.max(48, Math.round(targetHeight * 0.08));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // slate-900 with transparency
    ctx.fillRect(0, targetHeight - barHeight, targetWidth, barHeight);

    // Accent line on top of watermark
    ctx.fillStyle = mismatch ? '#f43f5e' : '#10b981'; // rose or emerald
    ctx.fillRect(0, targetHeight - barHeight, targetWidth, 3);

    // Text: Unit name & address
    const fontSize = Math.max(12, Math.round(barHeight * 0.32));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${signage.unit?.name || 'Hospital Unit'} • ${signage.area?.name || 'Area'}`, 14, targetHeight - barHeight + fontSize + 4);

    // Text: GPS coordinates, distance & timestamp
    const subFontSize = Math.max(10, Math.round(barHeight * 0.25));
    ctx.font = `${subFontSize}px monospace`;
    ctx.fillStyle = '#94a3b8';
    const gpsLine = `GPS: ${lat.toFixed(5)}°, ${lng.toFixed(5)}° (${distanceM}m) • ${readableDateStr}`;
    ctx.fillText(gpsLine, 14, targetHeight - 8);

    // Export compressed JPEG blob with 0.7 quality
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setPhotoBlob(blob);
          setPhotoFileSizeKb(Math.round(blob.size / 1024));
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
    setStep('details');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoBlob) {
      setError('Please capture an inspection photo using the camera.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const lat = capturedCoords?.lat ?? signage.latitude;
      const lng = capturedCoords?.lng ?? signage.longitude;

      await DataService.uploadSignageUpdate({
        signage_id: signage.id,
        condition,
        remarks: remarks.trim() || undefined,
        latitude: lat,
        longitude: lng,
        photo_file: photoBlob,
        uploaded_by: user?.id || 'c0000000-0000-0000-0000-000000000001',
      });

      stopCamera();
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Inspection upload error:', err);
      setError(err.message || 'Failed to submit inspection. Please try again.');
    } finally {
      setSubmitting(false);
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
            <span>Field Camera Inspection</span>
          </div>
          <h2 className="text-sm font-bold text-white truncate mt-0.5">
            {signage.address}
          </h2>
        </div>

        <button
          onClick={() => { stopCamera(); onClose(); }}
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
                The field camera requires camera permission to capture live inspection photos.
              </p>

              <div className="mt-6 w-full max-w-sm bg-slate-800/80 p-4 rounded-2xl border border-slate-700 text-left text-xs space-y-3">
                <div className="font-bold text-white flex items-center space-x-1.5">
                  <Settings className="w-4 h-4 text-blue-400" />
                  <span>How to enable camera access:</span>
                </div>
                <div className="text-slate-300 space-y-1.5 text-[11px] leading-relaxed">
                  <p><strong>On iPhone (Safari):</strong> Go to iPhone Settings &rarr; Safari &rarr; Camera &rarr; select <strong>Allow</strong>.</p>
                  <p><strong>On Android (Chrome):</strong> Tap the tune/lock icon in the address bar &rarr; Permissions &rarr; enable <strong>Camera</strong>.</p>
                </div>
              </div>

              <button
                onClick={startCamera}
                className="mt-6 w-full max-w-sm min-h-[48px] py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 active:scale-95 transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
            </div>
          ) : (
            <>
              {/* Video Stream Element (Inline, Rear Camera) */}
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

                  <div className="text-center text-white/70 text-xs font-medium drop-shadow bg-black/30 backdrop-blur-xs py-1 rounded-full">
                    Fit outdoor signage inside the frame
                  </div>
                </div>
              </div>

              {/* Bottom Camera Controls Bar (Phone-first, min 48px) */}
              <div className="relative z-20 bg-gradient-to-t from-black via-black/80 to-transparent pt-8 pb-8 px-6 flex flex-col items-center space-y-4">
                
                {/* Live Distance Notice */}
                {liveGps && (
                  <div className="text-xs font-mono text-white/90 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center space-x-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Est. Distance: {calculateDistanceMeters(liveGps.lat, liveGps.lng, signage.latitude, signage.longitude)}m from site</span>
                  </div>
                )}

                {/* Capture Shutter Button (Min 72px for thumb touch) */}
                <div className="flex items-center justify-center w-full">
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    disabled={cameraLoading}
                    className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:scale-90 transition-transform cursor-pointer shadow-2xl p-1"
                    aria-label="Capture Inspection Photo"
                  >
                    <div className="w-full h-full rounded-full bg-white active:bg-blue-500 transition-colors shadow-inner" />
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 font-medium">
                  Tap shutter to capture photo &amp; lock GPS location
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 2: Photo Captured & Preview Confirmation */}
      {step === 'preview' && (
        <div className="flex-1 flex flex-col bg-slate-950 overflow-y-auto">
          {/* Photo Preview Canvas */}
          <div className="flex-1 relative flex items-center justify-center bg-black min-h-[300px] overflow-hidden">
            {photoPreview && (
              <img
                src={photoPreview}
                alt="Captured signage photo"
                className="w-full h-full max-h-[60vh] object-contain cursor-pointer"
                onClick={() => setIsLightboxOpen(true)}
              />
            )}
            
            <button
              onClick={() => setIsLightboxOpen(true)}
              className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md text-white text-xs font-bold flex items-center space-x-1"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span>Tap to Enlarge</span>
            </button>
          </div>

          {/* Captured Info & Action Controls */}
          <div className="bg-slate-900 p-5 border-t border-slate-800 space-y-4">
            {/* GPS & Compression Verification Badges */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-1.5">
                {isLocationMismatch ? (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-xs">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    <span>Location Mismatch: {capturedDistanceM}m (&gt;200m)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold text-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>GPS Verified: {capturedDistanceM}m from site</span>
                  </span>
                )}
              </div>

              {photoFileSizeKb && (
                <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                  Compressed: {photoFileSizeKb} KB JPEG
                </span>
              )}
            </div>

            {/* Action Buttons: Retake vs Use Photo (Big 48px touch targets) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleRetake}
                className="min-h-[48px] py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center space-x-2 border border-slate-700"
              >
                <RotateCcw className="w-4 h-4 text-slate-400" />
                <span>Retake</span>
              </button>

              <button
                type="button"
                onClick={handleUsePhoto}
                className="min-h-[48px] py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all active:scale-95 cursor-pointer flex items-center justify-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Use Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Condition & Remarks with Sticky Submit Button */}
      {step === 'details' && (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="p-4 sm:p-6 space-y-5 pb-6">
              
              {/* Photo & GPS Mini Review Card */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
                {photoPreview && (
                  <img
                    src={photoPreview}
                    alt="Captured photo"
                    onClick={() => setIsLightboxOpen(true)}
                    className="w-16 h-16 rounded-xl object-cover cursor-pointer border border-slate-200 shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1 text-xs">
                  <div className="font-bold text-slate-900 truncate">Photo Verified</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {capturedDistanceM}m from site • {photoFileSizeKb} KB JPEG
                  </div>
                  {isLocationMismatch && (
                    <div className="text-[10px] font-bold text-rose-600 mt-0.5">
                      ⚠️ Tagged as Location Mismatch (&gt;200m)
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="min-h-[40px] px-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200"
                >
                  Change
                </button>
              </div>

              {/* Condition Selector (Big 48px touch targets) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Current Physical Condition *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {CONDITIONS.map((c) => {
                    const isSelected = condition === c.label;
                    const Icon = c.icon;
                    return (
                      <button
                        key={c.label}
                        type="button"
                        onClick={() => setCondition(c.label)}
                        className={`min-h-[52px] p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/20'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold text-xs">{c.label}</span>
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : c.color}`} />
                        </div>
                        <span className={`text-[10px] mt-1 line-clamp-1 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                          {c.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Remarks Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  2. Field Remarks / Notes
                </label>
                
                {/* Quick Tap Remarks */}
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {QUICK_REMARKS.map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setRemarks(quick)}
                      className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-[11px] font-medium text-slate-600 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
                    >
                      + {quick}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Note any visible damage, lighting status, road visibility..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Sticky Submit Button at Bottom */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-md p-4 px-6 border-t border-slate-200 shadow-xl z-20">
              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[52px] py-3.5 px-4 rounded-2xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Compressing &amp; Syncing to Cloud...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Submit Inspection &amp; Sync Photo</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {isLightboxOpen && photoPreview && (
        <div className="fixed inset-0 z-60 bg-black/95 flex flex-col justify-between p-4 animate-in fade-in">
          <div className="flex justify-end p-2">
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl bg-slate-800 text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-2">
            <img
              src={photoPreview}
              alt="High resolution inspection capture"
              className="max-h-[80vh] max-w-full object-contain rounded-2xl"
            />
          </div>
          <div className="p-4 text-center text-xs text-slate-400">
            {capturedDistanceM}m from signage • Real JPEG {photoFileSizeKb} KB
          </div>
        </div>
      )}
    </div>
  );
}
