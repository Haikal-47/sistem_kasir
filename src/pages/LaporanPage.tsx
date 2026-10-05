import React, { useState, useEffect, useMemo } from 'react';
import { usePOS } from '../context/POSContext';
import { formatRupiah, formatDateTime } from '../utils/formatters';
import { CashierAttendance } from '../types';
import { 
  BarChart3, 
  TrendingUp, 
  ShoppingBag, 
  CreditCard, 
  UserCheck, 
  Calendar, 
  ArrowUpRight, 
  Layers, 
  Crown,
  FileSpreadsheet,
  Download,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  Smartphone,
  AlertCircle,
  Receipt,
  LogIn,
  LogOut
} from 'lucide-react';

export const LaporanPage: React.FC = () => {
  const { transactions, authToken } = usePOS();

  const [activeTab, setActiveTab] = useState<'penjualan' | 'absensi'>('penjualan');

  // ── Penjualan filter state
  const [periodFilter, setPeriodFilter] = useState<'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // ── Absensi filter state
  const [absensiStart, setAbsensiStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [absensiEnd, setAbsensiEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [attendances, setAttendances] = useState<CashierAttendance[]>([]);
  const [isLoadingAbsensi, setIsLoadingAbsensi] = useState<boolean>(false);
  const [absensiError, setAbsensiError] = useState<string | null>(null);

  const fetchAttendanceLaporan = async () => {
    setIsLoadingAbsensi(true);
    setAbsensiError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch(`/api/attendance/laporan?startDate=${absensiStart}&endDate=${absensiEnd}`, { headers });
      if (!res.ok) {
        const d = await res.json();
        setAbsensiError(d.error || 'Gagal memuat laporan absensi.');
        return;
      }
      const data = await res.json();
      setAttendances(data.attendances || []);
    } catch (err: any) {
      setAbsensiError('Gagal terhubung ke server. Periksa koneksi internet.');
    } finally {
      setIsLoadingAbsensi(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'absensi') {
      fetchAttendanceLaporan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ─── Penjualan computations ─────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return transactions.filter(t => {
      if (t.status === 'BATAL') return false;
      const tDate = new Date(t.date);
      const tDateStr = t.date.slice(0, 10);

      if (periodFilter === 'TODAY') return tDateStr === todayStr;
      if (periodFilter === 'YESTERDAY') return tDateStr === yesterdayStr;
      if (periodFilter === 'THIS_WEEK') return tDate >= startOfWeek;
      if (periodFilter === 'THIS_MONTH') return tDate >= startOfMonth;
      if (periodFilter === 'CUSTOM') return tDateStr >= customStartDate && tDateStr <= customEndDate;
      return true;
    });
  }, [transactions, periodFilter, customStartDate, customEndDate]);

  const totalRevenue = useMemo(() => filteredTransactions.reduce((s, t) => s + t.total, 0), [filteredTransactions]);
  const totalTransactionCount = filteredTransactions.length;
  const totalItemsSold = useMemo(() => filteredTransactions.reduce((s, t) => s + t.items.reduce((is, it) => is + it.quantity, 0), 0), [filteredTransactions]);
  const averageTransactionValue = totalTransactionCount > 0 ? totalRevenue / totalTransactionCount : 0;

  const paymentMethodBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    filteredTransactions.forEach(t => {
      const method = t.paymentMethod || 'Lainnya';
      if (!map[method]) map[method] = { count: 0, total: 0 };
      map[method].count += 1;
      map[method].total += t.total;
    });
    return Object.entries(map).map(([name, stat]) => ({
      name, count: stat.count, total: stat.total,
      percentage: totalRevenue > 0 ? (stat.total / totalRevenue) * 100 : 0
    })).sort((a, b) => b.total - a.total);
  }, [filteredTransactions, totalRevenue]);

  const cashierBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    filteredTransactions.forEach(t => {
      const c = t.cashierName || 'Kasir';
      if (!map[c]) map[c] = { count: 0, total: 0 };
      map[c].count += 1;
      map[c].total += t.total;
    });
    return Object.entries(map).map(([name, stat]) => ({
      name, count: stat.count, total: stat.total,
      percentage: totalRevenue > 0 ? (stat.total / totalRevenue) * 100 : 0
    })).sort((a, b) => b.total - a.total);
  }, [filteredTransactions, totalRevenue]);

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; brand: string; quantity: number; revenue: number }> = {};
    filteredTransactions.forEach(t => {
      t.items.forEach(it => {
        const key = it.productId || it.name;
        if (!map[key]) map[key] = { name: it.name, brand: it.brand || 'ARFA FASHION', quantity: 0, revenue: 0 };
        map[key].quantity += it.quantity;
        map[key].revenue += it.subtotal;
      });
    });
    return Object.values(map).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  }, [filteredTransactions]);

  const handleExportCSV = () => {
    const headers = ['No. Invoice', 'Tanggal & Waktu', 'Kasir', 'Metode Bayar', 'Total (Rp)', 'Status'];
    const rows = filteredTransactions.map(t => [
      t.invoiceNumber, formatDateTime(t.date), t.cashierName, t.paymentMethod, t.total, t.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Penjualan_ARFA_${periodFilter}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAbsensiCSV = () => {
    const headers = [
      'Tanggal', 'Kasir', 'Jam Masuk', 'Jam Pulang', 'Modal Awal', 
      'Total Transaksi', 'Total Penjualan', 'Cash (Tunai)', 'Transfer', 'QRIS', 
      'Kas Seharusnya', 'Kas Aktual', 'Selisih', 'Status', 'Catatan'
    ];
    const rows = attendances.map(a => [
      a.date,
      a.cashierName,
      a.checkIn ? new Date(a.checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : '-',
      a.checkOut ? new Date(a.checkOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : '-',
      a.openingCash,
      a.stats?.totalTransactions ?? 0,
      a.stats?.totalRevenue ?? 0,
      a.stats?.cashSales ?? 0,
      a.stats?.transferSales ?? 0,
      a.stats?.qrisSales ?? 0,
      a.expectedCash ?? (a.stats?.expectedCash ?? ''),
      a.actualCash ?? '',
      a.cashDifference ?? '',
      a.status === 'completed' ? 'Selesai' : a.status === 'working' ? 'Sedang Bekerja' : 'Belum Masuk',
      `"${(a.note ?? '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Tutup_Kas_ARFA_${absensiStart}_${absensiEnd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
      
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-800">
              Laporan &amp; Ringkasan
            </h1>
            <p className="text-xs text-slate-500">
              Analisis penjualan, absensi kasir, dan kas harian ARFA FASHION.
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1">
          <button
            onClick={() => setActiveTab('penjualan')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'penjualan' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Penjualan
          </button>
          <button
            onClick={() => setActiveTab('absensi')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'absensi' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Absensi Kasir
          </button>
        </div>
      </div>

      {/* ─────────────── TAB: PENJUALAN ─────────────── */}
      {activeTab === 'penjualan' && (
        <>
          {/* Filter Period Buttons */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center gap-2 shadow-2xs">
            {[
              { key: 'TODAY', label: 'Hari Ini' },
              { key: 'YESTERDAY', label: 'Kemarin' },
              { key: 'THIS_WEEK', label: 'Minggu Ini' },
              { key: 'THIS_MONTH', label: 'Bulan Ini' },
              { key: 'CUSTOM', label: 'Custom' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setPeriodFilter(f.key as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  periodFilter === f.key ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs transition-colors ml-auto"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>

          {/* Custom Date Range */}
          {periodFilter === 'CUSTOM' && (
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-600">Dari:</span>
                <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-medium outline-none" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Sampai:</span>
                <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-medium outline-none" />
              </div>
            </div>
          )}

          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Omset</span>
                <div className="text-2xl font-black font-mono text-brand-600 mt-1">{formatRupiah(totalRevenue)}</div>
                <span className="text-[10px] text-slate-400">Berdasarkan periode</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center"><TrendingUp className="w-6 h-6" /></div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Jumlah Transaksi</span>
                <div className="text-2xl font-black font-mono text-slate-900 mt-1">{totalTransactionCount}</div>
                <span className="text-[10px] text-emerald-600 font-semibold">Struk nota terbit</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><ShoppingBag className="w-6 h-6" /></div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Produk Terjual (Qty)</span>
                <div className="text-2xl font-black font-mono text-slate-900 mt-1">{totalItemsSold} <span className="text-sm font-bold text-slate-500">Pcs</span></div>
                <span className="text-[10px] text-slate-400">Total kuantitas keluar</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center"><Layers className="w-6 h-6" /></div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rata-rata per Nota (AOV)</span>
                <div className="text-xl font-black font-mono text-slate-900 mt-1">{formatRupiah(averageTransactionValue)}</div>
                <span className="text-[10px] text-slate-400">Keranjang rata-rata</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center"><ArrowUpRight className="w-6 h-6" /></div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500" />
                  <h2 className="font-bold text-base text-slate-900">10 Produk Fashion Paling Banyak Terjual</h2>
                </div>
                <span className="text-xs text-slate-400 font-medium">Berdasarkan Qty</span>
              </div>
              {topProducts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">Belum ada penjualan pada rentang waktu ini.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {topProducts.map((p, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold font-mono text-xs shrink-0 ${
                          idx === 0 ? 'bg-amber-100 text-amber-800' : idx === 1 ? 'bg-slate-200 text-slate-700' : idx === 2 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-500'
                        }`}>{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 leading-tight truncate">{p.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{p.brand}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold font-mono text-slate-900 text-sm">{p.quantity} Pcs</span>
                        <p className="text-[11px] text-brand-600 font-mono font-medium">{formatRupiah(p.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-sky-600" />
                  <h2 className="font-bold text-sm text-slate-900">Penjualan Berdasarkan Metode</h2>
                </div>
                {paymentMethodBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-400">Belum ada transaksi.</p>
                ) : (
                  <div className="space-y-3">
                    {paymentMethodBreakdown.map((pm, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-700">{pm.name}</span>
                          <span className="font-mono font-bold text-slate-900">{formatRupiah(pm.total)}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-brand-500 h-full rounded-full transition-all duration-500" style={{ width: `${pm.percentage}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>{pm.count} transaksi</span>
                          <span>{pm.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-bold text-sm text-slate-900">Penjualan Berdasarkan Kasir</h2>
                </div>
                {cashierBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-400">Belum ada data kasir.</p>
                ) : (
                  <div className="space-y-3">
                    {cashierBreakdown.map((c, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-700">{c.name}</span>
                          <span className="font-mono font-bold text-slate-900">{formatRupiah(c.total)}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${c.percentage}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>{c.count} transaksi</span>
                          <span>{c.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ─────────────── TAB: ABSENSI KASIR ─────────────── */}
      {activeTab === 'absensi' && (
        <>
          {/* Filter */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center gap-3 shadow-2xs">
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-600">Dari:</span>
              <input type="date" value={absensiStart} onChange={e => setAbsensiStart(e.target.value)} className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-medium outline-none text-xs" />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600">Sampai:</span>
              <input type="date" value={absensiEnd} onChange={e => setAbsensiEnd(e.target.value)} className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-medium outline-none text-xs" />
            </div>
            <button
              onClick={fetchAttendanceLaporan}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Tampilkan
            </button>
            {attendances.length > 0 && (
              <button
                onClick={handleExportAbsensiCSV}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs transition-colors ml-auto"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>
            )}
          </div>

          {/* Error */}
          {absensiError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{absensiError}</span>
            </div>
          )}

          {/* Loading */}
          {isLoadingAbsensi && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            </div>
          )}

          {/* No data */}
          {!isLoadingAbsensi && !absensiError && attendances.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <UserCheck className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="font-bold text-slate-700 text-base">Belum Ada Data Absensi</h3>
              <p className="text-xs text-slate-400 mt-1">Tidak ada rekaman absensi kasir pada rentang tanggal yang dipilih.</p>
            </div>
          )}

          {/* Attendance Cards */}
          {!isLoadingAbsensi && attendances.length > 0 && (
            <div className="space-y-4">
              {/* Summary row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Hari Kerja</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{attendances.length}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-xs text-center">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Selesai</p>
                  <p className="text-2xl font-black text-emerald-800 mt-1">{attendances.filter(a => a.status === 'completed').length}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-xs text-center">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Sedang Bekerja</p>
                  <p className="text-2xl font-black text-amber-800 mt-1">{attendances.filter(a => a.status === 'working').length}</p>
                </div>
                <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 shadow-xs text-center">
                  <p className="text-[10px] font-bold text-brand-700 uppercase tracking-wider">Total Omset</p>
                  <p className="text-lg font-black text-brand-800 mt-1 font-mono">{formatRupiah(attendances.reduce((s, a) => s + (a.stats?.totalRevenue ?? 0), 0))}</p>
                </div>
              </div>

              {/* Attendance table */}
              <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                  <h2 className="font-bold text-sm text-slate-900">Riwayat Absensi Kasir Gusti</h2>
                  <span className="ml-auto text-xs text-slate-400">{attendances.length} hari kerja</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Tanggal &amp; Kasir</th>
                        <th className="text-right px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Modal</th>
                        <th className="text-center px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Transaksi</th>
                        <th className="text-right px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Penjualan</th>
                        <th className="text-right px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Cash</th>
                        <th className="text-right px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Transfer</th>
                        <th className="text-right px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">QRIS</th>
                        <th className="text-right px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Kas Seharusnya</th>
                        <th className="text-right px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Kas Aktual</th>
                        <th className="text-right px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Selisih</th>
                        <th className="text-center px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {attendances.map((att) => {
                        const diff = att.cashDifference;
                        const expectedCash = att.expectedCash ?? att.stats?.expectedCash;
                        const cashSales = att.stats?.cashSales ?? 0;
                        const transferSales = att.stats?.transferSales ?? 0;
                        const qrisSales = att.stats?.qrisSales ?? 0;
                        const totalTransactions = att.stats?.totalTransactions ?? 0;
                        const totalRevenue = att.stats?.totalRevenue ?? 0;

                        return (
                          <tr key={att.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-slate-900">{att.date}</div>
                              <div className="text-[10px] text-slate-400 font-medium">Kasir: {att.cashierName}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {att.checkIn ? new Date(att.checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : '-'}
                                {att.checkOut ? ` - ${new Date(att.checkOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}` : ' (Aktif)'}
                              </div>
                            </td>
                            <td className="px-3 py-3.5 text-right font-mono text-slate-700">{formatRupiah(att.openingCash)}</td>
                            <td className="px-3 py-3.5 text-center font-mono font-bold text-slate-800">{totalTransactions}</td>
                            <td className="px-3 py-3.5 text-right font-mono font-bold text-brand-600">{formatRupiah(totalRevenue)}</td>
                            <td className="px-3 py-3.5 text-right font-mono font-bold text-emerald-700">{formatRupiah(cashSales)}</td>
                            <td className="px-3 py-3.5 text-right font-mono font-bold text-sky-700">{formatRupiah(transferSales)}</td>
                            <td className="px-3 py-3.5 text-right font-mono font-bold text-rose-700">{formatRupiah(qrisSales)}</td>
                            <td className="px-3 py-3.5 text-right font-mono font-bold text-slate-900">{expectedCash != null ? formatRupiah(expectedCash) : '-'}</td>
                            <td className="px-3 py-3.5 text-right font-mono font-bold text-amber-700">{att.actualCash != null ? formatRupiah(att.actualCash) : '-'}</td>
                            <td className="px-3 py-3.5 text-right">
                              {diff == null ? (
                                <span className="text-slate-400">-</span>
                              ) : diff === 0 ? (
                                <span className="text-emerald-600 font-bold font-mono">Rp0</span>
                              ) : (
                                <span className={`font-bold font-mono ${diff < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                                  {diff < 0 ? '−' : '+'}{formatRupiah(Math.abs(diff))}
                                </span>
                              )}
                              {att.note && (
                                <div className="text-[10px] text-slate-400 max-w-32 truncate mt-0.5" title={att.note}>{att.note}</div>
                              )}
                            </td>
                            <td className="px-3 py-3.5 text-center">
                              {att.status === 'completed' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                  <CheckCircle2 className="w-3 h-3" /> Selesai
                                </span>
                              ) : att.status === 'working' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                                  <Clock className="w-3 h-3" /> Bekerja
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                  Belum Masuk
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
