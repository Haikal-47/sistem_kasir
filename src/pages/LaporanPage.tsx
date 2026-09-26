import React, { useState, useMemo } from 'react';
import { usePOS } from '../context/POSContext';
import { formatRupiah, formatDateTime } from '../utils/formatters';
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
  Download
} from 'lucide-react';

export const LaporanPage: React.FC = () => {
  const { transactions } = usePOS();

  const [periodFilter, setPeriodFilter] = useState<'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Calculate filtered transactions based on date
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday start
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return transactions.filter(t => {
      if (t.status === 'BATAL') return false; // exclude cancelled
      const tDate = new Date(t.date);
      const tDateStr = t.date.slice(0, 10);

      if (periodFilter === 'TODAY') {
        return tDateStr === todayStr;
      }
      if (periodFilter === 'YESTERDAY') {
        return tDateStr === yesterdayStr;
      }
      if (periodFilter === 'THIS_WEEK') {
        return tDate >= startOfWeek;
      }
      if (periodFilter === 'THIS_MONTH') {
        return tDate >= startOfMonth;
      }
      if (periodFilter === 'CUSTOM') {
        return tDateStr >= customStartDate && tDateStr <= customEndDate;
      }
      return true;
    });
  }, [transactions, periodFilter, customStartDate, customEndDate]);

  // Aggregate metrics
  const totalRevenue = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + t.total, 0);
  }, [filteredTransactions]);

  const totalTransactionCount = filteredTransactions.length;

  const totalItemsSold = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => {
      const itemsCount = t.items.reduce((iSum, it) => iSum + it.quantity, 0);
      return sum + itemsCount;
    }, 0);
  }, [filteredTransactions]);

  const averageTransactionValue = totalTransactionCount > 0 ? totalRevenue / totalTransactionCount : 0;

  // Breakdown by Payment Method
  const paymentMethodBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    filteredTransactions.forEach(t => {
      const method = t.paymentMethod || 'Lainnya';
      if (!map[method]) map[method] = { count: 0, total: 0 };
      map[method].count += 1;
      map[method].total += t.total;
    });
    return Object.entries(map).map(([name, stat]) => ({
      name,
      count: stat.count,
      total: stat.total,
      percentage: totalRevenue > 0 ? (stat.total / totalRevenue) * 100 : 0
    })).sort((a, b) => b.total - a.total);
  }, [filteredTransactions, totalRevenue]);

  // Breakdown by Cashier
  const cashierBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    filteredTransactions.forEach(t => {
      const c = t.cashierName || 'Kasir';
      if (!map[c]) map[c] = { count: 0, total: 0 };
      map[c].count += 1;
      map[c].total += t.total;
    });
    return Object.entries(map).map(([name, stat]) => ({
      name,
      count: stat.count,
      total: stat.total,
      percentage: totalRevenue > 0 ? (stat.total / totalRevenue) * 100 : 0
    })).sort((a, b) => b.total - a.total);
  }, [filteredTransactions, totalRevenue]);

  // Top Selling Products
  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; brand: string; quantity: number; revenue: number }> = {};
    filteredTransactions.forEach(t => {
      t.items.forEach(it => {
        const key = it.productId || it.name;
        if (!map[key]) {
          map[key] = {
            name: it.name,
            brand: it.brand || 'ARFA FASHION',
            quantity: 0,
            revenue: 0
          };
        }
        map[key].quantity += it.quantity;
        map[key].revenue += it.subtotal;
      });
    });
    return Object.values(map).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  }, [filteredTransactions]);

  const handleExportCSV = () => {
    const headers = ['No. Invoice', 'Tanggal & Waktu', 'Kasir', 'Metode Bayar', 'Total (Rp)', 'Status'];
    const rows = filteredTransactions.map(t => [
      t.invoiceNumber,
      formatDateTime(t.date),
      t.cashierName,
      t.paymentMethod,
      t.total,
      t.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Penjualan_ARFA_${periodFilter}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
      
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-800">
                Laporan &amp; Ringkasan Penjualan
              </h1>
              <p className="text-xs text-slate-500">
                Analisis omset penjualan toko, produk terlaris, metode pembayaran, dan produktivitas kasir.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Period Buttons */}
        <div className="flex flex-wrap items-center gap-2">
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
                periodFilter === f.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs transition-colors ml-1"
            title="Download laporan penjualan dalam format CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {periodFilter === 'CUSTOM' && (
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-600">Dari Tanggal:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-medium outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Sampai:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-medium outline-none"
            />
          </div>
        </div>
      )}

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Penjualan / Omset */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Omset Penjualan</span>
            <div className="text-2xl font-black font-mono text-brand-600 mt-1">
              {formatRupiah(totalRevenue)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 inline-block">
              Berdasarkan periode terpilih
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Jumlah Transaksi */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Jumlah Transaksi</span>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1">
              {totalTransactionCount}
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 inline-block">
              Struk nota terbit
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* Produk Terjual */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Produk Terjual (Qty)</span>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1">
              {totalItemsSold} <span className="text-sm font-bold text-slate-500">Pcs</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 inline-block">
              Total kuantitas item keluar
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Nilai Rata-rata per Struk */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rata-rata per Nota (AOV)</span>
            <div className="text-xl font-black font-mono text-slate-900 mt-1">
              {formatRupiah(averageTransactionValue)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 inline-block">
              Keranjang rata-rata pelanggan
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Top Selling Products & Payment Methods / Cashier Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top 10 Produk Terlaris (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-base text-slate-900">
                10 Produk Fashion Paling Banyak Terjual
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">Berdasarkan Qty Terjual</span>
          </div>

          {topProducts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Belum ada penjualan produk pada rentang waktu ini.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {topProducts.map((p, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold font-mono text-xs shrink-0 ${
                      idx === 0 ? 'bg-amber-100 text-amber-800' :
                      idx === 1 ? 'bg-slate-200 text-slate-700' :
                      idx === 2 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {idx + 1}
                    </span>
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

        {/* Right Column: Breakdown Metode Bayar & Kasir (1 Col) */}
        <div className="space-y-6">
          
          {/* Breakdown Metode Pembayaran */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-sky-600" />
              <h2 className="font-bold text-sm text-slate-900">
                Penjualan Berdasarkan Metode
              </h2>
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
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                      <div
                        className="bg-brand-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pm.percentage}%` }}
                      />
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

          {/* Breakdown Kasir */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-sm text-slate-900">
                Penjualan Berdasarkan Kasir
              </h2>
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
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${c.percentage}%` }}
                      />
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

    </div>
  );
};
