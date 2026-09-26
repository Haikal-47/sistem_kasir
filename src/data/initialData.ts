import { Product, Transaction, CashierProfile, PaymentMethodConfig, UserRole, StoreSettings } from '../types';

export const SUPER_ADMIN_PROFILE: CashierProfile = {
  id: 'ADM-001',
  name: 'Super Admin',
  role: 'super_admin',
  shift: 'Semua Shift (Full Akses)',
  outletName: 'ARFA FASHION',
  outletAddress: 'Jl. Merdeka Raya No. 45, Jakarta Pusat',
  outletPhone: '021-5550192',
};

export const INITIAL_CASHIER: CashierProfile = {
  id: 'CSH-001',
  name: 'Gusti',
  role: 'kasir',
  shift: 'Shift 1 (07:00 - 15:00)',
  outletName: 'ARFA FASHION',
  outletAddress: 'Jl. Merdeka Raya No. 45, Jakarta Pusat',
  outletPhone: '021-5550192',
};

export const INITIAL_SETTINGS: StoreSettings = {
  id: 'SET-001',
  storeName: 'ARFA FASHION',
  storeAddress: 'Jl. Merdeka Raya No. 45, Jakarta Pusat',
  storePhone: '021-5550192',
  minStockAlert: 5,
  receiptFooter: 'Terima kasih telah berbelanja di ARFA FASHION!'
};

export const AVAILABLE_ROLES: {
  role: UserRole;
  name: string;
  badge: string;
  tagline: string;
  description: string;
}[] = [
  {
    role: 'super_admin',
    name: 'Super Admin',
    badge: '👑 Super Admin',
    tagline: 'Full Access (Kelola Toko & Kasir)',
    description: 'Bisa mengelola produk, stok, laporan, pengguna, metode pembayaran, dan pengaturan.',
  },
  {
    role: 'kasir',
    name: 'Kasir',
    badge: '👤 Kasir',
    tagline: 'Operasional Kasir',
    description: 'Bisa melayani transaksi kasir, memindai barcode, dan melihat riwayat penjualan.',
  },
];

const makeVariants = (id: string, colors: string[], sizes: string[], totalStock: number) => {
  const combos: { color: string; size: string }[] = [];
  for (const c of colors) {
    for (const s of sizes) {
      combos.push({ color: c, size: s });
    }
  }
  if (combos.length === 0) return [];
  const perVar = Math.max(1, Math.floor(totalStock / combos.length));
  let allocated = 0;
  return combos.map((cb, idx) => {
    const isLast = idx === combos.length - 1;
    const stock = isLast ? Math.max(0, totalStock - allocated) : perVar;
    allocated += stock;
    const cleanColor = cb.color.replace(/\s+/g, '').slice(0, 3).toUpperCase();
    const cleanSize = cb.size.replace(/\s+/g, '').toUpperCase();
    return {
      id: `${id}-VAR-${idx + 1}`,
      color: cb.color,
      size: cb.size,
      stock,
      sku: `${id.replace('PRD-', 'ARF-')}-${cleanColor}-${cleanSize}`
    };
  });
};

