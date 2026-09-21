import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePOS } from '../context/POSContext';
import { formatRupiah } from '../utils/formatters';
import { CameraScannerModal } from '../components/CameraScannerModal';
import { MobilePairingModal } from '../components/MobilePairingModal';
import { 
  Barcode, 
  Search, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  PauseCircle, 
  PlayCircle, 
  ArrowRight,
  AlertCircle,
  Tag,
  Check,
  Database,
  Smartphone,
  CreditCard
} from 'lucide-react';

export const TransactionPage: React.FC = () => {
  const { 
    products, 
    cart, 
    addToCart, 
    updateCartItemQty, 
    removeFromCart, 
    clearCart,
    cartSubtotal,
    cartDiscount,
    setCartDiscount,
    cartTotal,
    cartItemCount,
    heldCart,
    holdCurrentCart,
    restoreHeldCart,
    setIsCheckoutOpen,
    setIsPaymentMethodsOpen,
    findProductByBarcode,
    isDbConnected
  } = usePOS();

  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [scanMessage, setScanMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [discountInput, setDiscountInput] = useState<string>('');
  const [showDiscountModal, setShowDiscountModal] = useState<boolean>(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState<boolean>(false);
  // Mobile-only: toggle between products view and cart drawer
  const [mobileShowCart, setMobileShowCart] = useState<boolean>(false);

  // Wireless Mobile Scanner State — uses DB polling (works on Vercel, no WebSocket needed)
  const [sessionCode] = useState<string>(() => {
    const saved = sessionStorage.getItem('pos_session_code');
    if (saved) return saved;
    const newCode = `KASIR-${Math.floor(1000 + Math.random() * 9000)}`;
    sessionStorage.setItem('pos_session_code', newCode);
    return newCode;
  });
  const [isMobilePairingOpen, setIsMobilePairingOpen] = useState<boolean>(false);
  const [isScannerPolling, setIsScannerPolling] = useState<boolean>(false);
  const [isScannerConnected, setIsScannerConnected] = useState<boolean>(false);
  const [activeScannersCount, setActiveScannersCount] = useState<number>(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Core barcode lookup logic (used by manual typing, laptop camera, and wireless mobile phone scanner)
  const processBarcodeLookup = useCallback((code: string): { success: boolean; productName?: string; price?: number } => {
    const cleanCode = code.trim();
    if (!cleanCode) return { success: false };

    const found = findProductByBarcode(cleanCode);
    if (found) {
      if (found.stock <= 0) {
        setScanMessage({ text: `Stok produk ${found.name} habis!`, type: 'error' });
        setTimeout(() => setScanMessage(null), 2500);
        return { success: false, productName: found.name, price: found.price };
      } else {
        addToCart(found, 1);
        setScanMessage({ text: `[HP Scanner] ${found.name} berhasil ditambahkan ke keranjang!`, type: 'success' });
        setTimeout(() => setScanMessage(null), 2500);
        return { success: true, productName: found.name, price: found.price };
      }
    } else {
      setScanMessage({ text: `Barcode "${cleanCode}" tidak ditemukan dalam katalog!`, type: 'error' });
      setTimeout(() => setScanMessage(null), 2500);
      return { success: false };
    }
  }, [findProductByBarcode, addToCart]);

  // DB Polling: laptop pulls pending scans from Neon DB every 1.5 seconds (works on Vercel)
  useEffect(() => {
    const pollPendingScans = async () => {
      try {
        const res = await fetch(`/api/scan/pending?session=${sessionCode}`);
        if (!res.ok) return;
        const data = await res.json();
        const scans: { id: number; barcode: string }[] = Array.isArray(data)
          ? data
          : (data.scans || []);

        setIsScannerConnected(Boolean(data.isScannerConnected));
        setActiveScannersCount(data.isScannerConnected ? 1 : 0);

        if (scans.length === 0) return;

        setIsScannerPolling(true);
        for (const scan of scans) {
          const result = processBarcodeLookup(scan.barcode);
          // Mark as processed in DB with lookup result
          try {
            await fetch(`/api/scan/${scan.id}/processed`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                success: result.success,
                productName: result.productName || null,
                productPrice: result.price || null,
              }),
            });
          } catch (e) { /* non-critical */ }
        }
        setTimeout(() => setIsScannerPolling(false), 2000);
      } catch (e) { /* network error, ignore */ }
    };

    pollPendingScans();
    pollingRef.current = setInterval(pollPendingScans, 1500);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [sessionCode, processBarcodeLookup]);

  // Auto focus barcode input on mount and shortcut keys
  useEffect(() => {
    barcodeInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F7') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0 && confirm('Bersihkan seluruh item di keranjang?')) {
          clearCart();
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) {
          setIsCheckoutOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, clearCart, setIsCheckoutOpen]);

  // Categories list
  const categories = ['Semua', ...Array.from(new Set(products.map(p => p.category)))];

  // Filtered products
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = !query || 
      p.name.toLowerCase().includes(query) ||
      p.brand.toLowerCase().includes(query) ||
      p.barcode.includes(query);
    return matchesCategory && matchesQuery;
  });

  // Handle Form submit (via Enter key)
  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (barcodeInput.trim()) {
      processBarcodeLookup(barcodeInput);
      setBarcodeInput('');
    } else {
      // If empty, open camera scanner
      setIsCameraScannerOpen(true);
    }
  };

  // Handle Click on the "Scan (Enter)" button directly
  const handleScanButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      processBarcodeLookup(barcodeInput);
      setBarcodeInput('');
    } else {
      setIsCameraScannerOpen(true);
    }
  };

  // Callback when laptop camera reads a barcode
  const handleCameraScanSuccess = (decodedBarcode: string) => {
    processBarcodeLookup(decodedBarcode);
  };

  // Apply discount
  const handleApplyDiscount = () => {
    const val = Number(discountInput) || 0;
    if (val >= 0 && val <= cartSubtotal) {
      setCartDiscount(val);
      setShowDiscountModal(false);
    } else {
      alert('Nilai diskon tidak valid');
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-100 relative">
      
      {/* ===================== LEFT PANEL: PRODUCTS & BARCODE SCANNER ===================== */}
      {/* On mobile: hidden when cart is shown; on desktop: always visible */}
      <div className={`flex-1 flex flex-col min-w-0 border-r border-slate-200 bg-slate-50/50 ${
        mobileShowCart ? 'hidden md:flex' : 'flex'
      }`}>
        
        {/* Top Scan & Search Bar */}
        <div className="p-4 bg-white border-b border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            {/* Dedicated Barcode Scanner Input */}
            <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-600">
                <Barcode className="w-5 h-5" />
              </div>
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan / Ketik Barcode..."
                className="w-full pl-11 pr-24 py-2.5 bg-slate-50 border-2 border-slate-200 focus:border-brand-600 focus:bg-white rounded-xl text-sm font-mono text-slate-900 outline-hidden transition-all placeholder:font-sans placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={handleScanButtonClick}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-brand-600 text-white rounded-lg text-xs font-semibold hover:bg-brand-700 transition-colors flex items-center gap-1 shadow-xs active:scale-[0.98]"
                title="Klik untuk scan dengan kamera / Enter untuk proses barcode"
              >
                Scan (Enter)
              </button>
            </form>

            {/* Wireless Mobile Phone Scanner Pairing Button */}
            <button
              type="button"
              onClick={() => setIsMobilePairingOpen(true)}
              className={`flex items-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all shadow-2xs shrink-0 ${
                isScannerPolling
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="Hubungkan kamera smartphone Anda sebagai scanner nirkabel"
            >
              <Smartphone className="w-4 h-4 text-brand-600" />
              <span className="hidden sm:inline">Scanner HP</span>
              <span className={`w-2 h-2 rounded-full ${isScannerPolling ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            </button>

            {/* Quick Search Input */}
            <div className="w-52 relative hidden md:block">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama/brand..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-600 focus:bg-white rounded-xl text-xs text-slate-800 outline-hidden transition-all"
              />
            </div>
          </div>

          {/* Mobile-only product search row */}
          <div className="md:hidden relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama produk atau brand..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-brand-600 focus:bg-white rounded-xl text-xs text-slate-800 outline-hidden transition-all"
            />
          </div>
          {scanMessage && (
            <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 font-medium animate-in fade-in duration-150 ${
              scanMessage.type === 'success'
                ? 'bg-emerald-50 text-brand-800 border border-brand-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {scanMessage.type === 'success' ? (
                <Check className="w-4 h-4 text-brand-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{scanMessage.text}</span>
            </div>
          )}

          {/* Category Filter Pills & Indicators */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
            <div className="flex items-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-semibold transition-all ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* HP Scanner indicator */}
              {isScannerPolling && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-50 border border-brand-200 text-[10px] text-brand-800 font-bold">
                  <Smartphone className="w-3 h-3 text-brand-600" />
                  <span>HP Scan Aktif</span>
                </div>
              )}

              {/* Neon DB indicator */}
              {isDbConnected && (
                <div className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 font-semibold">
                  <Database className="w-3 h-3 text-emerald-600" />
                  <span>Neon DB Active</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Product Cards Catalog Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredProducts.map((product) => {
              const inCartItem = cart.find(c => c.product.id === product.id);
              const isOutOfStock = product.stock <= 0;
              const isLowStock = product.stock > 0 && product.stock <= 5;

              return (
                <div
                  key={product.id}
                  onClick={() => !isOutOfStock && addToCart(product, 1)}
                  className={`relative group bg-white rounded-2xl p-3.5 border transition-all flex flex-col justify-between select-none ${
                    isOutOfStock
                      ? 'opacity-60 border-slate-200 cursor-not-allowed bg-slate-50'
                      : inCartItem
                      ? 'border-brand-500 shadow-sm ring-1 ring-brand-500 cursor-pointer hover:shadow-md'
                      : 'border-slate-200/90 hover:border-brand-400 hover:shadow-md cursor-pointer'
                  }`}
                >
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[10px] font-semibold text-slate-500 truncate uppercase tracking-wider">
                      {product.brand}
                    </span>

                    {/* Stock Pill */}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isOutOfStock
                        ? 'bg-rose-100 text-rose-700'
                        : isLowStock
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {isOutOfStock ? 'Habis' : `Stok: ${product.stock}`}
                    </span>
                  </div>

                  {/* Product Name */}
                  <div className="my-1">
                    <h3 className="font-semibold text-slate-800 text-xs leading-snug line-clamp-2">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 font-mono">
                      <Barcode className="w-3 h-3 text-slate-400" />
                      <span>{product.barcode}</span>
                    </div>
                  </div>

                  {/* Price and Cart Indicator */}
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="font-extrabold text-sm text-slate-900 font-mono">
                      {formatRupiah(product.price)}
                    </span>

                    {inCartItem ? (
                      <div className="w-6 h-6 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        {inCartItem.quantity}
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-brand-50 group-hover:text-brand-600 flex items-center justify-center transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
              <ShoppingBag className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
              <p>Tidak ada produk yang cocok dengan pencarian.</p>
            </div>
          )}
        </div>
      </div>

      {/* ===================== RIGHT PANEL: REALTIME POS CART ===================== */}
      {/* On mobile: slides up as drawer when mobileShowCart=true; on desktop: fixed right panel */}
      <div className={`
        md:w-96 md:flex md:flex-col md:shadow-lg md:border-l md:border-slate-200 md:shrink-0 md:z-10
        ${
          mobileShowCart
            ? 'flex flex-col w-full bg-white z-20 cart-drawer-enter'
            : 'hidden md:flex'
        }
      `}>
        
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-brand-600" />
            <h2 className="font-bold text-slate-800 text-sm">Keranjang Transaksi</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 font-bold">
              {cartItemCount} item
            </span>
          </div>

          {/* Hold / Recall bill & Payment Methods */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsPaymentMethodsOpen(true)}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-brand-700 bg-slate-100 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 px-2 py-1 rounded-lg transition-colors"
              title="Kelola & Tambah Metode Pembayaran Kasir"
            >
              <CreditCard className="w-3.5 h-3.5 text-brand-600" />
              <span className="hidden sm:inline">Metode</span>
            </button>
            {heldCart ? (
              <button
                onClick={restoreHeldCart}
                className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg transition-colors"
                title="Kembalikan transaksi yang ditahan"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Panggil ({heldCart.length})</span>
              </button>
            ) : (
              <button
                onClick={holdCurrentCart}
                disabled={cart.length === 0}
                className="flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Tahan transaksi sementara"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                <span>Hold</span>
              </button>
            )}

            {cart.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Kosongkan keranjang kasir?')) clearCart();
                }}
                className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                title="Bersihkan Keranjang (F8)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <ShoppingBag className="w-8 h-8 text-slate-300" />
              </div>
              <p className="font-semibold text-sm text-slate-700">Keranjang Masih Kosong</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                Scan barcode barang atau gunakan tombol <strong>'Scanner HP'</strong> untuk scan pakai kamera ponsel.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="py-3 flex flex-col gap-2 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-slate-800 leading-tight truncate">
                      {item.product.name}
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatRupiah(item.product.price)}
                    </span>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-slate-300 hover:text-rose-600 p-1 opacity-60 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {/* Qty Controls */}
                  <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                    <button
                      onClick={() => updateCartItemQty(item.product.id, item.quantity - 1)}
                      className="w-6 h-6 rounded bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center shadow-2xs"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold font-mono text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateCartItemQty(item.product.id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.stock}
                      className="w-6 h-6 rounded bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center shadow-2xs disabled:opacity-40"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Subtotal Item */}
                  <span className="font-bold text-xs text-slate-900 font-mono">
                    {formatRupiah(item.product.price * item.quantity)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Bottom Summary & Checkout Action */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
          {/* Subtotal & Discount row */}
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono font-medium text-slate-800">{formatRupiah(cartSubtotal)}</span>
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={() => {
                  setDiscountInput(cartDiscount.toString());
                  setShowDiscountModal(true);
                }}
                className="text-brand-600 hover:text-brand-700 flex items-center gap-1 font-semibold hover:underline"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>{cartDiscount > 0 ? 'Edit Diskon' : '+ Tambah Diskon'}</span>
              </button>
              {cartDiscount > 0 && (
                <span className="font-mono font-bold text-brand-600">-{formatRupiah(cartDiscount)}</span>
              )}
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">Metode Pembayaran</span>
              <button
                type="button"
                onClick={() => setIsPaymentMethodsOpen(true)}
                className="text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1"
                title="Buka daftar & tambah metode pembayaran baru"
              >
                <CreditCard className="w-3 h-3" />
                <span>+ Tambah Metode</span>
              </button>
            </div>
          </div>

          {/* Grand Total Display */}
          <div className="pt-2 border-t border-slate-200 flex items-baseline justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Total Tagihan</span>
            <span className="text-2xl font-black text-brand-600 font-mono tracking-tight">
              {formatRupiah(cartTotal)}
            </span>
          </div>

          {/* Big Checkout Button */}
          <button
            onClick={() => setIsCheckoutOpen(true)}
            disabled={cart.length === 0}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all ${
              cart.length > 0
                ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-brand-600/30 active:scale-[0.99]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>Bayar / Checkout</span>
            <span className="text-xs opacity-75 font-mono">(F9)</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>

        {/* Mobile: Back to Products button inside cart */}
        <button
          onClick={() => setMobileShowCart(false)}
          className="md:hidden mx-4 mb-3 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-50"
        >
          ← Kembali ke Produk
        </button>
      </div>

      {/* ===== MOBILE FLOATING CART BUTTON (hidden on desktop) ===== */}
      {!mobileShowCart && (
        <button
          onClick={() => setMobileShowCart(true)}
          className={`md:hidden fixed bottom-20 right-4 z-30 flex items-center gap-2.5 px-4 py-3 rounded-2xl font-bold text-sm shadow-xl transition-all active:scale-95 ${
            cart.length > 0
              ? 'bg-brand-600 text-white shadow-brand-600/40'
              : 'bg-slate-700 text-slate-300'
          }`}
          style={{ boxShadow: cart.length > 0 ? '0 8px 24px rgba(5,150,105,0.35)' : undefined }}
        >
          <ShoppingBag className="w-5 h-5" />
          <span>
            {cart.length > 0 ? `${cartItemCount} item` : 'Keranjang'}
          </span>
          {cart.length > 0 && (
            <span className="font-mono text-brand-100 text-xs">
              {formatRupiah(cartTotal)}
            </span>
          )}
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-slate-900 text-[10px] font-black shadow">
              {cartItemCount}
            </span>
          )}
        </button>
      )}

      {/* Discount Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xs w-full p-5 border border-slate-200">
            <h3 className="font-bold text-slate-800 text-sm mb-3">Atur Potongan Diskon</h3>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                Rp
              </span>
              <input
                type="number"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="0"
                autoFocus
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold font-mono focus:border-brand-600 outline-hidden"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDiscountModal(false)}
                className="flex-1 py-2 rounded-xl border border-slate-300 text-slate-600 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={handleApplyDiscount}
                className="flex-1 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Laptop Camera Barcode Scanner Modal (Triggered by 'Scan (Enter)' button) */}
      <CameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScanSuccess={handleCameraScanSuccess}
      />

      {/* Wireless Mobile Phone Scanner Pairing Modal */}
      <MobilePairingModal
        isOpen={isMobilePairingOpen}
        onClose={() => setIsMobilePairingOpen(false)}
        sessionCode={sessionCode}
        isScannerConnected={isScannerConnected}
        activeScannersCount={activeScannersCount}
      />
    </div>
  );
};
