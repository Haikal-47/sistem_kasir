import JsBarcode from 'jsbarcode';

/**
 * Validates if a 13-digit code has a valid EAN-13 checksum.
 */
export const isValidEAN13 = (code: string): boolean => {
  if (!/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i], 10);
    sum += i % 2 === 0 ? digit * 1 : digit * 3;
  }
  const checksum = (10 - (sum % 10)) % 10;
  return checksum === parseInt(code[12], 10);
};

/**
 * Calculates the 13th checksum digit for a 12-digit string and returns full 13-digit EAN-13.
 */
export const calculateEAN13Checksum = (first12: string): string => {
  const clean = first12.replace(/\D/g, '').slice(0, 12).padStart(12, '0');
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(clean[i], 10);
    sum += i % 2 === 0 ? digit * 1 : digit * 3;
  }
  const checksum = (10 - (sum % 10)) % 10;
  return `${clean}${checksum}`;
};

/**
 * Generates a valid 13-digit EAN-13 barcode with mathematically valid checksum (prefix default 899 for Indonesia).
 */
export const generateRandomEAN13 = (prefix = '899'): string => {
  let random9 = '';
  for (let i = 0; i < 9; i++) {
    random9 += Math.floor(Math.random() * 10).toString();
  }
  return calculateEAN13Checksum(`${prefix}${random9}`);
};

export interface BarcodeSVGOptions {
  width?: number; // bar module width (e.g. 1.3 - 2.0)
  height?: number; // bar height in px
  displayValue?: boolean;
  fontSize?: number;
  margin?: number;
}

/**
 * Generates an SVG string representation of a scannable barcode.
 * Uses EAN-13 if exactly 13 digits with valid checksum.
 * Uses CODE-128 for anything else (e.g. 12 digits like 202606161725, dates, alphanumeric),
 * which is 100% scannable by all standard 1D/2D optical and camera barcode scanners.
 */
export const generateBarcodeSVG = (
  code: string,
  options?: BarcodeSVGOptions
): string => {
  if (typeof document === 'undefined') return '';
  const clean = (code || '').trim();
  if (!clean) return '';

  const isEan = /^\d{13}$/.test(clean) && isValidEAN13(clean);
  const format = isEan ? 'EAN13' : 'CODE128';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  const width = options?.width || 1.45;
  const height = options?.height || 48;
  const displayValue = options?.displayValue ?? false;
  const margin = options?.margin ?? 8; // Mandatory Quiet Zone margin!

  try {
    JsBarcode(svg, clean, {
      format,
      width,
      height,
      displayValue,
      fontSize: options?.fontSize || 10,
      font: 'monospace',
      textMargin: 2,
      margin,
      lineColor: '#000000',
    });
    return new XMLSerializer().serializeToString(svg);
  } catch (err) {
    console.warn(`JsBarcode (${format}) generation failed, falling back to CODE128:`, err);
    try {
      JsBarcode(svg, clean, {
        format: 'CODE128',
        width,
        height,
        displayValue,
        fontSize: options?.fontSize || 10,
        margin,
        lineColor: '#000000',
      });
      return new XMLSerializer().serializeToString(svg);
    } catch (err2) {
      console.error('Failed to generate barcode SVG:', err2);
      return '';
    }
  }
};

/**
 * Backward-compatible wrapper for existing calls.
 */
export const generateEAN13SVG = (
  code: string,
  width = 168,
  height = 50,
  showText = false
): string => {
  // Convert legacy pixel width (e.g. 150-200) to module width (approx 1.3 - 1.5)
  const modWidth = width > 20 ? Math.max(1.2, Math.min(2.0, width / 110)) : width;
  return generateBarcodeSVG(code, {
    width: modWidth,
    height,
    displayValue: showText,
    margin: 8,
  });
};

/** Legacy shim */
export const generateBarcodeBars = (code: string): number[] => {
  const clean = code.replace(/[^0-9A-Za-z]/g, '');
  const bars: number[] = [];
  bars.push(2, 1, 1, 2, 3, 2);
  for (let i = 0; i < clean.length; i++) {
    const c = clean.charCodeAt(i);
    bars.push((c % 3) + 1, ((c >> 1) % 3) + 1, ((c >> 2) % 3) + 1, ((c >> 3) % 2) + 1);
  }
  bars.push(2, 3, 3, 1, 1, 1, 2);
  return bars;
};
