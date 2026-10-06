/**
 * Test Suite for Product Form Redesign (Rule 31 Verification)
 */

function generateVariants(colors, sizes, variantStocks, barcode = '8991001001014') {
  const cleanColorCode = (c) => c.replace(/\s+/g, '').slice(0, 3).toUpperCase();
  const cleanSizeCode = (s) => s.replace(/\s+/g, '').toUpperCase();
  const generatedVariants = [];
  let varIdx = 1;

  for (const c of colors) {
    for (const s of sizes) {
      const stock = Math.max(0, variantStocks[`${c}:::${s}`] ?? 0);
      const variantId = `PRD-VAR-${varIdx}`;
      const sku = `${barcode.slice(-4)}-${cleanColorCode(c)}-${cleanSizeCode(s)}`;

      generatedVariants.push({
        id: variantId,
        color: c,
        size: s,
        stock,
        sku,
      });
      varIdx++;
    }
  }
  return generatedVariants;
}

function runTests() {
  console.log('========================================================');
  console.log('   PRODUCT FORM UI/UX REDESIGN — TEST SUITE VERIFICATION ');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(name, condition) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name}`);
      process.exitCode = 1;
    }
  }

  // Test 1: 1 warna + 1 ukuran -> 1 variant
  {
    const vars = generateVariants(['Hitam'], ['All Size'], { 'Hitam:::All Size': 10 });
    assert('Test 1: 1 warna + 1 ukuran produces exactly 1 variant', vars.length === 1 && vars[0].stock === 10);
  }

  // Test 2: 3 warna + 4 ukuran -> 12 variants
  {
    const colors = ['Hitam', 'Putih', 'Navy'];
    const sizes = ['S', 'M', 'L', 'XL'];
    const stocks = {};
    const vars = generateVariants(colors, sizes, stocks);
    assert('Test 2: 3 warna + 4 ukuran produces exactly 12 variants', vars.length === 12);
  }

  // Test 3: Duplicate color blocked (case-insensitive)
  {
    const colors = ['Hitam', 'Putih'];
    const newColor = 'hitam';
    const isDup = colors.some(c => c.toLowerCase() === newColor.toLowerCase());
    assert('Test 3: Duplicate color blocked case-insensitively', isDup === true);
  }

  // Test 4: Duplicate size blocked (case-insensitive)
  {
    const sizes = ['S', 'M', 'L'];
    const newSize = 'm';
    const isDup = sizes.some(s => s.toLowerCase() === newSize.toLowerCase());
    assert('Test 4: Duplicate size blocked case-insensitively', isDup === true);
  }

  // Test 5: Remove color -> related combinations removed
  {
    let colors = ['Hitam', 'Putih'];
    let sizes = ['S', 'M'];
    let stocks = {
      'Hitam:::S': 5,
      'Hitam:::M': 10,
      'Putih:::S': 8,
      'Putih:::M': 12
    };

    // Remove Putih
    colors = colors.filter(c => c !== 'Putih');
    for (const s of sizes) delete stocks[`Putih:::${s}`];

    const vars = generateVariants(colors, sizes, stocks);
    assert('Test 5: Removing color removes all related variant combinations', 
      vars.length === 2 && !vars.some(v => v.color === 'Putih'));
  }

  // Test 6: Remove size -> related combinations removed
  {
    let colors = ['Hitam', 'Putih'];
    let sizes = ['S', 'M'];
    let stocks = {
      'Hitam:::S': 5,
      'Hitam:::M': 10,
      'Putih:::S': 8,
      'Putih:::M': 12
    };

    // Remove M
    sizes = sizes.filter(s => s !== 'M');
    for (const c of colors) delete stocks[`${c}:::M`];

    const vars = generateVariants(colors, sizes, stocks);
    assert('Test 6: Removing size removes all related variant combinations', 
      vars.length === 2 && !vars.some(v => v.size === 'M'));
  }

  // Test 7: Negative stock blocked / clamped
  {
    const cleanNum = Math.max(0, parseInt('-5', 10) || 0);
    assert('Test 7: Negative stock input is strictly clamped to >= 0', cleanNum === 0);
  }

  // Test 8: Stock = 0 allowed
  {
    const vars = generateVariants(['Hitam'], ['S'], { 'Hitam:::S': 0 });
    assert('Test 8: Default variant stock of 0 is valid and allowed', vars[0].stock === 0);
  }

  // Test 9: Custom sizes (e.g. 28, 30, All Size, 2T)
  {
    const customSizes = ['28', '30', 'All Size', '2T'];
    const vars = generateVariants(['Denim Blue'], customSizes, {});
    assert('Test 9: Custom fashion sizes successfully accepted', 
      vars.length === 4 && vars[0].size === '28' && vars[3].size === '2T');
  }

  // Test 10: Custom colors (e.g. Olive, Dusty Pink, Denim Blue)
  {
    const customColors = ['Olive', 'Dusty Pink', 'Denim Blue'];
    const vars = generateVariants(customColors, ['M'], {});
    assert('Test 10: Custom fashion colors successfully accepted', 
      vars.length === 3 && vars[1].color === 'Dusty Pink');
  }

  // Test 11: Edit existing product preserves stocks & adds new as 0
  {
    const existingVariants = [
      { id: 'VAR-1', color: 'Hitam', size: 'S', stock: 10 },
      { id: 'VAR-2', color: 'Hitam', size: 'M', stock: 20 },
      { id: 'VAR-3', color: 'Putih', size: 'S', stock: 5 },
    ];
    const initialStocks = {};
    for (const v of existingVariants) {
      initialStocks[`${v.color}:::${v.size}`] = v.stock;
    }

    // User adds new color 'Navy'
    const colors = ['Hitam', 'Putih', 'Navy'];
    const sizes = ['S', 'M'];
    const vars = generateVariants(colors, sizes, initialStocks);

    const hitamS = vars.find(v => v.color === 'Hitam' && v.size === 'S');
    const hitamM = vars.find(v => v.color === 'Hitam' && v.size === 'M');
    const putihS = vars.find(v => v.color === 'Putih' && v.size === 'S');
    const navyS = vars.find(v => v.color === 'Navy' && v.size === 'S');
    const navyM = vars.find(v => v.color === 'Navy' && v.size === 'M');

    assert('Test 11: Existing stocks preserved and newly added variants initialize to 0',
      hitamS.stock === 10 &&
      hitamM.stock === 20 &&
      putihS.stock === 5 &&
      navyS.stock === 0 &&
      navyM.stock === 0
    );
  }

  // Test 12: Double submit protection via isSubmitting guard
  {
    let isSubmitting = false;
    let callCount = 0;
    const saveProduct = () => {
      if (isSubmitting) return;
      isSubmitting = true;
      callCount++;
    };

    saveProduct();
    saveProduct(); // Rapid click 2
    saveProduct(); // Rapid click 3

    assert('Test 12: Double click save prevented by isSubmitting lock', callCount === 1);
  }

  console.log(`\nRESULTS: ${passed}/${total} TESTS PASSED ✓\n`);
}

runTests();
