import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { isValidEAN13 } from '../utils/barcodeGenerator';

interface BarcodeRendererProps {
  value: string;
  width?: number; // width of a single bar module (1.2 to 2.0)
  height?: number; // bar height in pixels (35 to 60)
  displayValue?: boolean;
  fontSize?: number;
  className?: string;
}

export const BarcodeRenderer: React.FC<BarcodeRendererProps> = ({
  value,
  width = 1.45,
  height = 46,
  displayValue = false,
  fontSize = 10,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const clean = (value || '').trim();
    if (!clean) return;

    // Use EAN-13 only if exactly 13 digits with valid checksum
    // Otherwise use CODE-128 (supports 12-digit barcodes like 202606161725, dates, alphanumeric)
    const isEan = /^\d{13}$/.test(clean) && isValidEAN13(clean);
    const format = isEan ? 'EAN13' : 'CODE128';

    try {
      JsBarcode(svgRef.current, clean, {
        format,
        width,
        height,
        displayValue,
        fontSize,
        font: 'monospace',
        textMargin: 2,
        margin: 6, // Quiet Zone
        lineColor: '#000000',
      });
    } catch (err) {
      console.warn(`JsBarcode (${format}) render error, falling back to CODE128:`, err);
      try {
        if (svgRef.current) {
          JsBarcode(svgRef.current, clean, {
            format: 'CODE128',
            width,
            height,
            displayValue,
            fontSize,
            margin: 6,
            lineColor: '#000000',
          });
        }
      } catch (err2) {
        console.error('Failed to render barcode SVG:', err2);
      }
    }
  }, [value, width, height, displayValue, fontSize]);

  return <svg ref={svgRef} className={`max-w-full ${className}`} />;
};
