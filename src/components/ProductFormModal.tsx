import React, { useState, useEffect, useMemo } from 'react';
import { usePOS } from '../context/POSContext';
import { Product, ProductVariant } from '../types';
import { formatRupiah } from '../utils/formatters';
import { generateRandomEAN13 } from '../utils/barcodeGenerator';
import { 
  Package, 
  Palette, 
  Ruler, 
  Layers, 
  Check, 
  X, 
  Plus, 
  Sparkles, 
  AlertCircle, 
  Loader2, 
  AlertTriangle,
  Info
} from 'lucide-react';

// ── Color name → HEX mapping for dot previews ─────────────────────────────
const COLOR_HEX_MAP: Record<string, string> = {
  'hitam': '#1a1a1a', 'putih': '#ffffff', 'navy': '#1e3a5f', 'abu-abu': '#9e9e9e',
  'cream': '#f5f0e8', 'dusty pink': '#e8b4b8', 'maroon': '#800020', 'olive': '#6b7c3d',
  'sage green': '#87a878', 'dusty blue': '#7ba5c4', 'lavender': '#c8b4e0',
  'coklat': '#7d5a3c', 'coklat muda': '#c8956c', 'camel': '#c19a6b', 'grey': '#9e9e9e',
  'light blue': '#aed6f1', 'dark blue': '#1a3a5c', 'black denim': '#2c2c3e',
  'biru bunga': '#6fa8d6', 'pink bunga': '#e8a0b4', 'hijau bunga': '#88c9a1',
  'sage': '#87a878', 'dusty lilac': '#b098c4', 'nude': '#e8c9a8',
  'merah': '#dc2626', 'hijau': '#16a34a', 'khaki': '#c3b091', 'kuning': '#eab308'
};
const getColorHex = (name: string) => COLOR_HEX_MAP[name.trim().toLowerCase()] || '#cbd5e1';

// ── Quick Select Presets ──────────────────────────────────────────────────
const QUICK_COLORS = [
  'Hitam', 'Putih', 'Navy', 'Merah', 'Maroon', 'Cream', 
  'Abu-abu', 'Khaki', 'Coklat', 'Hijau', 'Sage Green', 'Dusty Pink'
];

