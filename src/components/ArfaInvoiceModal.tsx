import React, { useState } from 'react';
import { Transaction } from '../types';
import { formatRupiah } from '../utils/formatters';
import { Printer, X, FileText, CheckCircle2, Edit3 } from 'lucide-react';

interface ArfaInvoiceModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const ArfaInvoiceModal: React.FC<ArfaInvoiceModalProps> = ({ transaction, onClose }) => {
  if (!transaction) return null;

  // Editable customer info states so cashier can tailor it for printing
  const [customerName, setCustomerName] = useState<string>(transaction.customerNote || 'Fransiska');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [bankInfo, setBankInfo] = useState<string>('7160179109 BCA a/n');
  const [accountHolder, setAccountHolder] = useState<string>('Amelia Azizah');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Format date to Indonesian (e.g. "24 September 2026")
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

  const totalQuantity = transaction.items.reduce((sum, item) => sum + item.quantity, 0);

  // Fill up empty ledger rows so the invoice matches the exact paper design
  const minRows = 8;
  const emptyRowsCount = Math.max(0, minRows - transaction.items.length);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[94vh] border border-slate-200">
        
        {/* Top Control Bar (Screen only, hidden on print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>Invoice A4 — ARFA FASHION</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono font-normal">
                  {transaction.invoiceNumber}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Format standar cetak invoice retail (A4 Portrait)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                isEditing
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Selesai Edit' : 'Edit Info'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="py-1.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-900/40"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Invoice</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Edit Panel Drawer (If opened) */}
        {isEditing && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 text-xs flex flex-wrap items-center gap-3 print:hidden">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-amber-900">Nama Pelanggan:</span>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Contoh: Fransiska"
                className="px-2 py-1 bg-white border border-amber-300 rounded text-xs text-slate-800 outline-none w-36 font-semibold"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-bold text-amber-900">Alamat:</span>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="(Opsional)"
                className="px-2 py-1 bg-white border border-amber-300 rounded text-xs text-slate-800 outline-none w-44"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-bold text-amber-900">Rekening:</span>
              <input
                type="text"
                value={bankInfo}
                onChange={(e) => setBankInfo(e.target.value)}
                className="px-2 py-1 bg-white border border-amber-300 rounded text-xs text-slate-800 outline-none w-36"
              />
              <input
                type="text"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                className="px-2 py-1 bg-white border border-amber-300 rounded text-xs text-slate-800 outline-none w-32"
              />
            </div>
          </div>
        )}

        {/* Printable Invoice Container */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-100 flex justify-center print:p-0 print:bg-white">
          <div
            id="printable-arfa-invoice"
            className="w-full max-w-[760px] bg-white p-10 md:p-12 border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0 flex flex-col justify-between"
            style={{ minHeight: '980px' }}
          >
            <div>
              {/* 1. Header (INVOICE & ARFA FASHION Logo) */}
              <div className="flex items-start justify-between mb-5">
                <h1 className="text-4xl md:text-5xl font-black text-black tracking-tight pt-3">
                  INVOICE
                </h1>

                <div className="flex flex-col items-center">
                  {/* Pink Badge Circle */}
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-50 to-pink-100 border border-pink-200 flex flex-col items-center justify-center relative shadow-xs">
                    <svg className="absolute w-[86%] h-[86%] pointer-events-none opacity-80" viewBox="0 0 100 100" fill="none">
                      <circle cx="50" cy="50" r="42" stroke="#f472b6" strokeWidth="1.2" strokeDasharray="3 3"/>
                      <path d="M48 10C50 15 45 18 43 20" stroke="#f472b6" strokeWidth="1" strokeLinecap="round"/>
                      <path d="M52 10C50 15 55 18 57 20" stroke="#f472b6" strokeWidth="1" strokeLinecap="round"/>
                      <path d="M48 90C50 85 45 82 43 80" stroke="#f472b6" strokeWidth="1" strokeLinecap="round"/>
                      <path d="M52 90C50 85 55 82 57 80" stroke="#f472b6" strokeWidth="1" strokeLinecap="round"/>
                    </svg>
                    <span className="font-serif italic font-semibold text-pink-600 text-xs tracking-tight text-center px-1">
                      Arfa Fashion
                    </span>
                  </div>
                  {/* Brand text */}
                  <span className="mt-2 text-sm font-extrabold tracking-widest text-black uppercase">
                    ARFA FASHION
                  </span>
                </div>
              </div>

              {/* Double Horizontal Divider */}
              <div className="w-full border-t border-b border-slate-300 h-1 my-5"></div>

              {/* 2. Customer Information (Informasi Nota) */}
              <div className="space-y-1.5 text-sm mb-6 text-black">
                <div className="flex items-baseline">
                  <span className="w-28 font-bold text-black">Kepada</span>
                  <span className="w-4 font-bold text-black">:</span>
                  <span className="font-bold text-black">{customerName || '-'}</span>
                </div>
                <div className="flex items-baseline">
                  <span className="w-28 font-bold text-black">Alamat</span>
                  <span className="w-4 font-bold text-black">:</span>
                  <span className="text-black">{customerAddress || ''}</span>
                </div>
                <div className="flex items-baseline">
                  <span className="w-28 font-bold text-black">No.</span>
                  <span className="w-4 font-bold text-black">:</span>
                  <span className="text-black">-</span>
                </div>
                <div className="flex items-baseline">
                  <span className="w-28 font-bold text-black">Invoice</span>
                  <span className="w-4 font-bold text-black">:</span>
                  <span className="font-mono font-bold text-black">{transaction.invoiceNumber}</span>
                </div>
                <div className="flex items-baseline">
                  <span className="w-28 font-bold text-black">Tanggal</span>
                  <span className="w-4 font-bold text-black">:</span>
                  <span className="font-bold text-black">{formatDateIndo(transaction.date)}</span>
                </div>
              </div>

              {/* 3. Shopping Items Table */}
              <div className="w-full mb-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#004b93] text-white text-xs md:text-[13px] font-extrabold uppercase tracking-wide">
                      <th className="py-2.5 px-2 text-center w-12 border-r border-white">NO.</th>
                      <th className="py-2.5 px-4 text-left border-r border-white">DESKRIPSI</th>
                      <th className="py-2.5 px-2 text-center w-16 border-r border-white">JML</th>
                      <th className="py-2.5 px-3 text-center w-32 border-r border-white">HARGA</th>
                      <th className="py-2.5 px-3 text-center w-36">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {transaction.items.map((item, idx) => (
                      <tr key={idx} className="border-b-[1.5px] border-slate-700">
                        <td className="py-2 px-2 text-center font-bold text-black align-middle">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-4 text-left align-middle">
                          <div className="font-extrabold text-black text-xs md:text-sm leading-snug">
                            {item.name}
                          </div>
                          {item.brand && (
                            <div className="text-[11px] font-bold text-slate-800">
                              ({item.brand})
                            </div>
                          )}
                          {/* Variant: warna & ukuran */}
                          {(item.selectedColor || item.selectedSize) && (
                            <div className="text-[10px] text-slate-600 font-medium mt-0.5 flex items-center gap-1.5">
                              {item.selectedColor && (
                                <span>🎨 {item.selectedColor}</span>
                              )}
                              {item.selectedSize && (
                                <span>📏 {item.selectedSize}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-black align-middle">
                          {item.quantity}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-black align-middle whitespace-nowrap">
                          {formatRupiah(item.price)}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-black align-middle whitespace-nowrap">
                          {formatRupiah(item.subtotal)}
                        </td>
                      </tr>
                    ))}

                    {/* Empty lined ledger rows to match PDF sample */}
                    {Array.from({ length: emptyRowsCount }).map((_, i) => (
                      <tr key={`empty-${i}`} className="border-b-[1.5px] border-slate-700 h-9">
                        <td colSpan={5}></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 4. Sub Total Bar */}
              <div className="flex items-center justify-between my-4 pt-1">
                <div className="text-lg md:text-xl font-extrabold text-slate-800 pl-1">
                  Sub Total
                </div>
                <div className="flex items-center">
                  {/* Qty Box */}
                  <div className="w-16 bg-[#004b93] text-white font-extrabold text-sm py-2 text-center">
                    {totalQuantity}
                  </div>
                  {/* Spacer aligned with HARGA column */}
                  <div className="w-32"></div>
                  {/* Total Box */}
                  <div className="w-36 bg-[#004b93] text-white font-extrabold text-sm py-2 text-center whitespace-nowrap">
                    {formatRupiah(transaction.total)}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Payment Footer */}
            <div className="mt-8 pt-2 text-sm text-black">
              <div className="font-bold">Pembayaran:</div>
              <div className="font-bold">{bankInfo}</div>
              <div className="font-bold">{accountHolder}</div>
            </div>

          </div>
        </div>

        {/* Bottom Actions Footer (Screen only) */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Desain siap cetak rasio A4 • Warna biru terkunci otomatis pada cetak PDF</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="py-2 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              className="py-2 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-900/30"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
