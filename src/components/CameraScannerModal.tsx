import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, RefreshCw, AlertCircle, Zap, ZapOff, CheckCircle2 } from 'lucide-react';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcode: string) => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'pos-camera-barcode-reader';

  useEffect(() => {
    if (!isOpen) {
      cleanupScanner();
      setScannedCode(null);
      setScannerError(null);
      return;
    }

    let isMounted = true;

    // Get available cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera (environment) on mobile
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
          setScannerError('Tidak ditemukan perangkat kamera di perangkat Anda.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Camera access error:', err);
        setScannerError(
          'Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan di browser Anda.'
        );
      });

    return () => {
      isMounted = false;
      cleanupScanner();
    };
  }, [isOpen]);

  const startScanning = async (cameraId: string) => {
    try {
      setScannerError(null);
      if (scannerRef.current) {
        await cleanupScanner();
      }

      // Configure HTML5 QR & Barcode formats
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
        fps: 15,
        qrbox: { width: 280, height: 180 }, // Wide box tailored for retail 1D barcodes
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        cameraId ? { deviceId: { exact: cameraId } } : { facingMode: 'environment' },
        config,
        (decodedText) => {
          // Barcode successfully detected!
          setScannedCode(decodedText);
          cleanupScanner();
          setTimeout(() => {
            onScanSuccess(decodedText);
            onClose();
          }, 350);
        },
        () => {
          // Scan frame tick (no barcode yet)
        }
      );

      setIsScanning(true);

      // Check flashlight/torch capability
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities() as any;
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      } catch (e) {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.error('Failed to start barcode scanner:', err);
      setIsScanning(false);
      setScannerError(
        'Gagal memulai pemindai kamera. Pastikan kamera tidak sedang dipakai aplikasi lain.'
      );
    }
  };

  const cleanupScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {
        // ignore cleanup error
      }
      scannerRef.current = null;
      setIsScanning(false);
    }
  };

  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCameraId = cameras[nextIndex].id;
    setSelectedCameraId(nextCameraId);
    startScanning(nextCameraId);
  };

  const handleToggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !isTorchOn;
      await (scannerRef.current as any).applyVideoConstraints({
        advanced: [{ torch: nextState }],
      });
      setIsTorchOn(nextState);
    } catch (e) {
      console.error('Torch error:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-600/20 text-brand-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">Pemindai Barcode Kamera</h3>
              <p className="text-[10px] text-slate-400">Arahkan kamera ke barcode produk (EAN/UPC)</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {hasTorch && (
              <button
                onClick={handleToggleTorch}
                className={`p-2 rounded-xl transition-colors ${
                  isTorchOn ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Lampu Flash"
              >
                {isTorchOn ? <Zap className="w-4 h-4 fill-slate-950" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            {cameras.length > 1 && (
              <button
                onClick={handleSwitchCamera}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                title="Ganti Kamera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Viewport Area */}
        <div className="relative bg-black flex flex-col items-center justify-center min-h-[320px] overflow-hidden">
          {/* HTML5 QR Container */}
          <div id={readerElementId} className="w-full max-w-[360px] h-[320px] overflow-hidden rounded-xl" />

          {/* Target Overlay Laser (Active when scanning) */}
          {isScanning && !scannedCode && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="relative w-64 h-36 border-2 border-brand-500 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                {/* Corner Markers */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-brand-400 rounded-tl" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-brand-400 rounded-tr" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-brand-400 rounded-bl" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-brand-400 rounded-br" />

                {/* Animated Laser Barcode Line */}
                <div className="absolute inset-x-2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-bounce top-1/2 -translate-y-1/2 opacity-80" />
              </div>
              <span className="text-[11px] font-mono text-white/80 mt-3 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
                Posisikan garis merah di atas barcode
              </span>
            </div>
          )}

          {/* Success Flash Overlay */}
          {scannedCode && (
            <div className="absolute inset-0 bg-brand-600/90 flex flex-col items-center justify-center text-white p-4 animate-in fade-in duration-150">
              <CheckCircle2 className="w-12 h-12 mb-2 animate-pulse" />
              <span className="font-bold text-sm">Barcode Terdeteksi!</span>
              <span className="font-mono text-base font-black tracking-wider mt-1">{scannedCode}</span>
            </div>
          )}

          {/* Error Message */}
          {scannerError && (
            <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-center p-6 space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500" />
              <p className="text-xs text-rose-300 font-medium max-w-xs">{scannerError}</p>
              <button
                onClick={() => startScanning(selectedCameraId)}
                className="py-2 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors"
              >
                Coba Lagi
              </button>
            </div>
          )}
        </div>

        {/* Footer info & manual close */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Kamera Aktif: <strong className="text-slate-300">{cameras.find(c => c.id === selectedCameraId)?.label || 'Belakang/Utama'}</strong></span>
          <button
            onClick={onClose}
            className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
