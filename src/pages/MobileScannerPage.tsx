import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, Zap, ZapOff, RefreshCw, CheckCircle2, Send, AlertCircle, CloudUpload, Loader2, XCircle, Volume2, VolumeX } from 'lucide-react';

interface ScanResult {
  scanId: number;
  barcode: string;
  time: string;
  status: 'sending' | 'waiting' | 'found' | 'notfound' | 'error';
  productName?: string;
  productPrice?: number;
}

// Audio beep synthesizer using Web Audio API (no external file needed)
const playBeep = (isSuccess: boolean = true) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isSuccess) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    // AudioContext blocked or not supported
  }
};

export const MobileScannerPage: React.FC = () => {
  const [sessionCode, setSessionCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('session') || 'DEFAULT';
    }
    return 'DEFAULT';
  });
  const sessionCodeRef = useRef<string>(sessionCode);

  useEffect(() => {
    sessionCodeRef.current = sessionCode;
  }, [sessionCode]);

  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'mobile-html5-reader';
  const isProcessingRef = useRef<boolean>(false);
  const ackPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read session code from URL query params (fallback sync)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session') || 'DEFAULT';
    setSessionCode(session);
    sessionCodeRef.current = session;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Send periodic heartbeat to keep laptop informed that phone is active
  useEffect(() => {
    if (!sessionCode || sessionCode === 'DEFAULT') return;

    const deviceName = /android/i.test(navigator.userAgent)
      ? 'Android HP'
      : /iphone|ipad/i.test(navigator.userAgent)
      ? 'iPhone'
      : 'Handheld Scanner';

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/scan/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session: sessionCode, deviceName }),
        });
      } catch (err) {
        // network retry
      }
    };

    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 5000);
    return () => clearInterval(heartbeatInterval);
  }, [sessionCode]);

  // Initialize camera list and start default camera
  useEffect(() => {
    let isMounted = true;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          const backCamera = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('belakang') ||
              d.label.toLowerCase().includes('environment')
          );
          const initialCam = backCamera ? backCamera.id : devices[0].id;
          setSelectedCameraId(initialCam);
          startScanning(initialCam);
        } else {
          setScannerError('Kamera tidak ditemukan pada perangkat ini. Silakan gunakan input manual.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Camera access error:', err);
        setScannerError('Izinkan akses kamera: buka menu browser (titik 3) -> Pengaturan Situs -> Kamera -> Izinkan.');
      });

    return () => {
      isMounted = false;
      cleanupScanner();
      if (ackPollRef.current) clearInterval(ackPollRef.current);
    };
  }, []);

  const startScanning = async (cameraId: string) => {
    try {
      setScannerError(null);
      if (scannerRef.current) await cleanupScanner();

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.QR_CODE,
      ];

      const html5QrCode = new Html5Qrcode(readerElementId, {
        formatsToSupport,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });
      scannerRef.current = html5QrCode;

      const cameraSource = cameraId
        ? { deviceId: { exact: cameraId } }
        : {
            facingMode: 'environment',
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          };

      await html5QrCode.start(
        cameraSource,
        {
          fps: 25,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const width = Math.min(Math.floor(viewfinderWidth * 0.92), 580);
            const height = Math.min(Math.floor(viewfinderHeight * 0.55), 280);
            return { width, height };
          },
          aspectRatio: 1.0,
          disableFlip: true,
        },
        (decodedText) => {
          if (isProcessingRef.current) return;
          isProcessingRef.current = true;
          handleSendBarcode(decodedText);
          // Cool down to avoid repeat scanning the same item too fast
          setTimeout(() => {
            isProcessingRef.current = false;
          }, 2000);
        },
        () => {}
      );

      // Check flashlight capability
      try {
        const caps = html5QrCode.getRunningTrackCapabilities() as any;
        if (caps && caps.torch) setHasTorch(true);
      } catch (e) {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.error('Failed to start mobile scanner:', err);
      setScannerError('Gagal membuka kamera. Pastikan browser memiliki izin kamera.');
    }
  };

  const cleanupScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (e) {
        // ignore cleanup error
      }
      scannerRef.current = null;
    }
  };

  const handleSendBarcode = async (barcodeToSend: string) => {
    const code = barcodeToSend.trim();
    if (!code) return;

    if (navigator.vibrate) navigator.vibrate(80);
    if (soundEnabled) playBeep(true);

    setLastScan({
      scanId: 0,
      barcode: code,
      time: new Date().toLocaleTimeString('id-ID'),
      status: 'sending',
    });

    const activeSession = sessionCodeRef.current || (new URLSearchParams(window.location.search).get('session')) || 'DEFAULT';

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: activeSession, barcode: code }),
      });

      if (!res.ok) throw new Error('Failed to send scan to server');
      const data = await res.json();
      const scanId = data.scanId as number;

      setLastScan((prev) => (prev ? { ...prev, scanId, status: 'waiting' } : null));

      // Poll server for acknowledgement (laptop processing result)
      let attempts = 0;
      if (ackPollRef.current) clearInterval(ackPollRef.current);

      ackPollRef.current = setInterval(async () => {
        attempts++;
        if (attempts > 15) {
          clearInterval(ackPollRef.current!);
          setLastScan((prev) =>
            prev && prev.status === 'waiting'
              ? {
                  ...prev,
                  status: 'error',
                  productName: 'Waktu tunggu habis. Pastikan tab Transaksi di laptop sedang aktif.',
                }
              : prev
          );
          return;
        }

        try {
          const ackRes = await fetch(`/api/scan/${scanId}/ack`);
          if (!ackRes.ok) return;
          const ack = await ackRes.json();

          if (ack.processed) {
            clearInterval(ackPollRef.current!);
            if (navigator.vibrate) {
              navigator.vibrate(ack.success ? [100, 50, 150] : [300]);
            }
            if (soundEnabled && !ack.success) {
              playBeep(false);
            }

            setLastScan((prev) =>
              prev
                ? {
                    ...prev,
                    status: ack.success ? 'found' : 'notfound',
                    productName: ack.productName || undefined,
                    productPrice: ack.productPrice || undefined,
                  }
                : null
            );
          }
        } catch (e) {
          // ack poll retry
        }
      }, 1000);
    } catch (err) {
      console.error('Error sending barcode:', err);
      setLastScan((prev) => (prev ? { ...prev, status: 'error' } : null));
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleSendBarcode(manualInput);
      setManualInput('');
    }
  };

  const handleToggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const next = !isTorchOn;
      await (scannerRef.current as any).applyVideoConstraints({
        advanced: [{ torch: next }],
      });
      setIsTorchOn(next);
    } catch (e) {
      console.error('Torch error:', e);
    }
  };

  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const idx = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextCam = cameras[(idx + 1) % cameras.length].id;
    setSelectedCameraId(nextCam);
    startScanning(nextCam);
  };

  const getScanStatusUI = () => {
    if (!lastScan) return null;
    switch (lastScan.status) {
      case 'sending':
        return {
          icon: <Loader2 className="w-5 h-5 animate-spin text-sky-400" />,
          bg: 'bg-sky-950/90 border-sky-500/50',
          label: 'Mengirim ke server kasir...',
          sub: lastScan.barcode,
        };
      case 'waiting':
        return {
          icon: <Loader2 className="w-5 h-5 animate-spin text-amber-400" />,
          bg: 'bg-amber-950/90 border-amber-500/50',
          label: 'Menunggu laptop kasir memasukkan produk...',
          sub: lastScan.barcode,
        };
      case 'found':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          bg: 'bg-emerald-950/90 border-emerald-500/50',
          label: lastScan.productName || 'Produk ditemukan & masuk keranjang!',
          sub: `Rp ${lastScan.productPrice?.toLocaleString('id-ID') ?? ''} • ${lastScan.time}`,
        };
      case 'notfound':
        return {
          icon: <XCircle className="w-5 h-5 text-rose-400" />,
          bg: 'bg-rose-950/90 border-rose-500/50',
          label: 'Produk tidak ditemukan di katalog kasir',
          sub: lastScan.barcode,
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
          bg: 'bg-rose-950/90 border-rose-500/50',
          label: 'Gagal terhubung ke server',
          sub: 'Periksa koneksi internet ponsel Anda',
        };
      default:
        return null;
    }
  };

  const statusUI = getScanStatusUI();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between select-none">
      {/* Header */}
      <header className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center font-bold text-white shadow-lg shadow-brand-600/30">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
              <span>Scanner Nirkabel HP</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 font-mono">
                ONLINE
              </span>
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>Sesi:</span>
              <strong className="font-mono text-brand-400">{sessionCode}</strong>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl transition-colors ${
              soundEnabled ? 'text-brand-400 bg-slate-800' : 'text-slate-500 bg-slate-800/50'
            }`}
            title={soundEnabled ? 'Suara Aktif' : 'Suara Mati'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {hasTorch && (
            <button
              onClick={handleToggleTorch}
              className={`p-2 rounded-xl transition-colors ${
                isTorchOn ? 'bg-amber-400 text-slate-950' : 'text-slate-400 bg-slate-800'
              }`}
              title="Lampu Flash"
            >
              {isTorchOn ? <Zap className="w-4 h-4 fill-slate-950" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          {cameras.length > 1 && (
            <button
              onClick={handleSwitchCamera}
              className="p-2 text-slate-400 bg-slate-800 rounded-xl hover:text-white transition-colors"
              title="Ganti Kamera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <div
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 border ${
              isOnline
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
            }`}
          >
            <CloudUpload className="w-3 h-3" />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </header>

      {/* Camera Viewport Area */}
      <main className="flex-1 relative flex flex-col items-center justify-center overflow-hidden bg-black">
        <div id={readerElementId} className="w-full h-full max-h-[70vh] overflow-hidden" />

        {/* Laser target frame */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="relative w-[85vw] max-w-[340px] h-48 border-2 border-brand-500 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-brand-400 rounded-tl" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-brand-400 rounded-tr" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-brand-400 rounded-bl" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-brand-400 rounded-br" />
            <div className="absolute inset-x-2 h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-bounce top-1/2 -translate-y-1/2" />
          </div>
          <span className="text-[11px] font-medium text-white/95 mt-4 bg-black/80 px-4 py-2 rounded-full border border-white/20 backdrop-blur-md shadow-lg text-center max-w-[85vw]">
            Dekatkan ke 1 barcode saja sampai garis merah memotong penuh
          </span>
        </div>

        {/* Camera error banner */}
        {scannerError && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
            <AlertCircle className="w-12 h-12 text-rose-500" />
            <p className="text-xs text-rose-300 font-medium max-w-xs">{scannerError}</p>
            <button
              onClick={() => startScanning(selectedCameraId)}
              className="py-2.5 px-5 rounded-xl bg-brand-600 font-bold text-xs hover:bg-brand-500 transition-colors"
            >
              Coba Nyalakan Kamera
            </button>
            <p className="text-[10px] text-slate-500">Atau gunakan input manual di bawah</p>
          </div>
        )}

        {/* Status Notification Banner */}
        {statusUI && (
          <div className="absolute top-4 inset-x-4 z-30 animate-in slide-in-from-top-4 duration-200">
            <div className={`p-4 rounded-2xl border shadow-xl flex items-center gap-3 backdrop-blur-md ${statusUI.bg}`}>
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                {statusUI.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-white truncate">{statusUI.label}</h4>
                <p className="text-[10px] font-mono text-white/60 truncate mt-0.5">{statusUI.sub}</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer: Manual Input */}
      <footer className="p-4 bg-slate-900 border-t border-slate-800 space-y-3 shrink-0">
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Ketik barcode manual..."
            className="flex-1 px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder:font-sans placeholder:text-slate-500 outline-hidden focus:border-brand-500"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shrink-0 shadow-lg shadow-brand-600/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Kirim</span>
          </button>
        </form>
        <div className="text-center text-[10px] text-slate-500">
          Barcode otomatis diproses laptop kasir via cloud database dalam ~1 detik.
        </div>
      </footer>
    </div>
  );
};
