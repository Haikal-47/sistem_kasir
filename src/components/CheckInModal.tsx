import React, { useState, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import { Clock, Calendar, Banknote, Sparkles, CheckCircle2, AlertCircle, ArrowRight, X } from 'lucide-react';
import { formatRupiah } from '../utils/formatters';

interface CheckInModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({ isOpen, onClose }) => {
  const { checkIn, currentUser, cashier, attendanceStatus, setActiveTab } = usePOS();
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isOpen) return null;

  const formattedDate = currentTime.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const cashierDisplayName = currentUser?.name || cashier.name || 'Gusti';

  const handleStartWork = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await checkIn();
      if (!result.success) {
        setErrorMessage(result.error || 'Gagal memulai hari kerja.');
      } else {
        if (onClose) onClose();
        setActiveTab('transaksi');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
    >
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white p-6 sm:p-7 relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-brand-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                Sistem Absensi Kasir ARFA FASHION
              </span>
              <h2 className="text-2xl font-black tracking-tight mt-2 text-white">
                MULAI HARI KERJA
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-2xl">
                🏪
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0 ml-1 cursor-pointer"
                  title="Tutup Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7 space-y-5">
          {/* Welcome Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center text-xl shrink-0 font-black">
              👋
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">
                Selamat datang, {cashierDisplayName}!
              </h3>
              <p className="text-xs text-slate-500">
                Siapkan terminal kasir dan pastikan laci uang kasir dalam kondisi siap beroperasi.
              </p>
            </div>
          </div>

          {/* Date & Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Tanggal */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-brand-600" />
                <span>Tanggal</span>
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1">
                {formattedDate}
              </div>
            </div>

            {/* Jam Masuk Server */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <Clock className="w-4 h-4 text-brand-600" />
                <span>Jam Masuk</span>
              </div>
              <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                {formattedTime} <span className="text-[10px] text-slate-400 font-sans font-medium">WIB</span>
              </div>
            </div>
          </div>

          {/* Modal Kas Awal Tetap (Prompt Rules 4, 5: Modal Kas Awal SELALU Rp500.000, jangan editable!) */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 border-2 border-emerald-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-800 uppercase tracking-wider">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>Modal Kas Awal</span>
              </div>
              <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-2.5 py-0.5 rounded-full font-bold">
                Uang Kembalian Tetap
              </span>
            </div>
            <div className="text-3xl font-black font-mono text-emerald-700 tracking-tight mt-2">
              Rp500.000
            </div>
            <p className="text-[11.5px] text-emerald-800/80 mt-1 leading-relaxed">
              Modal otomatis ditetapkan sistem sebesar <strong>Rp500.000</strong> sebagai uang fisik kembalian awal di laci kasir.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Button Area */}
          <div className="pt-2">
            {attendanceStatus === 'working' ? (
              <div className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 text-center">
                  <p className="text-sm font-bold text-emerald-900 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Shift Anda Sudah Aktif (Sedang Bertugas)</span>
                  </p>
                  <p className="text-xs text-emerald-700 mt-1">
                    Absen masuk telah berhasil tercatat. Terminal kasir Anda siap digunakan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onClose) onClose();
                    setActiveTab('transaksi');
                  }}
                  className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl font-black text-sm tracking-wide shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition-all transform active:scale-[0.99] cursor-pointer"
                >
                  <span>LANJUT KE KASIR / TRANSAKSI</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : attendanceStatus === 'completed' ? (
              <div className="space-y-3">
                <div className="bg-slate-100 border border-slate-300 rounded-2xl p-4 text-center">
                  <p className="text-sm font-bold text-slate-800 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5 text-slate-600" />
                    <span>Hari Kerja Hari Ini Sudah Selesai</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Kas harian sudah ditutup dan laporan telah disimpan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onClose) onClose();
                    setActiveTab('dashboard');
                  }}
                  className="w-full py-3.5 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>TUTUP</span>
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleStartWork}
                  disabled={isLoading}
                  className="w-full py-4 px-6 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:bg-slate-300 text-white rounded-2xl font-black text-sm tracking-wide shadow-xl shadow-brand-600/30 flex items-center justify-center gap-2.5 transition-all transform active:scale-[0.99] cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Memproses Absen Masuk...</span>
                    </>
                  ) : (
                    <>
                      <span>MULAI BEKERJA</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <p className="text-[11px] text-center text-slate-400 mt-2">
                  Jam masuk akan dicatat secara otomatis oleh server saat tombol ditekan.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
