import React, { useState, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import { formatRupiah } from '../utils/formatters';
import { PaymentMethodConfig } from '../types';
import { 
  Banknote, 
  CreditCard, 
  CheckCircle, 
  Clock, 
  X, 
  Image as ImageIcon,
  CheckSquare,
  Square,
  Sparkles,
  ChevronRight,
  Plus,
  Settings,
  Building2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

const SAMPLE_PROOFS = [
  {
    name: 'Bukti M-Banking',
    url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&q=80',
  },
  {
    name: 'Bukti Livin',
    url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&q=80',
  },
  {
    name: 'Bukti QRIS',
    url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&q=80',
  }
];

const getMethodColors = (color: string) => {
  const map: Record<string, { active: string; inactive: string; icon: string }> = {
    emerald: { active: 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-emerald-400', inactive: 'text-slate-600 hover:bg-slate-100', icon: 'text-emerald-600' },
    sky:     { active: 'bg-sky-50 text-sky-800 border-sky-400 ring-sky-400',         inactive: 'text-slate-600 hover:bg-slate-100', icon: 'text-sky-600' },
    blue:    { active: 'bg-blue-50 text-blue-800 border-blue-400 ring-blue-400',       inactive: 'text-slate-600 hover:bg-slate-100', icon: 'text-blue-600' },
    violet:  { active: 'bg-violet-50 text-violet-800 border-violet-400 ring-violet-400', inactive: 'text-slate-600 hover:bg-slate-100', icon: 'text-violet-600' },
    orange:  { active: 'bg-orange-50 text-orange-800 border-orange-400 ring-orange-400', inactive: 'text-slate-600 hover:bg-slate-100', icon: 'text-orange-600' },
    yellow:  { active: 'bg-yellow-50 text-yellow-800 border-yellow-400 ring-yellow-400', inactive: 'text-slate-600 hover:bg-slate-100', icon: 'text-yellow-600' },
    rose:    { active: 'bg-rose-50 text-rose-800 border-rose-400 ring-rose-400',       inactive: 'text-slate-600 hover:bg-slate-100', icon: 'text-rose-600' },
    slate:   { active: 'bg-slate-100 text-slate-800 border-slate-400 ring-slate-400',  inactive: 'text-slate-600 hover:bg-slate-100', icon: 'text-slate-600' },
  };
  return map[color] || map['slate'];
};

export const CheckoutModal: React.FC = () => {
  const { 
    isCheckoutOpen, 
    setIsCheckoutOpen, 
    cartTotal, 
    cartSubtotal, 
    cartDiscount,
    cartItemCount,
    createCashTransaction, 
    createTransferTransaction,
    paymentMethods,
    setIsPaymentMethodsOpen,
  } = usePOS();

  // Active methods only
  const activeMethods = paymentMethods.filter(m => m.isActive);
  const defaultMethod = activeMethods.find(m => m.isDefault) || activeMethods[0];

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodConfig | null>(null);

  // Tunai state
  const [cashGiven, setCashGiven] = useState<number>(0);

  // Transfer state
  const [selectedProofUrl, setSelectedProofUrl] = useState<string>(SAMPLE_PROOFS[0].url);
  const [isVerifiedByCashier, setIsVerifiedByCashier] = useState<boolean>(false);
  const [customProofUpload, setCustomProofUpload] = useState<string | null>(null);

  useEffect(() => {
    if (isCheckoutOpen) {
      setCashGiven(cartTotal);
      setIsVerifiedByCashier(false);
      setCustomProofUpload(null);
      setSelectedProofUrl(SAMPLE_PROOFS[0].url);
      // Reset to default method
      setSelectedMethod(defaultMethod || null);
    }
  }, [isCheckoutOpen, cartTotal]);

  // Update defaultMethod if methods change while modal is closed
  useEffect(() => {
    if (!isCheckoutOpen && !selectedMethod) {
      setSelectedMethod(defaultMethod || null);
    }
  }, [activeMethods.length]);

  if (!isCheckoutOpen) return null;

  const isTunai = selectedMethod?.type === 'TUNAI';
  const changeAmount = Math.max(0, cashGiven - cartTotal);
  const isCashSufficient = cashGiven >= cartTotal;

  // Handle Cash Confirm
  const handleCashConfirm = () => {
    if (!isCashSufficient || !selectedMethod) return;
    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    } catch (e) { /* ignore */ }
    createCashTransaction(cashGiven, selectedMethod.name);
  };

  // Handle Transfer Direct Confirm
  const handleTransferConfirm = (directConfirm: boolean) => {
    if (!selectedMethod) return;
    if (directConfirm && !isVerifiedByCashier) return;
    
    if (directConfirm) {
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
      } catch (e) { /* ignore */ }
    }
    
    const proof = customProofUpload || selectedProofUrl;
    createTransferTransaction(selectedMethod.name, selectedMethod.name, proof, directConfirm);
  };

  // Quick cash buttons
  const quickCashOptions = [
    cartTotal,
    Math.ceil(cartTotal / 10000) * 10000,
    Math.ceil(cartTotal / 50000) * 50000,
    100000,
    200000,
  ].filter((v, idx, self) => v >= cartTotal && self.indexOf(v) === idx).slice(0, 4);

  // Handle image file upload simulation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        setCustomProofUpload(result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        
        {/* Header with Total to Pay */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <span className="text-xs text-brand-400 font-mono tracking-wider uppercase font-semibold">
              Konfirmasi Pembayaran Kasir
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <h2 className="text-2xl font-extrabold tracking-tight text-white">
                {formatRupiah(cartTotal)}
              </h2>
              <span className="text-xs text-slate-400">({cartItemCount} item belanja)</span>
            </div>
          </div>

          <button
            onClick={() => setIsCheckoutOpen(false)}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ===== DYNAMIC PAYMENT METHOD SELECTOR ===== */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pilih Metode Pembayaran</p>
            <button
              type="button"
              onClick={() => setIsPaymentMethodsOpen(true)}
              className="text-[11px] font-bold text-brand-700 hover:text-brand-800 flex items-center gap-1 bg-white hover:bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200 shadow-2xs transition-colors"
              title="Tambah metode baru atau kelola daftar metode pembayaran"
            >
              <Plus className="w-3 h-3 text-brand-600" />
              <span>Tambah / Kelola</span>
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {activeMethods.map((method) => {
              const isSelected = selectedMethod?.id === method.id;
              const colors = getMethodColors(method.color);
              return (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method)}
                  className={`flex items-center gap-2 py-2 px-3.5 rounded-xl border font-semibold text-xs whitespace-nowrap transition-all shrink-0 ${
                    isSelected
                      ? `${colors.active} border-2 ring-1 shadow-sm`
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-base leading-none">{method.icon}</span>
                  <span>{method.name}</span>
                  {method.type === 'TUNAI'
                    ? <Banknote className={`w-3.5 h-3.5 ${isSelected ? colors.icon : 'text-slate-400'}`} />
                    : <CreditCard className={`w-3.5 h-3.5 ${isSelected ? colors.icon : 'text-slate-400'}`} />
                  }
                  {isSelected && <ChevronRight className="w-3 h-3 opacity-60" />}
                </button>
              );
            })}
          </div>
          {/* Type badge for selected method */}
          {selectedMethod && (
            <div className="mt-2 px-1">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isTunai ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
              }`}>
                {isTunai ? <Banknote className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                {isTunai ? 'Konfirmasi langsung — langsung lunas' : 'Memerlukan bukti transfer — kasir verifikasi'}
              </span>
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* ===================== TUNAI / DIRECT CONFIRM ===================== */}
          {selectedMethod && isTunai && (
            <div className="space-y-5">
              {/* Cash Given Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Nominal Uang Diterima dari Pelanggan
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">
                    Rp
                  </span>
                  <input
                    type="number"
                    value={cashGiven || ''}
                    onChange={(e) => setCashGiven(Number(e.target.value) || 0)}
                    autoFocus
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-brand-600 focus:bg-white rounded-2xl text-2xl font-bold text-slate-900 font-mono tracking-tight outline-hidden transition-all"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div>
                <span className="block text-xs text-slate-500 font-medium mb-2">Pilihan Cepat Nominal:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCashGiven(cartTotal)}
                    className="py-2 px-3.5 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 hover:bg-brand-100 font-bold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Uang Pas ({formatRupiah(cartTotal)})
                  </button>

                  {quickCashOptions.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setCashGiven(amount)}
                      className={`py-2 px-3.5 rounded-xl font-bold text-xs transition-colors border ${
                        cashGiven === amount
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {formatRupiah(amount)}
                    </button>
                  ))}

                  <button
                    onClick={() => setCashGiven(prev => prev + 10000)}
                    className="py-2 px-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 font-medium text-xs"
                  >
                    +10.000
                  </button>
                  <button
                    onClick={() => setCashGiven(prev => prev + 50000)}
                    className="py-2 px-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 font-medium text-xs"
                  >
                    +50.000
                  </button>
                </div>
              </div>

              {/* Change Calculation Box */}
              <div className={`p-4 rounded-2xl border-2 transition-all ${
                isCashSufficient
                  ? 'bg-emerald-50/70 border-brand-500 text-emerald-950'
                  : 'bg-rose-50/70 border-rose-400 text-rose-950'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {isCashSufficient ? 'Uang Kembalian' : 'Kekurangan Uang'}
                  </span>
                  <span className={`text-2xl font-mono font-extrabold ${isCashSufficient ? 'text-brand-700' : 'text-rose-600'}`}>
                    {isCashSufficient ? formatRupiah(changeAmount) : `-${formatRupiah(cartTotal - cashGiven)}`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isCashSufficient
                    ? 'Nominal cukup. Siap dikonfirmasi dan dicetak struk.'
                    : 'Uang pembayaran belum mencukupi total belanja.'}
                </p>
              </div>
            </div>
          )}

          {/* ===================== TRANSFER / PERLU BUKTI ===================== */}
          {selectedMethod && !isTunai && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <span className="text-2xl">{selectedMethod.icon}</span>
                <div>
                  <div className="text-sm font-bold text-slate-800">{selectedMethod.name}</div>
                  <div className="text-[11px] text-slate-500">Kasir perlu verifikasi bukti transfer dari pelanggan</div>
                </div>
              </div>

              {/* Bank Account Details Card */}
              {(selectedMethod.bankName || selectedMethod.accountNumber || selectedMethod.description) && (
                <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-sky-600" />
                      <span>{selectedMethod.bankName || selectedMethod.name}</span>
                    </span>
                    {selectedMethod.accountHolder && (
                      <span className="text-[11px] text-sky-700 font-medium">
                        A/N: <strong>{selectedMethod.accountHolder}</strong>
                      </span>
                    )}
                  </div>

                  {selectedMethod.accountNumber && (
                    <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-sky-200">
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Nomor Rekening / VA</p>
                        <p className="text-sm font-mono font-black text-slate-900 tracking-wider">
                          {selectedMethod.accountNumber}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedMethod.accountNumber!);
                          alert(`Nomor rekening ${selectedMethod.accountNumber} berhasil disalin!`);
                        }}
                        className="text-xs font-bold text-sky-700 hover:text-sky-800 bg-sky-100 hover:bg-sky-200 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        Salin No. Rek
                      </button>
                    </div>
                  )}

                  {selectedMethod.description && (
                    <p className="text-[11px] text-sky-800/90 leading-tight">
                      💡 {selectedMethod.description}
                    </p>
                  )}
                </div>
              )}

              {/* Cashier Verification Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-brand-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Pratinjau Bukti Transfer
                    </span>
                  </div>
                  
                  {/* File Upload */}
                  <label className="text-xs font-semibold text-brand-600 hover:text-brand-700 cursor-pointer underline">
                    Unggah Bukti Baru
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Sample selector */}
                <div className="flex gap-2">
                  {SAMPLE_PROOFS.map((proof, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCustomProofUpload(null);
                        setSelectedProofUrl(proof.url);
                      }}
                      className={`text-[11px] py-1 px-2.5 rounded-lg border font-medium ${
                        !customProofUpload && selectedProofUrl === proof.url
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {proof.name}
                    </button>
                  ))}
                </div>

                {/* Proof Image Box */}
                <div className="relative h-44 rounded-xl border border-slate-200 bg-slate-900 overflow-hidden flex items-center justify-center">
                  <img
                    src={customProofUpload || selectedProofUrl}
                    alt="Bukti Transfer Pelanggan"
                    className="w-full h-full object-cover object-center opacity-90"
                  />
                  <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-xs text-white px-2 py-1 rounded text-[10px] font-mono">
                    Nominal: {formatRupiah(cartTotal)} • Valid
                  </div>
                </div>

                {/* Cashier Verification Checkbox */}
                <div 
                  onClick={() => setIsVerifiedByCashier(!isVerifiedByCashier)}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    isVerifiedByCashier
                      ? 'bg-brand-50 border-brand-500 text-brand-950'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="mt-0.5 text-brand-600 shrink-0">
                    {isVerifiedByCashier ? (
                      <CheckSquare className="w-5 h-5 fill-brand-600 text-white" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-snug">
                      Saya telah memverifikasi bukti & mutasi rekening masuk sesuai nominal {formatRupiah(cartTotal)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Centang kotak ini untuk mengonfirmasi bahwa dana sudah benar-benar diterima.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* No method selected */}
          {!selectedMethod && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <CreditCard className="w-10 h-10 mb-2 stroke-1" />
              <p className="text-sm">Pilih metode pembayaran di atas.</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={() => setIsCheckoutOpen(false)}
            className="py-3 px-5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors"
          >
            Batal
          </button>

          {/* Action for TUNAI / Direct confirm */}
          {selectedMethod && isTunai && (
            <button
              onClick={handleCashConfirm}
              disabled={!isCashSufficient}
              className={`flex-1 py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all ${
                isCashSufficient
                  ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-brand-600/30'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <CheckCircle className="w-5 h-5" />
              <span>Konfirmasi Lunas — {selectedMethod.name}</span>
            </button>
          )}

          {/* Actions for TRANSFER */}
          {selectedMethod && !isTunai && (
            <div className="flex-1 flex gap-2">
              <button
                onClick={() => handleTransferConfirm(false)}
                className="py-3.5 px-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 font-semibold text-xs hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5"
                title="Simpan ke antrean konfirmasi untuk dicek nanti"
              >
                <Clock className="w-4 h-4 text-amber-700" />
                <span>Simpan Pending</span>
              </button>

              <button
                onClick={() => handleTransferConfirm(true)}
                disabled={!isVerifiedByCashier}
                className={`flex-1 py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all ${
                  isVerifiedByCashier
                    ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-brand-600/30'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle className="w-5 h-5" />
                <span>Konfirmasi Lunas</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
