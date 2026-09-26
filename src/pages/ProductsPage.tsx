import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { Product } from '../types';
import { formatRupiah } from '../utils/formatters';
import { 
  Package, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Barcode, 
  X, 
  Check, 
  Sparkles,
  Layers,
  Printer,
  ShieldAlert,
  Eye,
  Palette,
  Ruler,
} from 'lucide-react';
import { PrintBarcodeModal } from '../components/PrintBarcodeModal';

// ── Color name → HEX mapping for dot previews ─────────────────────────────
const COLOR_HEX_MAP: Record<string, string> = {
  'hitam': '#1a1a1a', 'putih': '#f5f5f5', 'navy': '#1e3a5f', 'abu-abu': '#9e9e9e',
  'cream': '#f5f0e8', 'dusty pink': '#e8b4b8', 'maroon': '#800020', 'olive': '#6b7c3d',
  'sage green': '#87a878', 'dusty blue': '#7ba5c4', 'lavender': '#c8b4e0',
  'coklat': '#7d5a3c', 'coklat muda': '#c8956c', 'camel': '#c19a6b', 'grey': '#9e9e9e',
  'light blue': '#aed6f1', 'dark blue': '#1a3a5c', 'black denim': '#2c2c3e',
  'biru bunga': '#6fa8d6', 'pink bunga': '#e8a0b4', 'hijau bunga': '#88c9a1',
  'sage': '#87a878', 'dusty lilac': '#b098c4', 'nude': '#e8c9a8',
};
const getColorHex = (name: string) => COLOR_HEX_MAP[name.toLowerCase()] || '#d1d5db';

