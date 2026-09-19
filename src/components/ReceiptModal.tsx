import React from 'react';
import { usePOS } from '../context/POSContext';
import { formatRupiah, formatDateTime } from '../utils/formatters';
import { Printer, CheckCircle2, X } from 'lucide-react';

export const ReceiptModal: React.FC = () => {
  const { selectedReceipt, setSelectedReceipt, cashier } = usePOS();

  if (!selectedReceipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    setSelectedReceipt(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Action Bar (Hidden in print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-brand-400" />
            <span className="font-semibold text-sm">
              {selectedReceipt.status === 'LUNAS' ? 'Transaksi Selesai' : 'Nota Menunggu Konfirmasi'}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Paper Thermal Receipt */}
        <div className="overflow-y-auto p-6 bg-slate-50 flex justify-center">
          <div
            id="printable-receipt"
            className="w-full max-w-[320px] bg-white p-5 border border-slate-200 rounded shadow-xs font-mono text-xs text-slate-800"
          >
            {/* Store Branding */}
            <div className="text-center pb-3 border-b border-dashed border-slate-400">
              <h2 className="font-bold text-sm text-slate-900 uppercase tracking-tight">
                {cashier.outletName}
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

              {/* Payment specific breakdowns */}
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

              {selectedReceipt.paymentMethod === 'TRANSFER' && (
                <div className="pt-1 text-[10px] text-slate-500">
                  <div className="flex justify-between">
                    <span>Bank:</span>
                    <span className="font-medium text-slate-800">{selectedReceipt.transferBank || 'BCA / QRIS'}</span>
                  </div>
                  {selectedReceipt.transferConfirmedBy && (
                    <div className="flex justify-between text-brand-700 font-medium mt-0.5">
                      <span>Diverifikasi oleh:</span>
                      <span>{selectedReceipt.transferConfirmedBy}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Barcode Graphic Simulation */}
            <div className="pt-4 text-center">
              <div className="inline-flex flex-col items-center">
                {/* Visual Barcode Bars */}
                <div className="flex items-center gap-0.5 h-8">
                  {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 4, 2, 3, 1, 2, 4, 1, 2, 3].map((w, i) => (
                    <div
                      key={i}
                      className="bg-slate-900 h-full"
                      style={{ width: `${w}px` }}
                    />
                  ))}
                </div>
                <span className="text-[9px] tracking-widest text-slate-500 mt-1">
                  *{selectedReceipt.invoiceNumber.replace(/\//g, '')}*
                </span>
              </div>

              <p className="text-[10px] text-slate-500 mt-3 italic">
                Terima kasih atas kunjungan Anda!
              </p>
              <p className="text-[9px] text-slate-400">
                Barang yang sudah dibeli tidak dapat ditukar/dikembalikan
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions (Hidden in print) */}
        <div className="p-4 bg-white border-t border-slate-200 flex gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-3 bg-slate-900 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Cetak Struk (Print)
          </button>
          <button
            onClick={handleClose}
            className="py-2.5 px-4 bg-brand-600 text-white rounded-xl font-semibold text-xs hover:bg-brand-700 transition-colors"
          >
            Selesai / Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
