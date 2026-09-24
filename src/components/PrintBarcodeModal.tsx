import React, { useState } from 'react';
import { Product } from '../types';
import { formatRupiah } from '../utils/formatters';
import { generateEAN13SVG } from '../utils/barcodeGenerator';
import { Printer, X, Tag, Sliders, CheckSquare, Square } from 'lucide-react';

interface PrintBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  selectedProduct?: Product | null;
}

export const PrintBarcodeModal: React.FC<PrintBarcodeModalProps> = ({
  isOpen,
  onClose,
  products,
  selectedProduct,
}) => {
  const [copies, setCopies] = useState<number>(3);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() => {
    if (selectedProduct) return [selectedProduct.id];
    return products.slice(0, 6).map(p => p.id);
  });
  const [labelFormat, setLabelFormat] = useState<'SHEET' | 'THERMAL'>('SHEET');

  if (!isOpen) return null;

  const targetProducts = selectedProduct 
    ? [selectedProduct] 
    : products.filter(p => selectedProductIds.includes(p.id));

  const handleToggleProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedProductIds.length === products.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map(p => p.id));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Render individual retail barcode label
  const renderBarcodeLabel = (product: Product, index: number) => {
    // Generate proper EAN-13 SVG barcode (print-safe, SVG fill always prints)
    const barcodeSvg = generateEAN13SVG(product.barcode, 176, 56, false);

    return (
      <div
        key={`${product.id}-${index}`}
        className="barcode-label-card bg-white border border-slate-300 rounded-lg p-2.5 flex flex-col justify-between items-center text-center shadow-2xs select-none box-border print:border-black print:rounded-none print:shadow-none"
        style={{ width: '220px', minHeight: '160px' }}
      >
        {/* Store & Category */}
        <div className="w-full flex items-center justify-between border-b border-dashed border-slate-300 pb-1 text-[9px] font-bold text-slate-500 uppercase">
          <span>KASIR PRO</span>
          <span className="truncate max-w-[100px] text-right">{product.category}</span>
        </div>

        {/* Product Name — allow 2 lines so it doesn't truncate */}
        <div className="my-1.5 w-full px-1">
          <h4 className="font-bold text-[11px] text-slate-900 leading-snug line-clamp-2 text-center">
            {product.name}
          </h4>
          <span className="text-[9px] text-slate-500 font-medium">
            {product.brand} • {product.unit}
          </span>
        </div>

        {/* EAN-13 SVG Barcode — SVG fill prints correctly without "print backgrounds" */}
        <div
          className="w-full flex justify-center my-1"
          dangerouslySetInnerHTML={{ __html: barcodeSvg }}
        />

        {/* Barcode digits */}
        <span className="text-[9px] font-mono font-bold tracking-widest text-slate-900 -mt-1">
          {product.barcode}
        </span>

        {/* Price Tag */}
        <div className="w-full pt-1.5 mt-1 border-t border-dashed border-slate-300 flex items-baseline justify-between text-slate-900">
          <span className="text-[9px] uppercase font-bold text-slate-500">Harga:</span>
          <span className="font-extrabold text-[13px] font-mono tracking-tight text-slate-950">
            {formatRupiah(product.price)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        
        {/* Header (Hidden in Print) */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600/20 text-brand-400 flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Cetak Label Barcode Produk</h3>
              <p className="text-xs text-slate-400">
                {selectedProduct ? `Mencetak stiker barcode: ${selectedProduct.name}` : 'Pilih produk untuk mencetak stiker harga & barcode'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Controls Bar (Hidden in Print) */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          {/* Copies selector */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Jumlah Salinan:</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 5, 10].map((num) => (
                <button
                  key={num}
                  onClick={() => setCopies(num)}
                  className={`py-1 px-2.5 rounded-lg font-bold border transition-colors ${
                    copies === num
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {num}x
                </button>
              ))}
            </div>
          </div>

          {/* Format selector */}
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-700">Format Kertas:</span>
            <select
              value={labelFormat}
              onChange={(e) => setLabelFormat(e.target.value as any)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 outline-hidden"
            >
              <option value="SHEET">Lembar Stiker / A4 Grid</option>
              <option value="THERMAL">Printer Label Thermal (50x30mm)</option>
            </select>
          </div>

          {/* Multi product toggle if not single */}
          {!selectedProduct && (
            <button
              onClick={handleSelectAll}
              className="text-brand-700 font-bold hover:underline flex items-center gap-1"
            >
              {selectedProductIds.length === products.length ? (
                <>
                  <CheckSquare className="w-4 h-4 text-brand-600" />
                  <span>Batal Pilih Semua</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-slate-400" />
                  <span>Pilih Semua ({products.length})</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Product selector pills (if multi print and not single, hidden in print) */}
        {!selectedProduct && (
          <div className="px-5 py-3 bg-white border-b border-slate-100 flex items-center gap-2 overflow-x-auto print:hidden">
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">Pilih Barang:</span>
            {products.map(p => {
              const isSelected = selectedProductIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => handleToggleProduct(p.id)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border whitespace-nowrap font-medium transition-colors ${
                    isSelected
                      ? 'bg-brand-50 border-brand-500 text-brand-800 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Printable Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 print:bg-white print:p-0">
          <div
            id="printable-barcode-sheet"
            className="flex flex-wrap gap-4 justify-center print:gap-3 print:justify-start"
          >
            {targetProducts.flatMap(product =>
              Array.from({ length: copies }, (_, i) => renderBarcodeLabel(product, i))
            )}

            {targetProducts.length === 0 && (
              <div className="p-12 text-center text-slate-400 text-xs">
                Pilih minimal 1 produk untuk mencetak stiker barcode.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions (Hidden in Print) */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between print:hidden">
          <span className="text-xs text-slate-500">
            Total stiker yang akan dicetak: <strong className="text-slate-900">{targetProducts.length * copies} label</strong>
          </span>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handlePrint}
              disabled={targetProducts.length === 0}
              className="py-2.5 px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang (Print)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
