import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { Product, ProductVariant } from '../types';
import { 
  Boxes, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Edit3, 
  RefreshCw, 
  Layers, 
  Palette, 
  Ruler, 
  Barcode, 
  X, 
  Check, 
  ShieldAlert,
  ArrowUpDown
} from 'lucide-react';

export const StokPage: React.FC = () => {
  const { products, adjustStock, adjustVariantStock, isSuperAdmin, storeSettings } = usePOS();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Semua');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'LOW' | 'OUT'>('ALL');

  // Modal State for stock adjustments
  const [adjustModal, setAdjustModal] = useState<{
    product: Product;
    variant?: ProductVariant;
    mode: 'restock' | 'adjust';
  } | null>(null);

  const [inputDelta, setInputDelta] = useState<number>(10);
  const [inputExact, setInputExact] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Stock Opname Fisik');

  const minStockThreshold = storeSettings.minStockAlert || 5;

  const categories = ['Semua', ...Array.from(new Set(products.map(p => p.category)))];

  // Flatten products with their variants for granular stock tracking
  interface FlatStockItem {
    productId: string;
    productName: string;
    brand: string;
    category: string;
    barcode: string;
    unit: string;
    variantId?: string;
    color?: string;
    size?: string;
    sku?: string;
    stock: number;
    parentProduct: Product;
    rawVariant?: ProductVariant;
  }

  const allStockItems: FlatStockItem[] = [];

  products.forEach(p => {
    if (p.variants && p.variants.length > 0) {
      p.variants.forEach(v => {
        allStockItems.push({
          productId: p.id,
          productName: p.name,
          brand: p.brand,
          category: p.category,
          barcode: p.barcode,
          unit: p.unit,
          variantId: v.id,
          color: v.color,
          size: v.size,
          sku: v.sku,
          stock: v.stock,
          parentProduct: p,
          rawVariant: v,
        });
      });
    } else {
      allStockItems.push({
        productId: p.id,
        productName: p.name,
        brand: p.brand,
        category: p.category,
        barcode: p.barcode,
        unit: p.unit,
        stock: p.stock,
        parentProduct: p,
      });
    }
  });

  // Calculate metrics
  const totalStockUnits = allStockItems.reduce((sum, item) => sum + item.stock, 0);
  const outOfStockCount = allStockItems.filter(item => item.stock <= 0).length;
  const lowStockCount = allStockItems.filter(item => item.stock > 0 && item.stock <= minStockThreshold).length;
  const healthyStockCount = allStockItems.filter(item => item.stock > minStockThreshold).length;

  // Filtered List
  const filteredItems = allStockItems.filter(item => {
    const matchesCat = categoryFilter === 'Semua' || item.category === categoryFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      item.productName.toLowerCase().includes(q) ||
      item.brand.toLowerCase().includes(q) ||
      item.barcode.includes(q) ||
      (item.sku && item.sku.toLowerCase().includes(q)) ||
      (item.color && item.color.toLowerCase().includes(q)) ||
      (item.size && item.size.toLowerCase().includes(q));

    let matchesStatus = true;
    if (stockStatusFilter === 'AVAILABLE') matchesStatus = item.stock > minStockThreshold;
    else if (stockStatusFilter === 'LOW') matchesStatus = item.stock > 0 && item.stock <= minStockThreshold;
    else if (stockStatusFilter === 'OUT') matchesStatus = item.stock <= 0;

    return matchesCat && matchesSearch && matchesStatus;
  });

  const handleOpenRestock = (item: FlatStockItem) => {
    setInputDelta(10);
    setAdjustModal({
      product: item.parentProduct,
      variant: item.rawVariant,
      mode: 'restock'
    });
  };

  const handleOpenAdjust = (item: FlatStockItem) => {
    setInputExact(item.stock);
    setAdjustReason('Stock Opname Fisik');
    setAdjustModal({
      product: item.parentProduct,
      variant: item.rawVariant,
      mode: 'adjust'
    });
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModal) return;
    const { product, variant, mode } = adjustModal;

    if (mode === 'restock') {
      const delta = Number(inputDelta) || 0;
      if (delta <= 0) {
        alert('Jumlah restock harus lebih dari 0.');
        return;
      }
      if (variant) {
        adjustVariantStock(product.id, variant.id, variant.stock + delta);
      } else {
        adjustStock(product.id, delta);
      }
    } else {
      const exact = Math.max(0, Number(inputExact) || 0);
      if (variant) {
        adjustVariantStock(product.id, variant.id, exact);
      } else {
        const delta = exact - product.stock;
        adjustStock(product.id, delta);
      }
    }

    setAdjustModal(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden">
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-800">
              Pengelolaan Persediaan &amp; Stok Varian
            </h1>
            <p className="text-xs text-slate-500">
              Pantau ketersediaan per kombinasi warna &amp; ukuran, restock, serta lakukan stock opname.
            </p>
          </div>
        </div>

        {!isSuperAdmin && (
          <div className="py-2 px-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <span>Mode Lihat Saja (Role: Kasir)</span>
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="p-6 pb-2 grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Stok Fisik</p>
            <p className="text-xl font-extrabold text-slate-800 font-mono">{totalStockUnits} <span className="text-xs font-normal text-slate-500">Pcs</span></p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Stok Tersedia</p>
            <p className="text-xl font-extrabold text-emerald-700 font-mono">{healthyStockCount} <span className="text-xs font-normal text-slate-500">varian</span></p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Stok Menipis (&le;{minStockThreshold})</p>
            <p className="text-xl font-extrabold text-amber-700 font-mono">{lowStockCount} <span className="text-xs font-normal text-slate-500">varian</span></p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600">Stok Habis</p>
            <p className="text-xl font-extrabold text-rose-700 font-mono">{outOfStockCount} <span className="text-xs font-normal text-slate-500">varian</span></p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { key: 'ALL', label: `Semua Varian (${allStockItems.length})` },
            { key: 'AVAILABLE', label: `Tersedia (${healthyStockCount})` },
            { key: 'LOW', label: `Menipis (${lowStockCount})` },
            { key: 'OUT', label: `Habis (${outOfStockCount})` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStockStatusFilter(f.key as any)}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap ${
                stockStatusFilter === f.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}

          <div className="h-4 w-px bg-slate-200 mx-1" />

          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 outline-none shadow-2xs"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, SKU, warna, ukuran..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 focus:border-brand-600 rounded-xl text-xs text-slate-800 outline-none shadow-2xs"
          />
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="flex-1 px-6 pb-6 overflow-hidden">
        <div className="h-full bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-5">Produk Fashion</th>
                  <th className="py-3 px-4">SKU &amp; Barcode</th>
                  <th className="py-3 px-4">Varian (Warna &bull; Ukuran)</th>
                  <th className="py-3 px-4">Stok Saat Ini</th>
                  <th className="py-3 px-4">Status Stok</th>
                  <th className="py-3 px-5 text-right">Aksi Persediaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-700">Tidak ada stok yang cocok dengan filter</p>
                      <p className="text-[11px] text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau kategori.</p>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const isOut = item.stock <= 0;
                    const isLow = item.stock > 0 && item.stock <= minStockThreshold;

                    return (
                      <tr key={`${item.productId}-${item.variantId || idx}`} className="hover:bg-slate-50/70 transition-colors">
                        
                        {/* Product Info */}
                        <td className="py-3.5 px-5">
                          <p className="font-bold text-slate-900 text-sm leading-tight">{item.productName}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{item.brand} &bull; {item.category}</p>
                        </td>

                        {/* SKU & Barcode */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            {item.sku ? (
                              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 inline-block">
                                {item.sku}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">—</span>
                            )}
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                              <Barcode className="w-3 h-3 text-slate-400" />
                              <span>{item.barcode}</span>
                            </div>
                          </div>
                        </td>

                        {/* Variant Chips */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            {item.color && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                <Palette className="w-3 h-3 text-slate-400" />
                                <span>{item.color}</span>
                              </span>
                            )}
                            {item.size && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                                <Ruler className="w-3 h-3 text-brand-500" />
                                <span>{item.size}</span>
                              </span>
                            )}
                            {!item.color && !item.size && (
                              <span className="text-slate-400 italic text-[11px]">Standar (Tanpa Varian)</span>
                            )}
                          </div>
                        </td>

                        {/* Stock count */}
                        <td className="py-3.5 px-4">
                          <span className={`text-base font-black font-mono ${
                            isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'
                          }`}>
                            {item.stock}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium ml-1">{item.unit}</span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                              <XCircle className="w-3 h-3" />
                              <span>Stok Habis</span>
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-bold animate-pulse">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Menipis (&le;{minStockThreshold})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Tersedia</span>
                            </span>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td className="py-3.5 px-5 text-right">
                          {isSuperAdmin ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenRestock(item)}
                                className="px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 text-xs font-bold transition-colors flex items-center gap-1"
                                title="Tambah stok baru (Restock)"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Restock</span>
                              </button>

                              <button
                                onClick={() => handleOpenAdjust(item)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 text-xs font-semibold transition-colors flex items-center gap-1"
                                title="Sesuaikan stok (Stock Opname)"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Penyesuaian</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Lihat Saja</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between px-5">
            <span>
              Menampilkan <strong>{filteredItems.length}</strong> entri varian persediaan.
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Ambang batas stok menipis: {minStockThreshold} unit (dapat diubah di menu Pengaturan)
            </span>
          </div>
        </div>
      </div>

      {/* Adjust / Restock Modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] text-amber-400 font-mono font-bold uppercase tracking-wider">
                  {adjustModal.mode === 'restock' ? 'Restock Masuk' : 'Penyesuaian Stok Opname'}
                </span>
                <h3 className="font-bold text-base mt-0.5">
                  {adjustModal.product.name}
                </h3>
                {adjustModal.variant && (
                  <p className="text-xs text-slate-300 mt-0.5">
                    Varian: <strong>{adjustModal.variant.color}</strong> &bull; Ukuran: <strong>{adjustModal.variant.size}</strong> (Stok saat ini: {adjustModal.variant.stock})
                  </p>
                )}
              </div>
              <button
                onClick={() => setAdjustModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 space-y-4">
              {adjustModal.mode === 'restock' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jumlah Tambahan Restock
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    {[5, 10, 20, 50].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setInputDelta(n)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                          inputDelta === n
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        +{n}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={inputDelta}
                    onChange={(e) => setInputDelta(Number(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-mono font-black text-slate-900 focus:border-brand-600 outline-none"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Stok baru setelah restock: <strong>{(adjustModal.variant ? adjustModal.variant.stock : adjustModal.product.stock) + inputDelta}</strong> unit
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Jumlah Stok Fisik Sebenarnya
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={inputExact}
                      onChange={(e) => setInputExact(Number(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-mono font-black text-slate-900 focus:border-brand-600 outline-none"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Alasan Penyesuaian
                    </label>
                    <select
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-medium outline-none"
                    >
                      <option value="Stock Opname Fisik">Stock Opname Fisik (Hitung Ulang)</option>
                      <option value="Barang Rusak / Cacat Pabrik">Barang Rusak / Cacat</option>
                      <option value="Retur Pelanggan">Retur Pelanggan</option>
                      <option value="Koreksi Input Kasir">Koreksi Input Kasir</option>
                      <option value="Hilang / Selisih">Hilang / Selisih Toko</option>
                    </select>
                  </div>
                </>
              )}

              <div className="pt-3 flex gap-2 justify-end border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAdjustModal(null)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 shadow-md shadow-brand-600/25 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Stok Baru</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
