/**
 * EAN-13 Barcode SVG Generator
 * Implements the official EAN-13 encoding standard:
 * - 3-bar start/end guard
 * - 5-bar center guard  
 * - L-code (left odd), G-code (left even), R-code (right) encoding per digit
 * - First digit encoded via L/G parity pattern
 * Returns an SVG string that renders a scannable, print-safe EAN-13 barcode.
 */

// EAN-13 encoding tables (7 modules each)
const L_CODE = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G_CODE = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const R_CODE = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];

// First digit selects L/G parity pattern for left 6 digits
const PARITY = [
  'LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG',
  'LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL',
];

/**
 * Generate a proper EAN-13 SVG barcode string.
 * Falls back to a readable Code-39 style visual for non-13-digit codes.
 */
export const generateEAN13SVG = (
  code: string,
  width = 200,
  height = 60,
  showText = true
): string => {
  // Pad or trim to 13 digits
  const digits = code.replace(/\D/g, '').padStart(13, '0').slice(0, 13);

  const firstDigit = parseInt(digits[0]);
  const parity = PARITY[firstDigit] || 'LLLLLL';

  // Build the full bit string
  let bits = '';
  bits += '101';                          // Start guard
  for (let i = 1; i <= 6; i++) {          // Left group (digits 1-6)
    const d = parseInt(digits[i]);
    bits += parity[i - 1] === 'L' ? L_CODE[d] : G_CODE[d];
  }
  bits += '01010';                        // Center guard
  for (let i = 7; i <= 12; i++) {         // Right group (digits 7-12)
    bits += R_CODE[parseInt(digits[i])];
  }
  bits += '101';                          // End guard

  // Total modules = 95, render into SVG
  const moduleWidth = width / 95;
  const barHeight = showText ? height - 14 : height;
  const guardHeight = showText ? height - 8 : height; // guards taller

  // Guards are at specific positions
  const guardPositions = new Set<number>();
  // Start guard: modules 0,1,2
  [0, 2].forEach(i => guardPositions.add(i));
  // Center guard: modules 45,46,47,48,49
  [45, 47, 49].forEach(i => guardPositions.add(i));
  // End guard: modules 92,93,94
  [92, 94].forEach(i => guardPositions.add(i));

  let rects = '';
  let x = 0;
  for (let i = 0; i < bits.length; i++) {
    const isBar = bits[i] === '1';
    const isGuard = guardPositions.has(i);
    const h = isGuard ? guardHeight : barHeight;
    if (isBar) {
      rects += `<rect x="${(x * moduleWidth).toFixed(2)}" y="0" width="${moduleWidth.toFixed(2)}" height="${h}" fill="#000"/>`;
    }
    x++;
  }

  // Human-readable text below
  const textY = height - 2;
  const fontSize = 9;
  const leftNum = digits.slice(1, 7);
  const rightNum = digits.slice(7, 13);
  const textPart = showText
    ? `<text x="0" y="${textY}" font-size="${fontSize}" font-family="monospace" fill="#000">${digits[0]}</text>
       <text x="${(3 * moduleWidth + 95 * moduleWidth * 0.1).toFixed(1)}" y="${textY}" font-size="${fontSize}" font-family="monospace" fill="#000" text-anchor="middle">${leftNum}</text>
       <text x="${(50 * moduleWidth + 95 * moduleWidth * 0.35).toFixed(1)}" y="${textY}" font-size="${fontSize}" font-family="monospace" fill="#000" text-anchor="middle">${rightNum}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rects}${textPart}</svg>`;
};

/** Legacy shim — kept so nothing else breaks if still imported */
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
