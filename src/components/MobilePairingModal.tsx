import React, { useState, useEffect } from 'react';
import { Smartphone, X, ExternalLink, CheckCircle2, Wifi, Copy, Check } from 'lucide-react';

interface MobilePairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionCode: string;
  isScannerConnected: boolean;
  activeScannersCount: number;
}

export const MobilePairingModal: React.FC<MobilePairingModalProps> = ({
  isOpen,
  onClose,
  sessionCode,
  isScannerConnected,
  activeScannersCount,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [networkIp, setNetworkIp] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/network-ip')
      .then(res => res.json())
      .then(data => {
        if (data && data.primaryIp) {
          setNetworkIp(data.primaryIp);
        }
      })
      .catch(() => {
        setNetworkIp(window.location.hostname);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const port = window.location.port ? `:${window.location.port}` : '';
  const host = networkIp || window.location.hostname;
  const scannerUrl = `${window.location.protocol}//${host}${port}/?mode=scanner&session=${sessionCode}`;
  const localTestUrl = `${window.location.origin}/?mode=scanner&session=${sessionCode}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(scannerUrl)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scannerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-600/20 text-brand-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Hubungkan Kamera HP (Wireless Scanner)</h3>
              <p className="text-[11px] text-slate-400">Jadikan kamera HP sebagai barcode scanner laptop</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          
          {/* Status Badge */}
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
            isScannerConnected
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
              : 'bg-amber-50 border border-amber-300 text-amber-800 animate-pulse'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isScannerConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>
              {isScannerConnected 
                ? `HP Kasir Terhubung (${activeScannersCount} perangkat aktif)` 
                : 'Menunggu HP terhubung...'}
            </span>
          </div>

          {/* QR Code container */}
          <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl shadow-xs">
            <img
              src={qrImageUrl}
              alt="QR Code Penghubung HP Kasir"
              className="w-48 h-48 rounded-lg"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-700">
              Kode Sesi Kasir: <strong className="font-mono text-brand-600 font-extrabold text-sm">{sessionCode}</strong>
            </div>
            <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
              Buka aplikasi kamera bawaan HP Anda lalu arahkan ke QR Code di atas. Pastikan HP dan laptop terhubung ke WiFi yang sama.
            </p>
          </div>

          {/* Link URL box */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-left">
            <div className="truncate text-[11px] font-mono text-slate-700 pr-2">
              {scannerUrl}
            </div>
            <button
              onClick={handleCopy}
              className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1 shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-brand-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin' : 'Salin'}</span>
            </button>
          </div>

          {/* Local testing link (opens in new tab) */}
          <div className="pt-2 border-t border-slate-100 w-full">
            <a
              href={localTestUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline flex items-center justify-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Uji langsung di tab laptop baru (Simulasi HP)</span>
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="py-2 px-5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
