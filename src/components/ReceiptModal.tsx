import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { formatRupiah, formatDateTime } from '../utils/formatters';
import { Printer, CheckCircle2, X, FileText, Receipt, Edit3, ArrowRight } from 'lucide-react';

export const ReceiptModal: React.FC = () => {
  const { selectedReceipt, setSelectedReceipt, cashier, paymentMethods } = usePOS();

  // Mode: default to 'invoice' (A4 ARFA FASHION style matching invoice-by-elfara.html)
  const [viewMode, setViewMode] = useState<'invoice' | 'thermal'>('invoice');

  // Editable customer info
  const [customerName, setCustomerName] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [isEditingInfo, setIsEditingInfo] = useState<boolean>(false);

  // Sync customer info when selectedReceipt changes
  React.useEffect(() => {
    if (selectedReceipt) {
      setCustomerName(selectedReceipt.customerNote || 'Fransiska');
      setCustomerAddress('');
      setIsEditingInfo(false);
      setViewMode('invoice');
    }
  }, [selectedReceipt]);

  if (!selectedReceipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    setSelectedReceipt(null);
  };

  // Format date to Indonesian (e.g. "25 September 2026")
  const formatDateIndo = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const totalQuantity = selectedReceipt.items.reduce((sum, item) => sum + item.quantity, 0);

  // Ledger empty rows to match authentic invoice design
  const minRows = 6;
  const emptyRowsCount = Math.max(0, minRows - selectedReceipt.items.length);

  // Bank account info from paymentMethods or default
  const bcaMethod = paymentMethods.find(m => m.name.toLowerCase().includes('bca') || m.bankName?.toLowerCase().includes('bca'));
  const bankAccountStr = bcaMethod?.accountNumber ? `${bcaMethod.accountNumber} BCA a/n` : '7160179109 BCA a/n';
  const accountHolderStr = bcaMethod?.accountHolder || 'Amelia Azizah';

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200">
      <div className={`bg-white rounded-3xl shadow-2xl w-full overflow-hidden flex flex-col max-h-[95vh] border border-slate-200 transition-all ${
        viewMode === 'invoice' ? 'max-w-4xl' : 'max-w-md'
      }`}>
        
        {/* Top Control Bar (Screen only, hidden on print) */}
        <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white truncate">
                  {selectedReceipt.status === 'LUNAS' ? 'Transaksi Selesai' : 'Nota Menunggu Konfirmasi'}
                </h3>
                <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-medium">
                  {selectedReceipt.invoiceNumber}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {selectedReceipt.status === 'LUNAS' ? 'Pembayaran berhasil diverifikasi' : 'Menunggu verifikasi bukti transfer'}
              </p>
            </div>
          </div>

          {/* View Mode Toggle & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Format Switcher */}
            <div className="flex items-center p-0.5 bg-slate-800 rounded-xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => setViewMode('invoice')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'invoice'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Format Invoice A4 ARFA FASHION"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Invoice A4</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('thermal')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'thermal'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Format Struk Thermal Roll"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Struk Kasir</span>
              </button>
            </div>

            {viewMode === 'invoice' && (
              <button
                onClick={() => setIsEditingInfo(!isEditingInfo)}
                className={`p-1.5 sm:py-1.5 sm:px-3 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors ${
                  isEditingInfo
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
                title="Edit Nama / Alamat Pelanggan"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{isEditingInfo ? 'Simpan' : 'Edit Info'}</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="py-1.5 px-3 sm:px-4 rounded-xl bg-[#004b93] hover:bg-[#00366a] text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-950/40"
              title="Cetak Struk atau Simpan ke PDF"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Cetak</span>
            </button>

            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Edit Bar (Screen only) */}
        {viewMode === 'invoice' && isEditingInfo && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 text-xs flex flex-wrap items-center gap-3 shrink-0 print:hidden animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-amber-900">Kepada:</span>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama Pelanggan"
                className="px-2 py-1 bg-white border border-amber-300 rounded text-xs text-slate-800 outline-none w-40 font-semibold"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-amber-900">Alamat:</span>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Alamat Pelanggan (opsional)"
                className="px-2 py-1 bg-white border border-amber-300 rounded text-xs text-slate-800 outline-none w-52"
              />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: INVOICE A4 (STYLE ARFA FASHION / BY.ELFARA)                       */}
        {/* ========================================================================= */}
        {viewMode === 'invoice' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-100 flex justify-center print:p-0 print:bg-white">
            <div
              id="printable-arfa-invoice"
              className="w-full max-w-[760px] bg-white p-6 sm:p-10 md:p-12 border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0 flex flex-col justify-between"
              style={{ minHeight: '940px' }}
            >
              <div>
                {/* 1. Header Section (INVOICE & ARFA FASHION Emblem) */}
                <div className="flex items-start justify-between mb-4 sm:mb-5">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-black tracking-tight pt-2 sm:pt-4">
                    INVOICE
                  </h1>

                  <div className="flex flex-col items-center">
                    {/* Pink Badge Circle with Wreath Ornament */}
                    <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-pink-50 to-pink-100 border border-pink-200 flex flex-col items-center justify-center relative shadow-xs">
                      <svg className="absolute w-[86%] h-[86%] pointer-events-none opacity-80" viewBox="0 0 100 100" fill="none">
                        <circle cx="50" cy="50" r="42" stroke="#f472b6" strokeWidth="1.2" strokeDasharray="3 3"/>
                        <path d="M48 10C50 15 45 18 43 20" stroke="#f472b6" strokeWidth="1" strokeLinecap="round"/>
                        <path d="M52 10C50 15 55 18 57 20" stroke="#f472b6" strokeWidth="1" strokeLinecap="round"/>
                        <path d="M48 90C50 85 45 82 43 80" stroke="#f472b6" strokeWidth="1" strokeLinecap="round"/>
                        <path d="M52 90C50 85 55 82 57 80" stroke="#f472b6" strokeWidth="1" strokeLinecap="round"/>
                      </svg>
                      <span className="font-serif italic font-semibold text-pink-600 text-[11px] sm:text-xs tracking-tight text-center px-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        Arfa Fashion
                      </span>
                    </div>
                    {/* Brand text */}
                    <span className="mt-2 text-xs sm:text-sm font-extrabold tracking-widest text-black uppercase">
                      ARFA FASHION
                    </span>
                  </div>
                </div>

                {/* Double Horizontal Divider */}
                <div className="w-full border-t border-b border-slate-300 h-1 my-4 sm:my-5"></div>

                {/* 2. Customer & Invoice Details */}
                <div className="space-y-1.5 text-xs sm:text-sm mb-5 sm:mb-6 text-black">
                  <div className="flex items-baseline">
                    <span className="w-24 sm:w-28 font-bold text-black">Kepada</span>
                    <span className="w-4 font-bold text-black">:</span>
                    <span className="font-bold text-black">{customerName || 'Fransiska'}</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="w-24 sm:w-28 font-bold text-black">Alamat</span>
                    <span className="w-4 font-bold text-black">:</span>
                    <span className="text-black">{customerAddress || ''}</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="w-24 sm:w-28 font-bold text-black">No.</span>
                    <span className="w-4 font-bold text-black">:</span>
                    <span className="text-black">-</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="w-24 sm:w-28 font-bold text-black">Invoice</span>
                    <span className="w-4 font-bold text-black">:</span>
                    <span className="font-mono font-bold text-black">{selectedReceipt.invoiceNumber}</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="w-24 sm:w-28 font-bold text-black">Tanggal</span>
                    <span className="w-4 font-bold text-black">:</span>
                    <span className="font-bold text-black">{formatDateIndo(selectedReceipt.date)}</span>
                  </div>
                </div>

                {/* 3. Shopping Items Table (Royal Blue Header #004b93) */}
                <div className="w-full mb-4 overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[#004b93] text-white text-[11px] sm:text-xs md:text-[13px] font-extrabold uppercase tracking-wide">
                        <th className="py-2.5 px-2 text-center w-10 sm:w-12 border-r border-white">NO.</th>
                        <th className="py-2.5 px-3 sm:px-4 text-left border-r border-white">DESKRIPSI</th>
                        <th className="py-2.5 px-2 text-center w-14 sm:w-16 border-r border-white">JML</th>
                        <th className="py-2.5 px-2 sm:px-3 text-center w-28 sm:w-32 border-r border-white">HARGA</th>
                        <th className="py-2.5 px-2 sm:px-3 text-center w-32 sm:w-36">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs sm:text-sm">
                      {selectedReceipt.items.map((item, idx) => (
                        <tr key={idx} className="border-b-[1.5px] border-slate-700">
                          <td className="py-2.5 px-2 text-center font-bold text-black align-middle">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 text-left align-middle">
                            <div className="font-extrabold text-black text-xs sm:text-[13px] leading-snug">
                              {item.name}
                            </div>
                            {item.brand && (
                              <div className="text-[11px] font-bold text-slate-800">
                                ({item.brand})
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-black align-middle">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-2 sm:px-3 text-center font-bold text-black align-middle whitespace-nowrap">
                            {formatRupiah(item.price)}
                          </td>
                          <td className="py-2.5 px-2 sm:px-3 text-center font-bold text-black align-middle whitespace-nowrap">
                            {formatRupiah(item.subtotal)}
                          </td>
                        </tr>
                      ))}

                      {/* Empty lined ledger rows to match authentic boutique paper design */}
                      {Array.from({ length: emptyRowsCount }).map((_, i) => (
                        <tr key={`empty-${i}`} className="border-b-[1.5px] border-slate-700 h-8 sm:h-9">
                          <td colSpan={5}></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 4. Sub Total Section */}
                <div className="flex items-center justify-between my-3 sm:my-4 pt-1">
                  <div className="text-base sm:text-lg md:text-xl font-extrabold text-slate-800 pl-1">
                    Sub Total
                  </div>
                  <div className="flex items-center">
                    {/* Qty Box */}
                    <div className="w-14 sm:w-16 bg-[#004b93] text-white font-extrabold text-xs sm:text-sm py-2 text-center">
                      {totalQuantity}
                    </div>
                    {/* Spacer aligned with HARGA column */}
                    <div className="w-28 sm:w-32"></div>
                    {/* Total Box */}
                    <div className="w-32 sm:w-36 bg-[#004b93] text-white font-extrabold text-xs sm:text-sm py-2 text-center whitespace-nowrap">
                      {formatRupiah(selectedReceipt.total)}
                    </div>
                  </div>
                </div>

                {/* Cash/Change Breakdown if Tunai */}
                {selectedReceipt.paymentMethod === 'TUNAI' && selectedReceipt.cashGiven && (
                  <div className="flex justify-end gap-6 text-xs text-slate-700 font-medium py-1">
                    <div>
                      <span>Tunai Diterima: </span>
                      <span className="font-bold text-black">{formatRupiah(selectedReceipt.cashGiven)}</span>
                    </div>
                    <div>
                      <span>Kembalian: </span>
                      <span className="font-bold text-[#004b93]">{formatRupiah(selectedReceipt.changeAmount || 0)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Payment Footer Section */}
              <div className="mt-8 pt-2 text-xs sm:text-sm text-black">
                <div className="font-bold">Pembayaran:</div>
                <div className="font-bold">{bankAccountStr}</div>
                <div className="font-bold">{accountHolderStr}</div>
              </div>

            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: THERMAL RECEIPT SLIP (ROLL PRINTER COMPATIBILITY)                 */
          /* ========================================================================= */
          <div className="overflow-y-auto p-6 bg-slate-50 flex justify-center">
            <div
              id="printable-receipt"
              className="w-full max-w-[320px] bg-white p-5 border border-slate-200 rounded shadow-xs font-mono text-xs text-slate-800"
            >
              {/* Store Branding */}
              <div className="text-center pb-3 border-b border-dashed border-slate-400">
                <h2 className="font-bold text-sm text-slate-900 uppercase tracking-tight">
                  {cashier.outletName || 'ARFA FASHION'}
                </h2>
                <p className="text-[10px] text-slate-500 mt-0.5">{cashier.outletAddress}</p>
                <p className="text-[10px] text-slate-500">Telp: {cashier.outletPhone}</p>
              </div>

              {/* Meta Info */}
              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">No. Nota:</span>
                  <span className="font-bold text-slate-900">{selectedReceipt.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Waktu:</span>
                  <span>{formatDateTime(selectedReceipt.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kasir:</span>
                  <span>{selectedReceipt.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Metode:</span>
                  <span className="font-semibold">{selectedReceipt.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className={`font-bold ${selectedReceipt.status === 'LUNAS' ? 'text-brand-600' : 'text-amber-600'}`}>
                    {selectedReceipt.status}
                  </span>
                </div>
              </div>

              {/* Item Details */}
              <div className="py-3 border-b border-dashed border-slate-400 space-y-2">
                {selectedReceipt.items.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="font-medium text-slate-900 truncate">{item.name}</div>
                    <div className="flex justify-between text-slate-500 text-[10px]">
                      <span>
                        {item.quantity} x {formatRupiah(item.price)}
                      </span>
                      <span className="font-semibold text-slate-800">{formatRupiah(item.subtotal)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatRupiah(selectedReceipt.subtotal)}</span>
                </div>
                {selectedReceipt.discount > 0 && (
                  <div className="flex justify-between text-brand-600">
                    <span>Diskon</span>
                    <span>-{formatRupiah(selectedReceipt.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>TOTAL</span>
                  <span>{formatRupiah(selectedReceipt.total)}</span>
                </div>

                {selectedReceipt.paymentMethod === 'TUNAI' && (
                  <>
                    <div className="flex justify-between text-slate-600 pt-1">
                      <span>Tunai Diterima</span>
                      <span>{formatRupiah(selectedReceipt.cashGiven || selectedReceipt.total)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>Kembalian</span>
                      <span className="text-brand-600">{formatRupiah(selectedReceipt.changeAmount || 0)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Barcode Simulation */}
              <div className="pt-4 text-center">
                <div className="inline-flex flex-col items-center">
                  <div className="flex items-center gap-0.5 h-8">
                    {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 4, 2, 3, 1, 2, 4, 1, 2, 3].map((w, i) => (
                      <div key={i} className="bg-slate-900 h-full" style={{ width: `${w}px` }} />
                    ))}
                  </div>
                  <span className="text-[9px] tracking-widest text-slate-500 mt-1">
                    *{selectedReceipt.invoiceNumber.replace(/\//g, '')}*
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-3 italic">
                  Terima kasih atas kunjungan Anda!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions (Hidden on print) */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Format cetak standar ARFA FASHION (Warna biru & pink terkunci otomatis)</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-initial py-2.5 px-5 bg-[#004b93] hover:bg-[#00366a] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-900/30"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Invoice (PDF)</span>
            </button>
            <button
              onClick={handleClose}
              className="flex-1 sm:flex-initial py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors"
            >
              Selesai / Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
