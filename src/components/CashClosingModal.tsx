import React, { useState, useMemo, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import { formatRupiah, formatDateTime } from '../utils/formatters';
import { 
  X, 
  Clock, 
  Calendar, 
  Banknote, 
  Receipt, 
  CreditCard, 
  QrCode, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight,
  Calculator,
  AlertCircle,
  HelpCircle,
  ShieldAlert
} from 'lucide-react';

interface CashClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CashClosingModal: React.FC<CashClosingModalProps> = ({ isOpen, onClose }) => {
  const { 
    attendance, 
    checkOut, 
    transactions, 
    currentUser, 
    cashier,
    refreshAttendance
  } = usePOS();

  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute live breakdown strictly for this active attendance shift
  const stats = useMemo(() => {
    const openingCash = attendance?.openingCash ?? 500000;

    // Filter transactions strictly for this active attendance shift
    const todayTransactions = transactions.filter(t => {
      if (t.status === 'BATAL') return false;
      if (attendance?.id) {
        return t.attendanceId === attendance.id;
      }
      return false;
    });

    let totalTransactions = todayTransactions.length;
    let totalRevenue = 0;
    let cashSales = 0;
    let qrisSales = 0;
    let transferSales = 0;

    todayTransactions.forEach(t => {
      totalRevenue += t.total;
      const method = (t.paymentMethod || '').toLowerCase();
      if (method === 'tunai' || method.includes('tunai') || method.includes('cash') || t.paymentMethodType === 'TUNAI') {
        cashSales += t.total;
      } else if (method.includes('qris')) {
        qrisSales += t.total;
      } else {
        transferSales += t.total;
      }
    });

    const expectedCash = openingCash + cashSales;

    return {
      openingCash,
      totalTransactions,
      totalRevenue,
      cashSales,
      qrisSales,
      transferSales,
      expectedCash,
    };
  }, [attendance, transactions]);

  // Actual cash numeric
  const actualCash = useMemo(() => {
    const cleaned = actualCashInput.replace(/\D/g, '');
    return cleaned ? parseInt(cleaned, 10) : 0;
  }, [actualCashInput]);

  // Selisih: actual - expected
  const cashDifference = useMemo(() => {
    if (!actualCashInput) return 0;
    return actualCash - stats.expectedCash;
  }, [actualCash, stats.expectedCash, actualCashInput]);

  const hasDifference = actualCashInput !== '' && cashDifference !== 0;
  const isSurplus = cashDifference > 0;
  const isDeficit = cashDifference < 0;

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setActualCashInput('');
      setNote('');
      setIsConfirming(false);
      setErrorMessage(null);
      refreshAttendance();
    }
  }, [isOpen, refreshAttendance]);

  if (!isOpen) return null;

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const checkInFormatted = attendance?.checkIn 
    ? new Date(attendance.checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
    : '08:00';
  const nowTimeFormatted = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
  const cashierName = currentUser?.name || cashier.name || 'Gusti';

  const handleQuickPreset = (amount: number) => {
    setActualCashInput(amount.toLocaleString('id-ID'));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setActualCashInput('');
      return;
    }
    const val = parseInt(raw, 10);
    setActualCashInput(val.toLocaleString('id-ID'));
  };

  const handleSubmit = async () => {
    if (!actualCashInput) {
      setErrorMessage('Silakan hitung dan masukkan jumlah uang fisik di laci kasir.');
      return;
    }

    if (hasDifference && (!note || note.trim().length < 3)) {
      setErrorMessage('Wajib mengisi keterangan selisih kas fisik minimal 3 karakter.');
      return;
    }

    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await checkOut(actualCash, note.trim() || undefined);
      if (!result.success) {
        setErrorMessage(result.error || 'Gagal melakukan tutup kas harian.');
        setIsConfirming(false);
      } else {
        alert('✅ Tutup Kas Harian berhasil! Hari kerja kasir telah ditutup.');
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem.');
      setIsConfirming(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white p-5 sm:p-6 relative overflow-hidden shrink-0">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                Rekonsiliasi Kas Akhir Shift
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-1.5 text-white">
                TUTUP KAS HARIAN
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Hitung fisik uang tunai di laci kasir dan selesaikan hari kerja toko ARFA FASHION.
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          
          {/* Identity & Shift Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Kasir Bertugas</span>
              <div className="font-bold text-slate-900 text-xs mt-0.5 truncate">{cashierName}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Tanggal</span>
              <div className="font-bold text-slate-900 text-xs mt-0.5 truncate">{dateFormatted}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Jam Masuk</span>
              <div className="font-mono font-bold text-slate-900 text-xs mt-0.5">{checkInFormatted} WIB</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Jam Tutup Kas</span>
              <div className="font-mono font-bold text-slate-900 text-xs mt-0.5">{nowTimeFormatted} WIB</div>
            </div>
          </div>

          {/* Breakdown Card: Modal Awal + Penjualan Tunai = Kas Seharusnya */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Ringkasan Penjualan Shift Hari Ini
              </span>
              <span className="text-xs font-mono font-bold text-brand-400">
                {stats.totalTransactions} Transaksi
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {/* Modal Awal */}
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  Modal Kas Awal Tetap:
                </span>
                <span className="font-mono font-bold text-white">{formatRupiah(stats.openingCash)}</span>
              </div>

              {/* Penjualan Tunai */}
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  Total Penjualan Tunai (Cash):
                </span>
                <span className="font-mono font-bold text-emerald-400">+{formatRupiah(stats.cashSales)}</span>
              </div>

              {/* Transfer & QRIS */}
              <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800/60">
                <span className="flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-sky-400" />
                  Non-Tunai (Transfer & QRIS - di Bank):
                </span>
                <span className="font-mono font-semibold text-slate-300">{formatRupiah(stats.qrisSales + stats.transferSales)}</span>
              </div>
            </div>

            {/* Total Kas Seharusnya */}
            <div className="pt-3 border-t-2 border-slate-700/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Total Kas Fisik Seharusnya
                </span>
                <div className="text-[10px] text-slate-400">
                  (Modal Awal Rp500.000 + Penjualan Tunai)
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                {formatRupiah(stats.expectedCash)}
              </div>
            </div>
          </div>

          {/* Actual Cash Input Box */}
          <div className="bg-amber-50/60 border-2 border-amber-300/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="actualCashInput" className="text-xs font-black uppercase text-amber-950 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-amber-700" />
                <span>Jumlah Kas Fisik Aktual di Laci (Wajib Dihitung Manual)</span>
              </label>
              <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md font-bold">
                Hitung Fisik Laci
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-500 text-lg">
                Rp
              </span>
              <input
                id="actualCashInput"
                type="text"
                inputMode="numeric"
                value={actualCashInput}
                onChange={handleInputChange}
                placeholder="Contoh: 1.250.000"
                className="w-full pl-12 pr-4 py-3.5 text-xl sm:text-2xl font-black font-mono bg-white border-2 border-amber-300 focus:border-amber-600 focus:ring-4 focus:ring-amber-200/50 rounded-2xl outline-hidden text-slate-900 transition-all placeholder:text-slate-300 shadow-inner"
              />
            </div>

            {/* Quick Helper Button: Pas Sesuai Sistem */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-medium text-slate-500">Bantuan cepat:</span>
              <button
                type="button"
                onClick={() => handleQuickPreset(stats.expectedCash)}
                className="text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl border border-amber-300 transition-colors"
              >
                Isi Sesuai Kas Sistem ({formatRupiah(stats.expectedCash)})
              </button>
            </div>
          </div>

          {/* Difference Card */}
          {actualCashInput !== '' && (
            <div className={`p-4 rounded-2xl border-2 transition-all ${
              cashDifference === 0 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950' 
                : isSurplus
                ? 'bg-blue-50 border-blue-300 text-blue-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {cashDifference === 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className={`w-5 h-5 shrink-0 ${isSurplus ? 'text-blue-600' : 'text-rose-600'}`} />
                  )}
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider">
                      {cashDifference === 0 ? 'Status Kas Fisik: SESUAI (Pas)' : isSurplus ? 'Status Kas: LEBIH (Surplus)' : 'Status Kas: KURANG (Defisit)'}
                    </span>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {cashDifference === 0 
                        ? 'Uang fisik di laci cocok sempurna dengan pencatatan sistem.' 
                        : isSurplus
                        ? 'Terdapat uang fisik berlebih dibandingkan pencatatan sistem.'
                        : 'Uang fisik di laci kurang dari pencatatan sistem.'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-lg font-black font-mono ${
                    cashDifference === 0 ? 'text-emerald-700' : isSurplus ? 'text-blue-700' : 'text-rose-700'
                  }`}>
                    {cashDifference === 0 ? 'Rp0' : (isSurplus ? '+' : '') + formatRupiah(cashDifference)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mandatory Note on Difference */}
          {hasDifference && (
            <div className="space-y-1.5 animate-fadeIn">
              <label htmlFor="closingNote" className="text-xs font-bold text-rose-900 flex items-center justify-between">
                <span>Keterangan Alasan Selisih Kas (Wajib Diisi):</span>
                <span className="text-[10px] font-normal text-rose-600">Min. 3 karakter</span>
              </label>
              <textarea
                id="closingNote"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Jelaskan alasan selisih uang kas (misal: uang kembalian salah pecahan, tip pelanggan, dll.)..."
                className="w-full p-3 text-xs bg-rose-50/50 border-2 border-rose-300 focus:border-rose-600 focus:ring-3 focus:ring-rose-200/50 rounded-xl outline-hidden text-slate-900 placeholder:text-rose-300"
              />
            </div>
          )}

          {/* Optional Note if Balanced */}
          {!hasDifference && (
            <div className="space-y-1">
              <label htmlFor="closingNoteOptional" className="text-xs font-medium text-slate-500">
                Catatan Opsional Kasir:
              </label>
              <input
                id="closingNoteOptional"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tulis catatan jika ada hal penting selama shift..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-hidden text-slate-800"
              />
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Confirm Double-check Banner */}
          {isConfirming && (
            <div className="p-4 bg-amber-500/10 border-2 border-amber-400 rounded-2xl text-xs text-amber-950 space-y-1 animate-fadeIn">
              <div className="font-extrabold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Konfirmasi Akhir Tutup Kas:</span>
              </div>
              <p>
                Setelah ditutup, kasir <strong>{cashierName}</strong> tidak dapat membuat transaksi baru hari ini sampai shift berikutnya. Pastikan nominal kas fisik Rp<strong>{actualCash.toLocaleString('id-ID')}</strong> sudah benar.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors"
          >
            Batal
          </button>

          <div className="w-full sm:w-auto flex gap-2">
            {isConfirming ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsConfirming(false)}
                  disabled={isLoading}
                  className="px-4 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100"
                >
                  Cek Ulang
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? 'Menutup Kas...' : 'Ya, Selesaikan Tutup Kas'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || !actualCashInput}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-black text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>TUTUP KAS & SELESAIKAN SHIFT</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
