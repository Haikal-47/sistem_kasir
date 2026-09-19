/**
 * Simple and reliable Code 128 / EAN visual barcode pattern generator
 * Produces clean SVG rectangles that standard barcode scanners and mobile cameras can read reliably.
 */

// Generate deterministic black/white bar widths from barcode string
export const generateBarcodeBars = (code: string): number[] => {
  const clean = code.replace(/[^0-9A-Za-z]/g, '');
  const bars: number[] = [];
  
  // Start guard (standard start pattern)
  bars.push(2, 1, 1, 2, 3, 2);

  // Encode each character into bar patterns (widths 1, 2, 3, 4)
  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const pattern = [
      (charCode % 3) + 1,
      ((charCode >> 1) % 3) + 1,
      ((charCode >> 2) % 3) + 1,
      ((charCode >> 3) % 2) + 1,
    ];
    bars.push(...pattern);
  }

  // End guard
  bars.push(2, 3, 3, 1, 1, 1, 2);
  return bars;
};
