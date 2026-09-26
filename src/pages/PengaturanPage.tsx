import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { 
  Settings, 
  Store, 
  Phone, 
  MapPin, 
  Boxes, 
  Receipt, 
  Database, 
  Check, 
  AlertCircle, 
  RefreshCw,
  Sliders,
  ShieldCheck
} from 'lucide-react';
import { ArfaLogo } from '../components/ArfaLogo';

export const PengaturanPage: React.FC = () => {
  const { storeSettings, updateStoreSettings, isDbConnected, resetToDemoData } = usePOS();

  const [storeName, setStoreName] = useState<string>(storeSettings.storeName || 'ARFA FASHION');
  const [storeAddress, setStoreAddress] = useState<string>(storeSettings.storeAddress || 'Jl. Merdeka Raya No. 45, Jakarta Pusat');
  const [storePhone, setStorePhone] = useState<string>(storeSettings.storePhone || '021-5550192');
  const [minStockAlert, setMinStockAlert] = useState<number>(storeSettings.minStockAlert || 5);
  const [receiptFooter, setReceiptFooter] = useState<string>(storeSettings.receiptFooter || 'Terima kasih telah berbelanja di ARFA FASHION!');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);

    const res = await updateStoreSettings({
      storeName: storeName.trim(),
      storeAddress: storeAddress.trim(),
      storePhone: storePhone.trim(),
      minStockAlert: Number(minStockAlert) || 5,
      receiptFooter: receiptFooter.trim(),
    });

    setIsSaving(false);
    if (res.success) {
      setSaveMessage('Pengaturan toko berhasil disimpan ke database Neon PostgreSQL!');
      setTimeout(() => setSaveMessage(null), 3000);
    } else {
      alert(res.error || 'Gagal menyimpan pengaturan.');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-y-auto p-4 md:p-6 space-y-6">
      
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-800">
              Pengaturan Toko &amp; Sistem POS
            </h1>
            <p className="text-xs text-slate-500">
              Konfigurasi identitas toko fisik, peringatan inventaris stok, dan sistem basis data.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 ${
            isDbConnected ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>{isDbConnected ? 'Neon PostgreSQL Terhubung' : 'Mode Offline / Local'}</span>
          </div>
        </div>
      </div>

      {saveMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Identitas Toko (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Store className="w-5 h-5 text-brand-600" />
              <h2 className="font-bold text-sm text-slate-900">
                Profil &amp; Identitas Toko Fisik
              </h2>
            </div>

            {/* Nama Toko */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Toko / Brand
              </label>
              <div className="relative">
                <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-brand-600 outline-none"
                />
              </div>
            </div>

            {/* Alamat Toko */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Alamat Toko Lengkap
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <textarea
                  rows={2}
                  required
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:border-brand-600 outline-none resize-none font-medium"
                />
              </div>
            </div>

            {/* Nomor Telepon */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nomor Telepon / WhatsApp Toko
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium text-slate-900 focus:border-brand-600 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Pengaturan Inventaris & Struk */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Sliders className="w-5 h-5 text-amber-600" />
              <h2 className="font-bold text-sm text-slate-900">
                Pengaturan Inventaris &amp; Struk
              </h2>
            </div>

            {/* Ambang Batas Stok Menipis */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Batas Minimum Peringatan Stok Menipis (Unit)
              </label>
              <div className="relative">
                <Boxes className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={minStockAlert}
                  onChange={(e) => setMinStockAlert(Number(e.target.value) || 5)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:border-brand-600 outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Produk dengan stok di bawah atau sama dengan angka ini akan memicu tanda peringatan kuning di Dashboard dan Stok.
              </p>
            </div>

            {/* Pesan Footer Struk */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Kaki Nota Struk (Footer)
              </label>
              <div className="relative">
                <Receipt className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <textarea
                  rows={2}
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:border-brand-600 outline-none resize-none font-medium"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="py-3 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/25 flex items-center gap-2 transition-all active:scale-[0.99] disabled:opacity-60"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan Pengaturan...' : 'Simpan Pengaturan Toko'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Info Sistem & Pemeliharaan (1 Col) */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Database className="w-5 h-5 text-slate-700" />
              <h2 className="font-bold text-sm text-slate-900">
                Informasi Sistem &amp; Server
              </h2>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Aplikasi</span>
                <p className="font-bold text-slate-900">ARFA FASHION POS Terminal</p>
                <p className="text-[11px] text-slate-500">Versi 2.0 (Multi-Role &amp; Varian Stok)</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Basis Data</span>
                <p className="font-bold text-slate-900">Neon PostgreSQL Cloud</p>
                <p className="text-[11px] text-slate-500">Katalog fashion, mutasi stok, akun role</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Keamanan</span>
                <p className="font-bold text-slate-900">HMAC-SHA256 Token Auth</p>
                <p className="text-[11px] text-slate-500">Proteksi endpoint backend per role</p>
              </div>
            </div>
          </div>

          {/* Reset Cache Demo Box */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-rose-600">
              Zona Pemeliharaan
            </h3>
            <p className="text-xs text-slate-500">
              Bersihkan cache peramban lokal jika terjadi ketidaksesuaian tampilan sementara.
            </p>
            <button
              type="button"
              onClick={() => {
                if (confirm('Bersihkan penyimpanan lokal browser dan muat ulang?')) {
                  resetToDemoData();
                  window.location.reload();
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Cache Browser</span>
            </button>
          </div>
        </div>

      </form>

    </div>
  );
};
