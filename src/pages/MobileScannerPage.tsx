import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  Camera, 
  Wifi, 
  WifiOff, 
  Zap, 
  ZapOff, 
  RefreshCw, 
  CheckCircle2, 
  ShoppingBag, 
  Send,
  AlertCircle,
  Sparkles
} from 'lucide-react';

export const MobileScannerPage: React.FC = () => {
  const [sessionCode, setSessionCode] = useState<string>('DEFAULT');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isTerminalOnline, setIsTerminalOnline] = useState<boolean>(false);
  const [lastScanned, setLastScanned] = useState<{ barcode: string; time: string; ack?: { productName?: string; price?: number; success: boolean } } | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'mobile-html5-reader';
  const isProcessingRef = useRef<boolean>(false);

  // Parse session from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session') || 'DEFAULT';
    setSessionCode(session);

    // Setup WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use ws on backend port 3001 if direct or proxy /ws
    const wsHost = window.location.hostname;
    const wsUrl = `${protocol}//${wsHost}:3001/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({
        type: 'JOIN_SCANNER',
        session,
        deviceName: navigator.userAgent.includes('Mobile') ? 'HP Kasir' : 'Browser Scanner'
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SCANNER_REGISTERED') {
          setIsTerminalOnline(data.terminalConnected);
        } else if (data.type === 'SCAN_ACK') {
          setLastScanned(prev => prev ? {
            ...prev,
            ack: {
              productName: data.productName,
              price: data.price,
              success: data.success
            }
          } : null);

          // Success vibration
          if (navigator.vibrate) {
            navigator.vibrate(data.success ? [100, 50, 150] : [300]);
          }
        }
      } catch (err) {
        console.error('WebSocket parse error:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsTerminalOnline(false);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  // Initialize camera scanner
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
          setScannerError('Kamera tidak ditemukan pada perangkat ini.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Camera access error:', err);
        setScannerError('Izinkan akses kamera di browser HP Anda.');
      });

    return () => {
      isMounted = false;
      cleanupScanner();
    };
  }, []);

  const startScanning = async (cameraId: string) => {
    try {
      setScannerError(null);
      if (scannerRef.current) {
        await cleanupScanner();
      }

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
      });
      scannerRef.current = html5QrCode;

      const config = {
        fps: 20,
        qrbox: { width: 280, height: 160 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        cameraId ? { deviceId: { exact: cameraId } } : { facingMode: 'environment' },
        config,
        (decodedText) => {
          if (isProcessingRef.current) return;
          isProcessingRef.current = true;

          handleSendBarcode(decodedText);

          // Cooldown 1.2s before next scan to prevent double scans
          setTimeout(() => {
            isProcessingRef.current = false;
          }, 1200);
        },
        () => {}
      );

      // Check torch
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities() as any;
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      } catch (e) {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.error('Scanner init error:', err);
      setScannerError('Gagal membuka kamera. Periksa izin kamera HP Anda.');
    }
  };

  const cleanupScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {}
      scannerRef.current = null;
    }
  };

  const handleSendBarcode = (barcodeToSend: string) => {
    const code = barcodeToSend.trim();
    if (!code) return;

    // Send to WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'BARCODE_SCANNED',
        session: sessionCode,
        barcode: code,
      }));
    }

    // Audio & vibration
    if (navigator.vibrate) {
      navigator.vibrate(80);
    }

    setLastScanned({
      barcode: code,
      time: new Date().toLocaleTimeString('id-ID'),
    });
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
    } catch (e) {}
  };

  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const idx = cameras.findIndex(c => c.id === selectedCameraId);
    const nextCam = cameras[(idx + 1) % cameras.length].id;
    setSelectedCameraId(nextCam);
    startScanning(nextCam);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between select-none">
      
      {/* Mobile Top Header */}
      <header className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center font-bold text-white shadow-lg shadow-brand-600/30">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
              <span>Scanner Nirkabel HP</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 font-mono">
                PRO
              </span>
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>Sesi:</span>
              <strong className="font-mono text-brand-400">{sessionCode}</strong>
            </div>
          </div>
        </div>

        {/* Connection status indicator */}
        <div className="flex items-center gap-1.5">
          {hasTorch && (
            <button
              onClick={handleToggleTorch}
              className={`p-2 rounded-xl transition-colors ${
                isTorchOn ? 'bg-amber-400 text-slate-950' : 'text-slate-400 bg-slate-800'
              }`}
              title="Flash"
            >
              {isTorchOn ? <Zap className="w-4 h-4 fill-slate-950" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          {cameras.length > 1 && (
            <button
              onClick={handleSwitchCamera}
              className="p-2 text-slate-400 bg-slate-800 rounded-xl"
              title="Ganti Kamera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 border ${
            isConnected
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
          }`}>
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{isConnected ? 'Terhubung' : 'Offline'}</span>
          </div>
        </div>
      </header>

      {/* Main Camera Viewport */}
      <main className="flex-1 relative flex flex-col items-center justify-center overflow-hidden bg-black">
        {/* Scanner container */}
        <div id={readerElementId} className="w-full h-full max-h-[70vh] overflow-hidden" />

        {/* Viewfinder Laser Target */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="relative w-72 h-44 border-2 border-brand-500 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
            <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-brand-400 rounded-tl" />
            <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-brand-400 rounded-tr" />
            <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-brand-400 rounded-bl" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-brand-400 rounded-br" />

            {/* Red Laser scan line */}
            <div className="absolute inset-x-2 h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-bounce top-1/2 -translate-y-1/2" />
          </div>

          <span className="text-[11px] font-mono text-white/90 mt-4 bg-black/70 px-3.5 py-1.5 rounded-full border border-white/10 backdrop-blur-xs">
            Arahkan kamera ke barcode produk
          </span>
        </div>

        {/* Error overlay */}
        {scannerError && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
            <AlertCircle className="w-12 h-12 text-rose-500" />
            <p className="text-xs text-rose-300 font-medium max-w-xs">{scannerError}</p>
            <button
              onClick={() => startScanning(selectedCameraId)}
              className="py-2.5 px-5 rounded-xl bg-brand-600 font-bold text-xs"
            >
              Coba Nyalakan Kamera
            </button>
          </div>
        )}

        {/* Floating Scan Success Confirmation Banner */}
        {lastScanned && (
          <div className="absolute top-4 inset-x-4 z-30 animate-in slide-in-from-top-4 duration-200">
            <div className={`p-4 rounded-2xl border shadow-xl flex items-center gap-3 backdrop-blur-md ${
              lastScanned.ack?.success !== false
                ? 'bg-emerald-950/90 border-emerald-500/50 text-white'
                : 'bg-rose-950/90 border-rose-500/50 text-white'
            }`}>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-emerald-300">Terkirim ke Laptop ({lastScanned.time})</span>
                  <span className="text-[10px] font-mono font-bold text-slate-400">{lastScanned.barcode}</span>
                </div>
                <h4 className="font-bold text-sm text-white truncate mt-0.5">
                  {lastScanned.ack?.productName || 'Memproses di Laptop Kasir...'}
                </h4>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer: Manual Barcode Input Backup */}
      <footer className="p-4 bg-slate-900 border-t border-slate-800 space-y-3 shrink-0">
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Atau ketik barcode manual di sini..."
            className="flex-1 px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder:font-sans placeholder:text-slate-500 outline-hidden focus:border-brand-500"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Kirim</span>
          </button>
        </form>

        <div className="text-center text-[10px] text-slate-500">
          Hasil scan otomatis terkirim & muncul di keranjang laptop kasir secara real-time.
        </div>
      </footer>
    </div>
  );
};