export const ProductsPage: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct, isSuperAdmin, cashier } = usePOS();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [productForPrint, setProductForPrint] = useState<Product | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: 'Atasan & Kemeja',
    price: 0,
    costPrice: 0,
    stock: 10,
    barcode: '',
    unit: 'Pcs',
    colorsInput: '',  // comma-separated string for input
    sizesInput: '',   // comma-separated string for input
  });

  const parseList = (input: string): string[] =>
    input.split(',').map(s => s.trim()).filter(Boolean);

  const categories = ['Semua', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'Semua' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQ = !q || 
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.barcode.includes(q);
    return matchesCat && matchesQ;
  });

  const handleOpenAdd = () => {
    if (!isSuperAdmin) {
      alert('Akses Ditolak: Hanya Super Admin yang diizinkan untuk menambah produk.');
      return;
    }
    setEditingProduct(null);
    setFormData({
      name: '',
      brand: '',
      category: 'Atasan & Kemeja',
      price: 0,
      costPrice: 0,
      stock: 10,
      barcode: `899${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      unit: 'Pcs',
      colorsInput: '',
      sizesInput: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    if (!isSuperAdmin) {
      alert('Akses Ditolak: Hanya Super Admin yang diizinkan untuk mengedit produk.');
      return;
    }
    setEditingProduct(p);
    setFormData({
      name: p.name,
      brand: p.brand,
      category: p.category,
      price: p.price,
      costPrice: p.costPrice || 0,
      stock: p.stock,
      barcode: p.barcode,
      unit: p.unit,
      colorsInput: (p.colors || []).join(', '),
      sizesInput: (p.sizes || []).join(', '),
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      alert('Akses Ditolak: Hanya Super Admin yang dapat menyimpan perubahan produk.');
      return;
    }
    if (!formData.name.trim() || !formData.barcode.trim() || formData.price <= 0) {
      alert('Mohon isi nama produk, barcode, dan harga yang valid.');
      return;
    }

    const productPayload = {
      name: formData.name.trim(),
      brand: formData.brand.trim(),
      category: formData.category.trim(),
      price: formData.price,
      costPrice: formData.costPrice,
      stock: formData.stock,
      barcode: formData.barcode.trim(),
      unit: formData.unit.trim() || 'Pcs',
      colors: parseList(formData.colorsInput),
      sizes: parseList(formData.sizesInput),
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, productPayload);
    } else {
      addProduct(productPayload);
    }

    setIsModalOpen(false);
  };

  const generateNewBarcode = () => {
    const newCode = `899${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    setFormData(prev => ({ ...prev, barcode: newCode }));
  };

  // ── Small color dot strip ──────────────────────────────────────────────────
  const ColorDots = ({ colors }: { colors?: string[] }) => {
    if (!colors || colors.length === 0) return <span className="text-slate-300 text-[10px]">—</span>;
    const MAX_SHOW = 6;
    const shown = colors.slice(0, MAX_SHOW);
    const extra = colors.length - MAX_SHOW;
    return (
      <div className="flex items-center gap-0.5 flex-wrap">
        {shown.map(c => (
          <span
            key={c}
            title={c}
            className="w-3.5 h-3.5 rounded-full border border-white shadow-sm shrink-0"
            style={{ backgroundColor: getColorHex(c) }}
          />
        ))}
        {extra > 0 && (
          <span className="text-[9px] text-slate-500 font-bold">+{extra}</span>
        )}
      </div>
    );
  };

  // ── Size chips ──────────────────────────────────────────────────────────────
  const SizeChips = ({ sizes }: { sizes?: string[] }) => {
    if (!sizes || sizes.length === 0) return <span className="text-slate-300 text-[10px]">—</span>;
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {sizes.map(s => (
          <span key={s} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
            {s}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
      
      {/* Header Bar */}
      <div className="p-4 md:p-6 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 md:w-6 md:h-6 text-brand-600" />
            <span>Kelola Katalog &amp; Stok Produk</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {products.length} produk terdaftar · mencakup variasi warna &amp; ukuran fashion.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setProductForPrint(null);
              setIsPrintModalOpen(true);
            }}
            className="py-2.5 px-4 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors shadow-2xs flex items-center justify-center gap-2"
            title="Cetak stiker barcode untuk produk"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Cetak Label Barcode</span>
          </button>

          {isSuperAdmin ? (
            <button
              onClick={handleOpenAdd}
              className="py-2.5 px-4 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Produk Baru</span>
            </button>
          ) : (
            <div className="py-2 px-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
              <Eye className="w-3.5 h-3.5 text-amber-600" />
              <span>Mode Lihat Saja (Role: Kasir)</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan nama, brand, atau barcode..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 focus:border-brand-600 rounded-xl text-xs text-slate-800 outline-hidden transition-all shadow-2xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Kategori:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 outline-hidden focus:border-brand-600 shadow-2xs"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Role notice banner if Kasir (view only) */}
      {!isSuperAdmin && (
        <div className="mx-3 md:mx-6 mt-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-900 shadow-2xs">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="flex-1">
            <strong>Peran: Kasir ({cashier.name}) — Mode Lihat Saja:</strong> Anda hanya dapat melihat katalog, stok, warna, dan ukuran produk. Tambah, edit, dan hapus produk dibatasi khusus untuk <strong>Super Admin</strong>.
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6">

        {/* ===== MOBILE CARD VIEW (hidden on md+) ===== */}
        <div className="md:hidden space-y-2">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Package className="w-10 h-10 mb-2 stroke-1" />
              <p className="text-sm">Tidak ada produk yang cocok.</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const isOutOfStock = product.stock <= 0;
              const isLowStock = product.stock > 0 && product.stock <= 5;
              return (
                <div key={product.id} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-slate-900 leading-tight">{product.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{product.brand} · {product.category}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Barcode className="w-3 h-3 text-slate-400" />
                        <span className="font-mono text-[10px] text-slate-500">{product.barcode}</span>
                      </div>
                      {/* Color and size row */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {product.colors && product.colors.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Palette className="w-3 h-3 text-slate-400" />
                            <ColorDots colors={product.colors} />
                          </div>
                        )}
                        {product.sizes && product.sizes.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Ruler className="w-3 h-3 text-slate-400" />
                            <SizeChips sizes={product.sizes} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="font-mono font-extrabold text-sm text-slate-900">{formatRupiah(product.price)}</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        isOutOfStock ? 'bg-rose-100 text-rose-700' : isLowStock ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        Stok: {product.stock} {product.unit}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    {isSuperAdmin ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Stok:</span>
                        <div className="inline-flex rounded-lg border border-slate-200 bg-white shadow-2xs">
                          <button onClick={() => updateProduct(product.id, { stock: Math.max(0, product.stock - 1) })}
                            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-l-lg text-slate-700 font-bold">
                            -
                          </button>
                          <span className="w-8 h-8 flex items-center justify-center text-xs font-bold font-mono text-slate-900">{product.stock}</span>
                          <button onClick={() => updateProduct(product.id, { stock: product.stock + 1 })}
                            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-r-lg text-slate-700 font-bold">
                            +
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Satuan: <strong>{product.unit}</strong></span>
                    )}

                    <div className="flex items-center gap-1">
                      <button onClick={() => { setProductForPrint(product); setIsPrintModalOpen(true); }}
                        className="p-2 text-slate-500 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors" title="Cetak Barcode">
                        <Printer className="w-4 h-4" />
                      </button>
                      {isSuperAdmin && (
                        <>
                          <button onClick={() => handleOpenEdit(product)}
                            className="p-2 text-slate-500 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors" title="Edit">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => { if (confirm(`Hapus produk "${product.name}"?`)) deleteProduct(product.id); }}
                            className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Hapus">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ===== DESKTOP TABLE VIEW (hidden on mobile) ===== */}
        <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Barcode</th>
                <th className="py-3 px-4">Nama Produk</th>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">
                  <span className="flex items-center gap-1"><Palette className="w-3 h-3" />Warna</span>
                </th>
                <th className="py-3 px-4">
                  <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />Ukuran</span>
                </th>
                <th className="py-3 px-4">Harga Jual</th>
                <th className="py-3 px-4">Stok</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredProducts.map((product) => {
                const isOutOfStock = product.stock <= 0;
                const isLowStock = product.stock > 0 && product.stock <= 5;

                return (
                  <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Barcode */}
                    <td className="py-3 px-4 font-mono text-slate-600">
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 border border-slate-200">
                        <Barcode className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-[11px] font-bold text-slate-800">{product.barcode}</span>
                      </div>
                    </td>

                    {/* Name */}
                    <td className="py-3 px-4 font-bold text-slate-900 max-w-[180px]">
                      <span className="line-clamp-2 leading-snug">{product.name}</span>
                    </td>

                    {/* Brand */}
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {product.brand}
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                        {product.category}
                      </span>
                    </td>

                    {/* Colors */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <ColorDots colors={product.colors} />
                        {product.colors && product.colors.length > 0 && (
                          <span className="text-[9px] text-slate-400 leading-tight" title={product.colors.join(', ')}>
                            {product.colors.slice(0, 3).join(', ')}{product.colors.length > 3 ? ` +${product.colors.length - 3}` : ''}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Sizes */}
                    <td className="py-3 px-4">
                      <SizeChips sizes={product.sizes} />
                    </td>

                    {/* Price */}
                    <td className="py-3 px-4 font-bold font-mono text-slate-900">
                      {formatRupiah(product.price)}
                    </td>

                    {/* Stock with quick inline adjuster */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          isOutOfStock
                            ? 'bg-rose-100 text-rose-700'
                            : isLowStock
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {product.stock} {product.unit}
                        </span>

                        {isSuperAdmin && (
                          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                            <button
                              onClick={() => updateProduct(product.id, { stock: Math.max(0, product.stock - 1) })}
                              className="w-5 h-5 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600 text-xs font-bold"
                              title="Kurangi stok 1"
                            >
                              -
                            </button>
                            <button
                              onClick={() => updateProduct(product.id, { stock: product.stock + 1 })}
                              className="w-5 h-5 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600 text-xs font-bold"
                              title="Tambah stok 1"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => {
                            setProductForPrint(product);
                            setIsPrintModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Cetak Label Barcode Produk Ini"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {isSuperAdmin && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(product)}
                              className="p-1.5 text-slate-500 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
                              title="Edit Produk"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Yakin ingin menghapus produk "${product.name}"?`)) {
                                  deleteProduct(product.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Hapus Produk"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredProducts.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-xs">
              Tidak ada produk yang cocok dengan kriteria pencarian.
            </div>
          )}
        </div>
        {/* end desktop table */}
      </div>

      {/* Modal Add / Edit Product */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-brand-400" />
                <span>{editingProduct ? 'Edit Data Produk' : 'Tambah Produk Baru'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Produk <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Kemeja Linen Oversized Casual"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-brand-600 outline-hidden font-medium"
                />
              </div>

              {/* Brand & Category row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Brand / Merek <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Contoh: ARFA FASHION"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-brand-600 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Contoh: Atasan & Kemeja"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-brand-600 outline-hidden"
                  />
                </div>
              </div>

              {/* Colors */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-brand-500" />
                  Warna Tersedia <span className="text-slate-400 font-normal">(pisahkan dengan koma)</span>
                </label>
                <input
                  type="text"
                  value={formData.colorsInput}
                  onChange={(e) => setFormData({ ...formData, colorsInput: e.target.value })}
                  placeholder="Contoh: Hitam, Putih, Navy, Abu-abu"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-brand-600 outline-hidden"
                />
                {/* Preview dots */}
                {formData.colorsInput && (
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {parseList(formData.colorsInput).map(c => (
                      <span key={c} className="flex items-center gap-1 text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getColorHex(c) }} />
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Sizes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Ruler className="w-3.5 h-3.5 text-brand-500" />
                  Ukuran Tersedia <span className="text-slate-400 font-normal">(pisahkan dengan koma)</span>
                </label>
                <input
                  type="text"
                  value={formData.sizesInput}
                  onChange={(e) => setFormData({ ...formData, sizesInput: e.target.value })}
                  placeholder="Contoh: S, M, L, XL, XXL  atau  All Size  atau  27, 28, 29, 30"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-brand-600 outline-hidden"
                />
                {/* Preview chips */}
                {formData.sizesInput && (
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {parseList(formData.sizesInput).map(s => (
                      <span key={s} className="px-2 py-0.5 rounded bg-brand-50 text-brand-700 text-[10px] font-bold border border-brand-200">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Price & Stock row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Jual (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:border-brand-600 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Stok Awal
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:border-brand-600 outline-hidden"
                  />
                </div>
              </div>

              {/* Barcode Number & Generator */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Nomor Barcode <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateNewBarcode}
                    className="text-[11px] text-brand-600 font-bold hover:text-brand-700 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Otomatis</span>
                  </button>
                </div>
                <div className="relative">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="Contoh: 8992761111014"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:border-brand-600 outline-hidden"
                  />
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 flex gap-2 justify-end border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingProduct ? 'Simpan Perubahan' : 'Simpan Produk'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Print Barcode Modal */}
      <PrintBarcodeModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        products={products}
        selectedProduct={productForPrint}
      />
    </div>
  );
};