const QUICK_SIZES_STANDARD = ['S', 'M', 'L', 'XL', 'XXL', '3XL', 'All Size'];
const QUICK_SIZES_PANTS = ['27', '28', '29', '30', '31', '32'];

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | null;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  editingProduct,
}) => {
  const { addProduct, updateProduct, isSuperAdmin, categories: allCategories } = usePOS() as any;

  // Form Fields
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('ARFA FASHION');
  const [category, setCategory] = useState('Atasan & Kemeja');
  const [price, setPrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [barcode, setBarcode] = useState('');
  const [unit, setUnit] = useState('Pcs');

  // Variant Tags
  const [colors, setColors] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [colorInput, setColorInput] = useState('');
  const [sizeInput, setSizeInput] = useState('');
  const [colorFeedback, setColorFeedback] = useState<string | null>(null);
  const [sizeFeedback, setSizeFeedback] = useState<string | null>(null);

  // Variant Matrix Stocks: Map of `${color}:::${size}` -> stock number
  const [variantStocks, setVariantStocks] = useState<Record<string, number>>({});

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Delete Confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'color' | 'size';
    value: string;
    count: number;
    totalStock: number;
  } | null>(null);

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setSubmitError(null);
    setSuccessToast(null);
    setColorFeedback(null);
    setSizeFeedback(null);
    setDeleteConfirm(null);

    if (editingProduct) {
      setName(editingProduct.name || '');
      setBrand(editingProduct.brand || 'ARFA FASHION');
      setCategory(editingProduct.category || 'Atasan & Kemeja');
      setPrice(editingProduct.price || 0);
      setCostPrice(editingProduct.costPrice || 0);
      setBarcode(editingProduct.barcode || '');
      setUnit(editingProduct.unit || 'Pcs');

      const existingColors = [...(editingProduct.colors || [])];
      const existingSizes = [...(editingProduct.sizes || [])];
      const stocks: Record<string, number> = {};

      if (editingProduct.variants && editingProduct.variants.length > 0) {
        for (const v of editingProduct.variants) {
          stocks[`${v.color}:::${v.size}`] = Math.max(0, v.stock || 0);
          if (!existingColors.some(c => c.toLowerCase() === v.color.toLowerCase())) {
            existingColors.push(v.color);
          }
          if (!existingSizes.some(s => s.toLowerCase() === v.size.toLowerCase())) {
            existingSizes.push(v.size);
          }
        }
      }

      setColors(existingColors);
      setSizes(existingSizes);
      setVariantStocks(stocks);
    } else {
      setName('');
      setBrand('ARFA FASHION');
      setCategory('Atasan & Kemeja');
      setPrice(0);
      setCostPrice(0);
      setBarcode(generateRandomEAN13());
      setUnit('Pcs');
      setColors([]);
      setSizes([]);
      setVariantStocks({});
    }
  }, [isOpen, editingProduct]);

  // Compute Total Stock across the matrix
  const totalStock = useMemo(() => {
    if (colors.length === 0 || sizes.length === 0) return 0;
    return colors.reduce((acc, c) => {
      return acc + sizes.reduce((sub, s) => {
        return sub + (variantStocks[`${c}:::${s}`] || 0);
      }, 0);
    }, 0);
  }, [colors, sizes, variantStocks]);

  // Total combinations
  const totalCombinations = colors.length * sizes.length;

  // ── Color Management ─────────────────────────────────────────────────────
  const handleAddColor = (rawName?: string) => {
    const trimmed = (rawName ?? colorInput).trim();
    if (!trimmed) return;
    setColorFeedback(null);

    const isDuplicate = colors.some(c => c.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
      setColorFeedback(`Warna "${trimmed}" sudah ditambahkan.`);
      return;
    }

    setColors(prev => [...prev, trimmed]);
    setColorInput('');
  };

  const handleRequestRemoveColor = (colorToRemove: string) => {
    const affectedStocks = sizes.reduce((sum, s) => {
      return sum + (variantStocks[`${colorToRemove}:::${s}`] || 0);
    }, 0);

    if (affectedStocks > 0) {
      setDeleteConfirm({
        type: 'color',
        value: colorToRemove,
        count: sizes.length,
        totalStock: affectedStocks,
      });
      return;
    }
    confirmRemoveColor(colorToRemove);
  };

  const confirmRemoveColor = (colorToRemove: string) => {
    setColors(prev => prev.filter(c => c.toLowerCase() !== colorToRemove.toLowerCase()));
    setVariantStocks(prev => {
      const next = { ...prev };
      for (const s of sizes) {
        delete next[`${colorToRemove}:::${s}`];
      }
      return next;
    });
    setDeleteConfirm(null);
  };

  // ── Size Management ──────────────────────────────────────────────────────
  const handleAddSize = (rawName?: string) => {
    const trimmed = (rawName ?? sizeInput).trim();
    if (!trimmed) return;
    setSizeFeedback(null);

    const isDuplicate = sizes.some(s => s.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
      setSizeFeedback(`Ukuran "${trimmed}" sudah ditambahkan.`);
      return;
    }

    setSizes(prev => [...prev, trimmed]);
    setSizeInput('');
  };

  const handleRequestRemoveSize = (sizeToRemove: string) => {
    const affectedStocks = colors.reduce((sum, c) => {
      return sum + (variantStocks[`${c}:::${sizeToRemove}`] || 0);
    }, 0);

    if (affectedStocks > 0) {
      setDeleteConfirm({
        type: 'size',
        value: sizeToRemove,
        count: colors.length,
        totalStock: affectedStocks,
      });
      return;
    }
    confirmRemoveSize(sizeToRemove);
  };

  const confirmRemoveSize = (sizeToRemove: string) => {
    setSizes(prev => prev.filter(s => s.toLowerCase() !== sizeToRemove.toLowerCase()));
    setVariantStocks(prev => {
      const next = { ...prev };
      for (const c of colors) {
        delete next[`${c}:::${sizeToRemove}`];
      }
      return next;
    });
    setDeleteConfirm(null);
  };

  // ── Matrix Stock Cell Change ─────────────────────────────────────────────
  const handleStockCellChange = (color: string, size: string, value: string) => {
    const cleanNum = Math.max(0, parseInt(value, 10) || 0);
    setVariantStocks(prev => ({
      ...prev,
      [`${color}:::${size}`]: cleanNum,
    }));
  };

  // ── Barcode Generator ────────────────────────────────────────────────────
  const handleGenerateBarcode = () => {
    setBarcode(generateRandomEAN13());
  };

  // ── Submit Handler ───────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!isSuperAdmin) {
      alert('Akses Ditolak: Hanya Super Admin yang diizinkan untuk mengelola produk.');
      return;
    }

    // Validation
    if (!name.trim()) {
      setSubmitError('Nama produk wajib diisi.');
      return;
    }
    if (price <= 0 || isNaN(price)) {
      setSubmitError('Harga jual wajib lebih besar dari 0.');
      return;
    }
    if (!barcode.trim()) {
      setSubmitError('Nomor barcode wajib diisi.');
      return;
    }
    if (colors.length === 0) {
      setSubmitError('Minimal pilih atau tambahkan 1 warna produk.');
      return;
    }
    if (sizes.length === 0) {
      setSubmitError('Minimal pilih atau tambahkan 1 ukuran produk.');
      return;
    }

    // Validate no negative stock
    for (const c of colors) {
      for (const s of sizes) {
        const val = variantStocks[`${c}:::${s}`] ?? 0;
        if (val < 0) {
          setSubmitError(`Stok varian ${c} / ${s} tidak boleh bernilai negatif.`);
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      // Build variants array
      const cleanColorCode = (c: string) => c.replace(/\s+/g, '').slice(0, 3).toUpperCase();
      const cleanSizeCode = (s: string) => s.replace(/\s+/g, '').toUpperCase();
      const generatedVariants: ProductVariant[] = [];
      let varIdx = 1;

      for (const c of colors) {
        for (const s of sizes) {
          const stock = Math.max(0, variantStocks[`${c}:::${s}`] ?? 0);
          const existingVariant = editingProduct?.variants?.find(
            v => v.color.toLowerCase() === c.toLowerCase() && v.size.toLowerCase() === s.toLowerCase()
          );

          const variantId = existingVariant?.id || `${editingProduct?.id || 'PRD'}-VAR-${varIdx}`;
          const sku = `${barcode.slice(-4)}-${cleanColorCode(c)}-${cleanSizeCode(s)}`;

          generatedVariants.push({
            id: variantId,
            color: c,
            size: s,
            stock,
            sku,
          });
          varIdx++;
        }
      }

      const payload = {
        name: name.trim(),
        brand: brand.trim() || 'ARFA FASHION',
        category: category.trim() || 'Atasan & Kemeja',
        price: Number(price),
        costPrice: Number(costPrice) || 0,
        stock: totalStock,
        barcode: barcode.trim(),
        unit: unit.trim() || 'Pcs',
        colors,
        sizes,
        variants: generatedVariants,
      };

      if (editingProduct) {
        const result = await updateProduct(editingProduct.id, payload);
        if (!result.success) {
          setSubmitError(result.error || 'Gagal memperbarui produk.');
          setIsSubmitting(false);
          return;
        }
        setSuccessToast(`Produk "${payload.name}" berhasil diperbarui.`);
      } else {
        const result = await addProduct(payload);
        if (!result.success) {
          setSubmitError(result.error || 'Gagal menyimpan produk baru.');
          setIsSubmitting(false);
          return;
        }
        setSuccessToast(`Produk "${payload.name}" berhasil ditambahkan.`);
      }

      // Close modal after brief feedback
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 700);

    } catch (err: any) {
      console.error('Error saving product:', err);
      setSubmitError(err.message || 'Terjadi kesalahan sistem saat menyimpan produk.');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 max-h-[94vh] flex flex-col">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600/30 flex items-center justify-center text-brand-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base leading-tight">
                {editingProduct ? 'Edit Data Produk' : 'Tambah Produk Baru'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Lengkapi informasi katalog, warna, ukuran, dan stok varian fashion.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* Submit Error Banner */}
          {submitError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{submitError}</div>
              <button type="button" onClick={() => setSubmitError(null)} className="text-rose-400 hover:text-rose-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Success Banner */}
          {successToast && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <div className="font-semibold">{successToast}</div>
            </div>
          )}

          {/* SECTION 1: INFORMASI PRODUK */}
          <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-6 h-6 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                <Package className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                1. Informasi Produk
              </h3>
            </div>

            <div className="space-y-3.5">
              {/* Nama Produk */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Produk <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Kaos Oversize Premium"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 outline-hidden font-medium transition-all"
                />
              </div>

              {/* Brand & Kategori */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Brand / Merek <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Contoh: ARFA FASHION"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 outline-hidden font-medium transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="category-suggestions"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Pilih atau ketik kategori..."
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 outline-hidden font-medium transition-all"
                  />
                  <datalist id="category-suggestions">
                    <option value="Atasan & Kemeja" />
                    <option value="Gamis & Dress" />
                    <option value="Celana & Bawahan" />
                    <option value="Cardigan & Outer" />
                    <option value="Hijab & Kerudung" />
                    <option value="Aksesoris & Lainnya" />
                  </datalist>
                </div>
              </div>

              {/* Harga Jual & Harga Modal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Jual (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      required
                      min="1"
                      value={price || ''}
                      onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))}
                      placeholder="125.000"
                      className="w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 outline-hidden transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Modal / Beli (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={costPrice || ''}
                      onChange={(e) => setCostPrice(Math.max(0, Number(e.target.value)))}
                      placeholder="75.000"
                      className="w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 outline-hidden transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Barcode & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Barcode / SKU <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      className="text-[11px] text-brand-600 font-bold hover:text-brand-700 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Generate Otomatis</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Contoh: 8991001001014"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 outline-hidden transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Satuan Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 outline-hidden transition-all"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Set">Set</option>
                    <option value="Lusin">Lusin</option>
                    <option value="Pasang">Pasang</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: WARNA (INTERACTIVE CHIPS) */}
          <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                  <Palette className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    2. Warna Produk
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Tambahkan warna yang tersedia ({colors.length} warna aktif)
                  </p>
                </div>
              </div>
            </div>

            {/* Input + Button */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={colorInput}
                  onChange={(e) => {
                    setColorInput(e.target.value);
                    if (colorFeedback) setColorFeedback(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddColor();
                    }
                  }}
                  placeholder="Ketik nama warna (contoh: Hitam, Sage Green) lalu tekan Enter..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 outline-hidden transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => handleAddColor()}
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah</span>
              </button>
            </div>

            {/* Feedback message */}
            {colorFeedback && (
              <p className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {colorFeedback}
              </p>
            )}

            {/* Active Color Chips */}
            <div className="min-h-[44px] p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-2">
              {colors.length === 0 ? (
                <span className="text-xs text-slate-400 italic">
                  Belum ada warna. Tambahkan warna untuk membuat varian produk.
                </span>
              ) : (
                colors.map(c => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-semibold shadow-2xs group hover:border-slate-300 transition-all"
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-slate-300 shrink-0 shadow-2xs"
                      style={{ backgroundColor: getColorHex(c) }}
                    />
                    <span>{c}</span>
                    <button
                      type="button"
                      onClick={() => handleRequestRemoveColor(c)}
                      aria-label={`Hapus warna ${c}`}
                      className="ml-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded-md transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Quick Select Colors */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-500">Warna cepat:</span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_COLORS.map(qc => {
                  const isSelected = colors.some(c => c.toLowerCase() === qc.toLowerCase());
                  return (
                    <button
                      key={qc}
                      type="button"
                      onClick={() => handleAddColor(qc)}
                      disabled={isSelected}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-75' 
                          : 'bg-white text-slate-700 border-slate-200 hover:border-brand-500 hover:text-brand-600 shadow-2xs'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-slate-200 shrink-0"
                        style={{ backgroundColor: getColorHex(qc) }}
                      />
                      <span>{qc}</span>
                      {isSelected && <Check className="w-3 h-3 text-slate-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SECTION 3: UKURAN (INTERACTIVE CHIPS) */}
          <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Ruler className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    3. Ukuran Produk
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Tambahkan ukuran pakaian ({sizes.length} ukuran aktif)
                  </p>
                </div>
              </div>
            </div>

            {/* Input + Button */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={sizeInput}
                  onChange={(e) => {
                    setSizeInput(e.target.value);
                    if (sizeFeedback) setSizeFeedback(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSize();
                    }
                  }}
                  placeholder="Ketik nama ukuran (contoh: M, All Size, 28) lalu tekan Enter..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 outline-hidden transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => handleAddSize()}
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah</span>
              </button>
            </div>

            {/* Feedback message */}
            {sizeFeedback && (
              <p className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {sizeFeedback}
              </p>
            )}

            {/* Active Size Chips */}
            <div className="min-h-[44px] p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-2">
              {sizes.length === 0 ? (
                <span className="text-xs text-slate-400 italic">
                  Belum ada ukuran. Tambahkan ukuran untuk membuat varian produk.
                </span>
              ) : (
                sizes.map(s => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-bold shadow-2xs group hover:border-slate-300 transition-all"
                  >
                    <span>{s}</span>
                    <button
                      type="button"
                      onClick={() => handleRequestRemoveSize(s)}
                      aria-label={`Hapus ukuran ${s}`}
                      className="ml-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded-md transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Quick Select Sizes */}
            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 mr-1">Standar:</span>
                {QUICK_SIZES_STANDARD.map(qs => {
                  const isSelected = sizes.some(s => s.toLowerCase() === qs.toLowerCase());
                  return (
                    <button
                      key={qs}
                      type="button"
                      onClick={() => handleAddSize(qs)}
                      disabled={isSelected}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-75' 
                          : 'bg-white text-slate-700 border-slate-200 hover:border-brand-500 hover:text-brand-600 shadow-2xs'
                      }`}
                    >
                      {qs}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 mr-1">Nomor / Jeans:</span>
                {QUICK_SIZES_PANTS.map(qp => {
                  const isSelected = sizes.some(s => s.toLowerCase() === qp.toLowerCase());
                  return (
                    <button
                      key={qp}
                      type="button"
                      onClick={() => handleAddSize(qp)}
                      disabled={isSelected}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-75' 
                          : 'bg-white text-slate-700 border-slate-200 hover:border-brand-500 hover:text-brand-600 shadow-2xs'
                      }`}
                    >
                      {qp}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SECTION 4: MATRIKS VARIAN (VARIANT MATRIX) */}
          <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    4. Matriks Varian
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Masukkan stok fisik untuk setiap kombinasi warna dan ukuran ({totalCombinations} kombinasi)
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-semibold text-slate-500">Total Stok Keseluruhan:</span>
                <div className="text-sm font-bold font-mono text-brand-600">
                  {totalStock} <span className="text-xs font-normal text-slate-500">{unit}</span>
                </div>
              </div>
            </div>

            {colors.length === 0 || sizes.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 space-y-2">
                <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-600">Belum ada varian terbentuk</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Pilih minimal 1 warna pada Bagian 2 dan 1 ukuran pada Bagian 3 untuk memunculkan tabel matriks stok.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse min-w-[520px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                      <th className="py-2.5 px-3.5 font-bold uppercase tracking-wider text-[11px] sticky left-0 bg-slate-100 z-10 w-44">
                        Warna \ Ukuran
                      </th>
                      {sizes.map(s => (
                        <th key={s} className="py-2.5 px-3 font-bold text-center uppercase tracking-wider text-[11px]">
                          {s}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 font-bold text-right uppercase tracking-wider text-[11px] text-slate-500 bg-slate-100/80">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {colors.map(c => {
                      const colorSubtotal = sizes.reduce((sum, s) => {
                        return sum + (variantStocks[`${c}:::${s}`] || 0);
                      }, 0);

                      return (
                        <tr key={c} className="hover:bg-slate-50/80 transition-colors">
                          {/* Color Row Header (Sticky) */}
                          <td className="py-2 px-3.5 font-bold text-slate-800 sticky left-0 bg-white hover:bg-slate-50/80 z-10 flex items-center gap-2 border-r border-slate-100">
                            <span
                              className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                              style={{ backgroundColor: getColorHex(c) }}
                            />
                            <span className="truncate max-w-[130px]">{c}</span>
                          </td>

                          {/* Matrix Cells */}
                          {sizes.map(s => {
                            const currentVal = variantStocks[`${c}:::${s}`] ?? 0;
                            return (
                              <td key={`${c}:::${s}`} className="py-2 px-2 text-center">
                                <div className="inline-flex items-center justify-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={currentVal === 0 ? '0' : currentVal}
                                    onChange={(e) => handleStockCellChange(c, s, e.target.value)}
                                    className="w-16 px-2 py-1.5 text-center font-mono font-bold text-xs border border-slate-200 rounded-lg text-slate-900 bg-slate-50 focus:bg-white focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 outline-hidden transition-all"
                                  />
                                </div>
                              </td>
                            );
                          })}

                          {/* Color Subtotal */}
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-600 bg-slate-50/40">
                            {colorSubtotal} <span className="text-[10px] font-normal text-slate-400">{unit}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Table Footer: Column Totals */}
                  <tfoot>
                    <tr className="bg-slate-100/70 border-t-2 border-slate-200 font-bold text-[11px] text-slate-700">
                      <td className="py-2.5 px-3.5 sticky left-0 bg-slate-100 z-10 uppercase tracking-wider text-slate-600">
                        Total per Ukuran
                      </td>
                      {sizes.map(s => {
                        const sizeSubtotal = colors.reduce((sum, c) => {
                          return sum + (variantStocks[`${c}:::${s}`] || 0);
                        }, 0);
                        return (
                          <td key={s} className="py-2.5 px-2 text-center font-mono font-bold text-slate-800">
                            {sizeSubtotal}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-brand-700 bg-brand-50/50">
                        {totalStock} <span className="text-[10px] font-normal">{unit}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* SECTION 5: RINGKASAN PRODUK */}
          <section className="bg-slate-100/80 rounded-2xl border border-slate-200/80 p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-1.5 text-slate-700">
              <Info className="w-4 h-4 text-brand-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Ringkasan Produk</h4>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Warna</span>
                <span className="text-sm font-bold text-slate-800">{colors.length} warna</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Ukuran</span>
                <span className="text-sm font-bold text-slate-800">{sizes.length} ukuran</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Kombinasi</span>
                <span className="text-sm font-bold text-slate-800">{totalCombinations} varian</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-brand-200 bg-brand-50/30 shadow-2xs">
                <span className="text-[10px] text-brand-600 font-semibold uppercase tracking-wider block">Total Stok</span>
                <span className="text-sm font-bold font-mono text-brand-700">{totalStock} {unit}</span>
              </div>
            </div>

            {totalStock > 0 && price > 0 && (
              <p className="text-[11px] text-slate-500 text-right font-medium">
                Estimasi Total Nilai Jual: <strong className="text-slate-800 font-mono">{formatRupiah(totalStock * price)}</strong>
              </p>
            )}
          </section>

          {/* SECTION 6: FOOTER ACTIONS */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end border-t border-slate-200">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="py-2.5 px-5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer text-center"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || price <= 0 || colors.length === 0 || sizes.length === 0}
              className={`py-2.5 px-6 rounded-xl text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
                isSubmitting || !name.trim() || price <= 0 || colors.length === 0 || sizes.length === 0
                  ? 'bg-slate-400 cursor-not-allowed opacity-75'
                  : 'bg-brand-600 hover:bg-brand-700 cursor-pointer active:scale-98'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Produk...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{editingProduct ? 'Simpan Perubahan' : 'Simpan Produk'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal when removing color/size with stock */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center z-60 p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1.5">
              <h4 className="text-sm font-bold text-slate-900">
                Hapus {deleteConfirm.type === 'color' ? 'Warna' : 'Ukuran'} "{deleteConfirm.value}"?
              </h4>
              <p className="text-xs text-slate-500">
                Terdapat <strong>{deleteConfirm.totalStock} pcs stok</strong> pada {deleteConfirm.count} varian terkait. Menghapus {deleteConfirm.type === 'color' ? 'warna' : 'ukuran'} ini akan menghapus stok varian tersebut dari matriks.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirm.type === 'color') {
                    confirmRemoveColor(deleteConfirm.value);
                  } else {
                    confirmRemoveSize(deleteConfirm.value);
                  }
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