const RAW_PRODUCTS: Omit<Product, 'variants'>[] = [
  {
    id: 'PRD-001',
    name: 'Atasan Stripe Polo Kerah Jeans',
    brand: 'BY.ELFARA',
    category: 'Atasan & Kemeja',
    price: 145000,
    costPrice: 110000,
    stock: 25,
    barcode: '8991001001014',
    unit: 'Pcs',
    colors: ['Hitam', 'Putih', 'Navy', 'Abu-abu'],
    sizes: ['S', 'M', 'L', 'XL'],
  },
  {
    id: 'PRD-002',
    name: 'Atasan Stripe Polo Kerah Jeans Polos',
    brand: 'BY.ELFARA',
    category: 'Atasan & Kemeja',
    price: 139000,
    costPrice: 105000,
    stock: 30,
    barcode: '8991001001021',
    unit: 'Pcs',
    colors: ['Hitam', 'Putih', 'Cream', 'Dusty Pink'],
    sizes: ['S', 'M', 'L', 'XL'],
  },
  {
    id: 'PRD-003',
    name: 'Cardigan Stripe Kerah Jeans',
    brand: 'BY.ELFARA',
    category: 'Cardigan & Outer',
    price: 146000,
    costPrice: 112000,
    stock: 20,
    barcode: '8991001001038',
    unit: 'Pcs',
    colors: ['Hitam', 'Coklat', 'Navy'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  },
  {
    id: 'PRD-004',
    name: 'Cardigan Polo Stripe',
    brand: 'BY.ELFARA',
    category: 'Cardigan & Outer',
    price: 155000,
    costPrice: 120000,
    stock: 18,
    barcode: '8991001001045',
    unit: 'Pcs',
    colors: ['Hitam', 'Putih', 'Maroon', 'Olive'],
    sizes: ['S', 'M', 'L', 'XL'],
  },
  {
    id: 'PRD-005',
    name: 'Kemeja Linen Oversized Casual',
    brand: 'ARFA FASHION',
    category: 'Atasan & Kemeja',
    price: 125000,
    costPrice: 95000,
    stock: 22,
    barcode: '8991001001052',
    unit: 'Pcs',
    colors: ['Putih', 'Cream', 'Sage Green', 'Dusty Blue'],
    sizes: ['M', 'L', 'XL', 'XXL'],
  },
  {
    id: 'PRD-006',
    name: 'Blouse Tunik Rayon Premium',
    brand: 'ARFA FASHION',
    category: 'Atasan & Kemeja',
    price: 115000,
    costPrice: 85000,
    stock: 24,
    barcode: '8991001001069',
    unit: 'Pcs',
    colors: ['Hitam', 'Putih', 'Dusty Pink', 'Lavender'],
    sizes: ['All Size'],
  },
  {
    id: 'PRD-007',
    name: 'Gamis Crinkle Airflow Premium',
    brand: 'ARFA FASHION',
    category: 'Gamis & Dress',
    price: 175000,
    costPrice: 130000,
    stock: 16,
    barcode: '8991001001076',
    unit: 'Pcs',
    colors: ['Hitam', 'Navy', 'Maroon', 'Olive', 'Grey'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  },
  {
    id: 'PRD-008',
    name: 'Midi Dress Floral Rayon Viscose',
    brand: 'ARFA FASHION',
    category: 'Gamis & Dress',
    price: 135000,
    costPrice: 100000,
    stock: 4, // Stok rendah untuk demo alert
    barcode: '8991001001083',
    unit: 'Pcs',
    colors: ['Biru Bunga', 'Pink Bunga', 'Hijau Bunga'],
    sizes: ['S', 'M', 'L'],
  },
  {
    id: 'PRD-009',
    name: 'Kulot Highwaist Linen Premium',
    brand: 'ARFA FASHION',
    category: 'Celana & Bawahan',
    price: 95000,
    costPrice: 70000,
    stock: 28,
    barcode: '8991001001090',
    unit: 'Pcs',
    colors: ['Hitam', 'Cream', 'Coklat Muda', 'Abu-abu'],
    sizes: ['S', 'M', 'L', 'XL'],
  },
  {
    id: 'PRD-010',
    name: 'Celana Baggy Jeans Boyfriend Denim',
    brand: 'ARFA FASHION',
    category: 'Celana & Bawahan',
    price: 145000,
    costPrice: 110000,
    stock: 15,
    barcode: '8991001001106',
    unit: 'Pcs',
    colors: ['Light Blue', 'Dark Blue', 'Black Denim'],
    sizes: ['27', '28', '29', '30', '31', '32'],
  },
  {
    id: 'PRD-011',
    name: 'Rok Plisket Flare Premium',
    brand: 'ARFA FASHION',
    category: 'Celana & Bawahan',
    price: 75000,
    costPrice: 55000,
    stock: 3, // Stok rendah untuk demo alert
    barcode: '8991001001113',
    unit: 'Pcs',
    colors: ['Hitam', 'Maroon', 'Camel'],
    sizes: ['All Size'],
  },
  {
    id: 'PRD-012',
    name: 'Jaket Denim Vintage Washed',
    brand: 'ARFA FASHION',
    category: 'Cardigan & Outer',
    price: 185000,
    costPrice: 140000,
    stock: 12,
    barcode: '8991001001120',
    unit: 'Pcs',
    colors: ['Light Blue', 'Dark Blue'],
    sizes: ['M', 'L', 'XL', 'XXL'],
  },
  {
    id: 'PRD-013',
    name: 'Pashmina Ceruty Baby Doll 180x75',
    brand: 'ZAHRA HIJAB',
    category: 'Hijab & Kerudung',
    price: 35000,
    costPrice: 24000,
    stock: 50,
    barcode: '8991001001137',
    unit: 'Pcs',
    colors: ['Hitam', 'Putih', 'Cream', 'Dusty Pink', 'Sage', 'Navy', 'Grey', 'Maroon'],
    sizes: ['All Size'],
  },
  {
    id: 'PRD-014',
    name: 'Hijab Segi Empat Voal Miracle Laser Cut',
    brand: 'ZAHRA HIJAB',
    category: 'Hijab & Kerudung',
    price: 38000,
    costPrice: 26000,
    stock: 45,
    barcode: '8991001001144',
    unit: 'Pcs',
    colors: ['Hitam', 'Putih', 'Cream', 'Dusty Lilac', 'Sage Green', 'Nude'],
    sizes: ['All Size'],
  },
  {
    id: 'PRD-015',
    name: 'Kaos Basic Cotton Combed 24s',
    brand: 'ARFA FASHION',
    category: 'Atasan & Kemeja',
    price: 65000,
    costPrice: 45000,
    stock: 35,
    barcode: '8991001001151',
    unit: 'Pcs',
    colors: ['Hitam', 'Putih', 'Navy', 'Abu-abu', 'Maroon', 'Olive'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  }
];

export const INITIAL_PRODUCTS: Product[] = RAW_PRODUCTS.map(p => ({
  ...p,
  variants: makeVariants(p.id, p.colors || [], p.sizes || [], p.stock)
}));

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'TRX-101',
    invoiceNumber: 'INV/20260919/0001',
    date: '2026-09-19T08:32:15',
    cashierName: 'Gusti',
    items: [
      {
        productId: 'PRD-001',
        name: 'Atasan Stripe Polo Kerah Jeans',
        brand: 'BY.ELFARA',
        price: 145000,
        quantity: 2,
        subtotal: 290000,
      },
      {
        productId: 'PRD-013',
        name: 'Pashmina Ceruty Baby Doll 180x75',
        brand: 'ZAHRA HIJAB',
        price: 35000,
        quantity: 2,
        subtotal: 70000,
      }
    ],
    subtotal: 360000,
    tax: 0,
    discount: 0,
    total: 360000,
    paymentMethod: 'TUNAI',
    status: 'LUNAS',
    cashGiven: 400000,
    changeAmount: 40000,
  },
  {
    id: 'TRX-102',
    invoiceNumber: 'INV/20260919/0002',
    date: '2026-09-19T09:14:40',
    cashierName: 'Gusti',
    items: [
      {
        productId: 'PRD-003',
        name: 'Cardigan Stripe Kerah Jeans',
        brand: 'BY.ELFARA',
        price: 146000,
        quantity: 2,
        subtotal: 292000,
      },
      {
        productId: 'PRD-009',
        name: 'Kulot Highwaist Linen Premium',
        brand: 'ARFA FASHION',
        price: 95000,
        quantity: 1,
        subtotal: 95000,
      }
    ],
    subtotal: 387000,
    tax: 0,
    discount: 0,
    total: 387000,
    paymentMethod: 'TRANSFER',
    status: 'LUNAS',
    transferBank: 'BCA (Virtual Account)',
    transferProofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80',
    transferProofVerified: true,
    transferConfirmedAt: '2026-09-19T09:16:00',
    transferConfirmedBy: 'Gusti',
  },
  {
    id: 'TRX-103',
    invoiceNumber: 'INV/20260919/0003',
    date: '2026-09-19T10:05:22',
    cashierName: 'Gusti',
    items: [
      {
        productId: 'PRD-007',
        name: 'Gamis Crinkle Airflow Premium',
        brand: 'ARFA FASHION',
        price: 175000,
        quantity: 1,
        subtotal: 175000,
      },
      {
        productId: 'PRD-014',
        name: 'Hijab Segi Empat Voal Miracle Laser Cut',
        brand: 'ZAHRA HIJAB',
        price: 38000,
        quantity: 2,
        subtotal: 76000,
      }
    ],
    subtotal: 251000,
    tax: 0,
    discount: 0,
    total: 251000,
    paymentMethod: 'TRANSFER',
    status: 'MENUNGGU_KONFIRMASI',
    transferBank: 'Mandiri Livin',
    transferProofUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400&q=80',
    transferProofVerified: false,
    customerNote: 'Pesanan Online / Reguler',
  }
];

export const INITIAL_PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    id: 'PM-TUNAI',
    name: 'Tunai',
    type: 'TUNAI',
    icon: '💵',
    color: 'emerald',
    isActive: true,
    isDefault: true,
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    description: 'Pembayaran tunai langsung di meja kasir',
  },
  {
    id: 'PM-BCA',
    name: 'BCA Transfer',
    type: 'TRANSFER',
    icon: '🏦',
    color: 'sky',
    isActive: true,
    isDefault: false,
    bankName: 'Bank Central Asia (BCA)',
    accountNumber: '8820 4912 3901',
    accountHolder: 'ARFA FASHION',
    description: 'Verifikasi mutasi m-banking BCA otomatis / manual',
  },
  {
    id: 'PM-BNI',
    name: 'BNI Transfer',
    type: 'TRANSFER',
    icon: '🏦',
    color: 'orange',
    isActive: true,
    isDefault: false,
    bankName: 'Bank Negara Indonesia (BNI)',
    accountNumber: '0391 2847 10',
    accountHolder: 'ARFA FASHION',
    description: 'Transfer via BNI Mobile Banking / ATM',
  },
  {
    id: 'PM-BRI',
    name: 'BRI Transfer',
    type: 'TRANSFER',
    icon: '🏦',
    color: 'blue',
    isActive: true,
    isDefault: false,
    bankName: 'Bank Rakyat Indonesia (BRI)',
    accountNumber: '1029 0100 4819 501',
    accountHolder: 'ARFA FASHION',
    description: 'Transfer via aplikasi BRImo',
  },
  {
    id: 'PM-MANDIRI',
    name: 'Mandiri Transfer',
    type: 'TRANSFER',
    icon: '🏦',
    color: 'yellow',
    isActive: true,
    isDefault: false,
    bankName: 'Bank Mandiri',
    accountNumber: '1370 0192 4819 2',
    accountHolder: 'ARFA FASHION',
    description: 'Transfer via Livin by Mandiri',
  },
  {
    id: 'PM-QRIS',
    name: 'QRIS Kasir',
    type: 'TRANSFER',
    icon: '📱',
    color: 'violet',
    isActive: true,
    isDefault: false,
    bankName: 'QRIS Multi-Payment',
    accountNumber: 'NMD-881920194',
    accountHolder: 'ARFA FASHION',
    description: 'Scan QRIS dari GoPay, OVO, ShopeePay, DANA & m-banking',
  },
];
