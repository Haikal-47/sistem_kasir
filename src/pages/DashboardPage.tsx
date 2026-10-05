import React, { useState, useEffect, useMemo } from 'react';
import { usePOS } from '../context/POSContext';
import { formatRupiah, formatDateTime } from '../utils/formatters';
import { 
  LayoutDashboard, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Receipt, 
  AlertTriangle, 
  ArrowUpRight, 
  ScanLine,
  Eye,
  Check,
  X,
  CreditCard,
  Banknote,
  LogOut,
  UserCheck,
  Sparkles,
  Calendar
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { 
    transactions, 
    products, 
    confirmTransferPayment, 
    cancelTransaction, 
    setActiveTab, 
    updateProduct,
    isSuperAdmin,
    currentUser,
    cashier,
    attendance,
    attendanceStatus,
    setIsCheckInModalOpen,
    setIsCheckOutModalOpen,
    todaySummary,
    fetchTodaySummary,
    refreshAttendance
  } = usePOS();

  const [previewProof, setPreviewProof] = useState<string | null>(null);
  // FIX #1: Loading state untuk cancel — mencegah tombol ditekan berkali-kali
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTodaySummary();
    refreshAttendance();

    // Auto-refresh saat kembali fokus ke tab ini
    const handleFocus = () => {
      fetchTodaySummary();
      refreshAttendance();
    };
    window.addEventListener('focus', handleFocus);

    // Polling setiap 10 detik untuk update status (admin dan kasir)
    const interval = setInterval(() => {
      fetchTodaySummary();
      refreshAttendance();
    }, 10000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [fetchTodaySummary, refreshAttendance]);


  // Transaksi yang ditampilkan:
  // Kasir: hanya transaksi yang terikat dengan ID sesi absensi shift aktif saat ini
  // Admin: seluruh arsip transaksi toko
  const displayTransactions = useMemo(() => {
    if (isSuperAdmin) return transactions;
    if (!attendance || attendanceStatus === 'not_started' || !attendance.id) return [];
    return transactions.filter(t => t.attendanceId === attendance.id);
  }, [isSuperAdmin, attendance, attendanceStatus, transactions]);

  // Statistics per shift
  const completedTransactions = useMemo(() => {
    return displayTransactions.filter(t => t.status === 'LUNAS');
  }, [displayTransactions]);

  const totalRevenue = useMemo(() => {
    return completedTransactions.reduce((sum, t) => sum + t.total, 0);
  }, [completedTransactions]);

  const pendingConfirmations = useMemo(() => {
    return displayTransactions.filter(t => t.status === 'MENUNGGU_KONFIRMASI');
  }, [displayTransactions]);

  const lowStockProducts = products.filter(p => p.stock <= 5);

  const cashierName = currentUser?.name || cashier.name || 'Gusti';
  const checkInTimeFormatted = attendance?.checkIn
    ? new Date(attendance.checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
    : '08:00';
  const checkOutTimeFormatted = attendance?.checkOut
    ? new Date(attendance.checkOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
    : '-';

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-100 p-4 md:p-6 space-y-4 md:space-y-6">
      
      {/* Top Banner with Quick Role Context & Jump */}
      <div className="bg-slate-900 text-white rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-slate-800">
        <div>
          <span className={`text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
            isSuperAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
          }`}>
            {isSuperAdmin ? 'Portal Administrator • Kontrol Penuh' : `Terminal Kasir Aktif • ${cashier.shift}`}
          </span>
          <h1 className="text-xl md:text-2xl font-black tracking-tight mt-1.5">
            {isSuperAdmin 
              ? 'Ringkasan Bisnis & Operasional Toko' 
              : `Selamat Bertugas, ${cashierName}!`}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            {isSuperAdmin
              ? 'Pantau absensi kasir Gusti, kas fisik harian, antrean verifikasi transfer, kontrol stok varian produk, dan laporan toko ARFA FASHION.'
              : 'Layani pelanggan dengan cepat, periksa bukti transfer pelanggan, dan cetak struk pembayaran dengan akurat.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Kasir Quick Actions based on Attendance */}
          {!isSuperAdmin && (
            <>
              {attendanceStatus === 'not_started' && (
                <button
                  onClick={() => setIsCheckInModalOpen(true)}
                  className="py-3 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Absen Masuk & Mulai Bekerja</span>
                </button>
              )}

              {attendanceStatus === 'working' && (
                <button
                  onClick={() => setIsCheckOutModalOpen(true)}
                  className="py-3 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Selesai / Absen Pulang</span>
                </button>
              )}
            </>
          )}

          <button
            onClick={() => setActiveTab('transaksi')}
            className="py-3 px-5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <ScanLine className="w-4 h-4" />
            <span>Buka Kasir POS (F2)</span>
            <ArrowUpRight className="w-4 h-4 ml-0.5" />
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('laporan')}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <span>Laporan Kas Harian</span>
            </button>
          )}
        </div>
      </div>

      {/* ── ADMIN: STATUS KASIR HARI INI (Prompt Rule 28) ── */}
      {isSuperAdmin && (
        <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                POS
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  STATUS KASIR HARI INI
                </h2>
                <p className="text-xs text-slate-500">
                  Monitoring absensi dan saldo kas harian kasir {todaySummary?.cashierName || 'Gusti'} secara realtime
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchTodaySummary()}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                title="Refresh status kasir"
              >
                <span>↻</span>
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={() => setActiveTab('laporan')}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1"
              >
                <span>Buka Laporan Absensi</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Conditional Cashier Status View */}
          {(!todaySummary || todaySummary.status === 'not_started') && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-slate-400 ring-4 ring-slate-200 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-600 text-sm">⚪ Belum Masuk</span>
                    <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold">Kasir: Gusti</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kasir Gusti belum melakukan Absen Masuk hari ini. Modal awal tetap disiapkan: <strong>Rp500.000</strong>.
                  </p>
                </div>
              </div>
              <div className="text-xs font-mono font-bold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shrink-0">
                Modal Awal: Rp500.000
              </div>
            </div>
          )}

          {todaySummary && todaySummary.status === 'working' && (
            <div className="bg-emerald-50/70 border border-emerald-300 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-200 animate-pulse shrink-0 mt-1" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-emerald-900 text-sm">🟢 Sedang Bekerja</span>
                    <span className="text-xs bg-emerald-200/80 text-emerald-900 px-2.5 py-0.5 rounded-md font-bold">Kasir: Gusti</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-emerald-800 mt-1 font-medium">
                    <span>Jam Masuk: <strong className="font-mono">{todaySummary.checkIn ? new Date(todaySummary.checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : '-'} WIB</strong></span>
                    <span>Modal: <strong className="font-mono">{formatRupiah(todaySummary.openingCash || 500000)}</strong></span>
                    <span>Penjualan Hari Ini: <strong className="font-mono text-emerald-950 font-black">{formatRupiah(todaySummary.revenueToday || 0)}</strong></span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white/80 border border-emerald-200 px-4 py-2 rounded-xl text-xs shrink-0">
                <span className="text-emerald-800 font-medium">Kas Seharusnya (Fisik):</span>
                <span className="font-mono font-black text-emerald-900 text-sm">{formatRupiah(todaySummary.expectedCash || 500000)}</span>
              </div>
            </div>
          )}

          {todaySummary && todaySummary.status === 'completed' && (
            <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-rose-500 ring-4 ring-rose-200 shrink-0 mt-1" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">🔴 Sudah Selesai</span>
                    <span className="text-xs bg-slate-200 text-slate-800 px-2.5 py-0.5 rounded-md font-bold">Kasir: Gusti</span>
                    <span className="text-[11px] text-slate-500">Tutup Kas Selesai</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1 font-medium">
                    <span>Jam Masuk: <strong className="font-mono">{todaySummary.checkIn ? new Date(todaySummary.checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : '-'} WIB</strong></span>
                    <span>Jam Pulang: <strong className="font-mono">{todaySummary.checkOut ? new Date(todaySummary.checkOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : '-'} WIB</strong></span>
                    <span>Kas Aktual: <strong className="font-mono text-slate-900 font-bold">{formatRupiah(todaySummary.actualCash || 0)}</strong></span>
                    <span>
                      Selisih:{' '}
                      <strong className={`font-mono font-black ${
                        (todaySummary.cashDifference || 0) === 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {(todaySummary.cashDifference || 0) === 0 ? 'Rp0 (Sesuai)' : formatRupiah(todaySummary.cashDifference)}
                      </strong>
                    </span>
                  </div>
                  {todaySummary.note && (
                    <p className="text-[11px] text-slate-500 italic mt-1 bg-white p-2 rounded-lg border border-slate-200">
                      Catatan: {todaySummary.note}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveTab('laporan')}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Detail Laporan
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── KASIR GUSTI: ATTENDANCE STATUS CARD (Prompt Section 8 & 12) ── */}
      {!isSuperAdmin && (
        <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-xs">
                POS
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  STATUS SHIFT KASIR
                </h2>
                <p className="text-xs text-slate-500">
                  Monitoring absensi dan terminal kasir {cashierName}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                refreshAttendance();
                fetchTodaySummary();
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
              title="Sinkronkan status dengan server"
            >
              <span>↻</span>
              <span>Refresh Status</span>
            </button>
          </div>

          {attendanceStatus === 'not_started' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-amber-50/70 border-2 border-dashed border-amber-300">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-200 text-amber-900 flex items-center justify-center text-xl shrink-0">
                  ⏳
                </div>
                <div>
                  <h3 className="font-extrabold text-amber-950 text-sm">
                    Hari Kerja Belum Dimulai
                  </h3>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Silakan lakukan <strong>Absen Masuk</strong> sebelum melayani transaksi penjualan. Modal kas awal otomatis disiapkan sebesar <strong>Rp500.000</strong>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCheckInModalOpen(true)}
                className="py-3 px-5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl font-bold text-xs shadow-md shadow-brand-600/20 shrink-0 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Mulai Bekerja (Absen Masuk)</span>
              </button>
            </div>
          )}

          {attendanceStatus === 'working' && (
            <div className="rounded-2xl bg-emerald-50/80 border border-emerald-300 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-200">
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-emerald-200 animate-pulse shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-emerald-950 text-base">SHIFT HARI INI</span>
                      <span className="text-xs bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-md font-bold">🟢 Sedang Bekerja</span>
                    </div>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Kasir: <strong className="text-slate-900">{cashierName}</strong> • Masuk: <strong className="font-mono">{checkInTimeFormatted} WIB</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setActiveTab('transaksi')}
                    className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    <span>Buka POS (F2)</span>
                  </button>
                  <button
                    onClick={() => setIsCheckOutModalOpen(true)}
                    className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>TUTUP KAS</span>
                  </button>
                </div>
              </div>

              {/* Grid 6 Angka Finansial Sesuai Step 12 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 text-xs">
                <div className="bg-white border border-emerald-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Modal Awal</span>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">{formatRupiah(attendance?.openingCash || 500000)}</div>
                </div>
                <div className="bg-white border border-emerald-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Total Transaksi</span>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">{todaySummary?.totalTransactions ?? todaySummary?.stats?.totalTransactions ?? attendance?.stats?.totalTransactions ?? completedTransactions.length}</div>
                </div>
                <div className="bg-white border border-emerald-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Penjualan</span>
                  <div className="font-mono font-black text-brand-600 mt-0.5">{formatRupiah(todaySummary?.revenueToday ?? totalRevenue)}</div>
                </div>
                <div className="bg-white border border-emerald-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Cash (Tunai)</span>
                  <div className="font-mono font-bold text-emerald-700 mt-0.5">{formatRupiah(todaySummary?.cashSales ?? attendance?.stats?.cashSales ?? 0)}</div>
                </div>
                <div className="bg-white border border-emerald-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Transfer</span>
                  <div className="font-mono font-bold text-sky-700 mt-0.5">{formatRupiah(todaySummary?.transferSales ?? attendance?.stats?.transferSales ?? 0)}</div>
                </div>
                <div className="bg-white border border-emerald-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">QRIS</span>
                  <div className="font-mono font-bold text-rose-700 mt-0.5">{formatRupiah(todaySummary?.qrisSales ?? attendance?.stats?.qrisSales ?? 0)}</div>
                </div>
                <div className="bg-emerald-600 text-white rounded-xl p-3 col-span-2 sm:col-span-1 shadow-xs">
                  <span className="text-[10px] font-bold text-emerald-100 uppercase">Kas Seharusnya</span>
                  <div className="font-mono font-black text-white mt-0.5 text-sm">{formatRupiah(todaySummary?.expectedCash ?? attendance?.expectedCash ?? 500000)}</div>
                </div>
              </div>
            </div>
          )}

          {attendanceStatus === 'completed' && (
            <div className="rounded-2xl bg-slate-900 text-white border border-slate-800 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-full bg-rose-500 ring-4 ring-rose-900 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white text-base">Tutup Kas Berhasil</span>
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-md font-bold uppercase">Status: CLOSED</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Kasir: <strong className="text-white">{cashierName}</strong> • Masuk: <strong className="font-mono text-slate-300">{checkInTimeFormatted} WIB</strong> • Pulang: <strong className="font-mono text-slate-300">{checkOutTimeFormatted} WIB</strong>
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-400 font-medium">
                  Sesi kasir hari ini telah selesai dan dikunci secara aman di database.
                </div>
              </div>

              {/* Grid Ringkasan Setelah Tutup Kas Sesuai Step 13 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs font-mono">
                <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                  <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">Modal</span>
                  <div className="font-bold text-white mt-0.5">{formatRupiah(todaySummary?.openingCash ?? attendance?.openingCash ?? 500000)}</div>
                </div>
                <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                  <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">Penjualan</span>
                  <div className="font-bold text-brand-400 mt-0.5">{formatRupiah(todaySummary?.revenueToday ?? attendance?.stats?.totalRevenue ?? 0)}</div>
                </div>
                <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                  <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">Cash</span>
                  <div className="font-bold text-emerald-400 mt-0.5">{formatRupiah(todaySummary?.cashSales ?? attendance?.stats?.cashSales ?? 0)}</div>
                </div>
                <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                  <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">Transfer</span>
                  <div className="font-bold text-sky-400 mt-0.5">{formatRupiah(todaySummary?.transferSales ?? attendance?.stats?.transferSales ?? 0)}</div>
                </div>
                <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                  <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">QRIS</span>
                  <div className="font-bold text-rose-400 mt-0.5">{formatRupiah(todaySummary?.qrisSales ?? attendance?.stats?.qrisSales ?? 0)}</div>
                </div>
                <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                  <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">Kas Seharusnya</span>
                  <div className="font-bold text-emerald-300 mt-0.5">{formatRupiah(todaySummary?.expectedCash ?? attendance?.expectedCash ?? 500000)}</div>
                </div>
                <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                  <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">Kas Aktual</span>
                  <div className="font-bold text-amber-300 mt-0.5">{formatRupiah(todaySummary?.actualCash ?? attendance?.actualCash ?? 0)}</div>
                </div>
                <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                  <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">Selisih</span>
                  <div className={`font-bold mt-0.5 ${
                    (todaySummary?.cashDifference ?? attendance?.cashDifference ?? 0) === 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {(todaySummary?.cashDifference ?? attendance?.cashDifference ?? 0) === 0 
                      ? 'Rp0' 
                      : ((todaySummary?.cashDifference ?? attendance?.cashDifference ?? 0) > 0 ? '+' : '') + formatRupiah(todaySummary?.cashDifference ?? attendance?.cashDifference ?? 0)}
                  </div>
                </div>
              </div>

              {(todaySummary?.note || attendance?.note) && (
                <div className="text-xs bg-slate-800/60 border border-slate-700 p-3 rounded-xl text-slate-300">
                  <span className="text-slate-400 font-bold">Keterangan Kasir: </span>
                  {todaySummary?.note || attendance?.note}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Omset */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {isSuperAdmin ? 'Total Omset Toko' : 'Omset Shift Ini'}
            </span>
            <div className="text-xl font-black font-mono text-slate-900 mt-1">
              {formatRupiah(totalRevenue)}
            </div>
            <span className="text-[10px] text-brand-600 font-semibold mt-0.5 inline-block">
              {completedTransactions.length} transaksi lunas {isSuperAdmin ? '(Semua)' : 'shift ini'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Transaksi Berhasil */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {isSuperAdmin ? 'Total Transaksi Lunas' : 'Transaksi Lunas Shift Ini'}
            </span>
            <div className="text-xl font-black font-mono text-slate-900 mt-1">
              {completedTransactions.length}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 inline-block">
              {isSuperAdmin ? 'Seluruh riwayat sesi' : 'Shift aktif saat ini'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Menunggu Konfirmasi */}
        <div className={`p-5 rounded-2xl border shadow-xs flex items-center justify-between transition-colors ${
          pendingConfirmations.length > 0
            ? 'bg-amber-50/70 border-amber-300'
            : 'bg-white border-slate-200'
        }`}>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Perlu Konfirmasi</span>
            <div className={`text-xl font-black font-mono mt-1 ${pendingConfirmations.length > 0 ? 'text-amber-800' : 'text-slate-900'}`}>
              {pendingConfirmations.length}
            </div>
            <span className={`text-[10px] font-semibold mt-0.5 inline-block ${pendingConfirmations.length > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
              {pendingConfirmations.length > 0 ? 'Cek bukti transfer segera' : 'Semua pembayaran tuntas'}
            </span>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            pendingConfirmations.length > 0 ? 'bg-amber-200 text-amber-900 animate-pulse' : 'bg-slate-100 text-slate-500'
          }`}>
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Stok Rendah */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Peringatan Stok</span>
            <div className={`text-xl font-black font-mono mt-1 ${lowStockProducts.length > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {lowStockProducts.length} Produk
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 inline-block">
              Stok &lt;= 5 unit tersisa
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Row: Antrean Pembayaran Transfer (Perlu Konfirmasi) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Antrean Konfirmasi Pembayaran Transfer & QRIS
              </h2>
              <p className="text-xs text-slate-500">
                Kasir memeriksa foto bukti transfer dan memvalidasi sebelum status diubah menjadi Lunas.
              </p>
            </div>
          </div>

          <span className="text-xs font-bold px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
            {pendingConfirmations.length} Menunggu Verifikasi
          </span>
        </div>

        {pendingConfirmations.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
            <p className="font-semibold text-slate-700">Tidak ada antrean pembayaran transfer!</p>
            <p className="mt-0.5">Semua transaksi pembayaran telah selesai diverifikasi oleh kasir.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingConfirmations.map((tx) => (
              <div
                key={tx.id}
                className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/30 flex flex-col justify-between gap-3 transition-all hover:border-amber-300 shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-900">{tx.invoiceNumber}</span>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {formatDateTime(tx.date)} • Kasir: {tx.cashierName}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black font-mono text-brand-700">{formatRupiah(tx.total)}</span>
                      <div className="text-[10px] text-slate-500">{tx.items.length} macam barang</div>
                    </div>
                  </div>

                  {/* Channel / Bank info */}
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-700 font-medium">
                    <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                    <span>{tx.transferBank || 'Transfer Bank / QRIS'}</span>
                  </div>

                  {/* Items preview snippet */}
                  <div className="mt-2 text-xs text-slate-600 line-clamp-1 bg-white/70 p-1.5 rounded-lg border border-amber-100">
                    {tx.items.map(it => `${it.name} (${it.quantity})`).join(', ')}
                  </div>
                </div>

                {/* Proof thumbnail & Confirmation Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-amber-200/80">
                  {tx.transferProofUrl && (
                    <button
                      onClick={() => setPreviewProof(tx.transferProofUrl || null)}
                      className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                      title="Perbesar Bukti Transfer"
                    >
                      <Eye className="w-3.5 h-3.5 text-brand-600" />
                      <span>Cek Bukti</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      onClick={async () => {
                        if (cancellingId === tx.id) return;
                        if (confirm(`Batalkan transaksi ${tx.invoiceNumber}? Stok produk akan dikembalikan.`)) {
                          setCancellingId(tx.id);
                          const result = await cancelTransaction(tx.id);
                          setCancellingId(null);
                          if (!result.success) {
                            alert(result.error || 'Transaksi gagal dibatalkan.');
                          }
                        }
                      }}
                      disabled={cancellingId === tx.id}
                      className="py-1.5 px-3 rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancellingId === tx.id ? 'Membatalkan...' : 'Tolak'}
                    </button>

                    <button
                      onClick={() => confirmTransferPayment(tx.id)}
                      className="py-1.5 px-4 rounded-xl bg-brand-600 text-white hover:bg-brand-700 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Konfirmasi Lunas</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Row: Low Stock Warning */}
      {lowStockProducts.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <h3 className="font-bold text-sm text-slate-900">
              Peringatan Stok Kritis (Segera Restock)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {lowStockProducts.map((p) => (
              <div
                key={p.id}
                className="p-3.5 rounded-xl border border-rose-100 bg-rose-50/40 flex items-center justify-between gap-2"
              >
                <div>
                  <h4 className="font-bold text-xs text-slate-800 leading-snug truncate max-w-[180px]">
                    {p.name}
                  </h4>
                  <div className="text-[10px] text-rose-700 font-bold mt-0.5">
                    Sisa stok: {p.stock} {p.unit}
                  </div>
                </div>

                {isSuperAdmin ? (
                  <button
                    onClick={() => updateProduct(p.id, { stock: p.stock + 10 })}
                    className="py-1 px-2.5 rounded-lg bg-white border border-rose-200 text-slate-700 text-[11px] font-bold hover:bg-rose-100 transition-colors shadow-2xs whitespace-nowrap"
                    title="Tambah 10 unit ke stok"
                  >
                    +10 Stok
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium italic">
                    Perlu Super Admin
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proof Image Preview Modal */}
      {previewProof && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold">Pratinjau Bukti Transfer Pelanggan</span>
              <button onClick={() => setPreviewProof(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-100 flex items-center justify-center">
              <img src={previewProof} alt="Bukti Transfer" className="max-h-[60vh] object-contain rounded-lg shadow-sm" />
            </div>
            <div className="p-3 bg-white border-t border-slate-200 text-right">
              <button
                onClick={() => setPreviewProof(null)}
                className="py-1.5 px-4 bg-slate-900 text-white rounded-xl text-xs font-semibold"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};
