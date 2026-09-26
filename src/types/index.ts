export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  costPrice?: number;
  stock: number;
  barcode: string;
  unit: string;
  colors?: string[];   // e.g. ['Hitam', 'Putih', 'Navy']
  sizes?: string[];    // e.g. ['S', 'M', 'L', 'XL'] or ['All Size']
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
  discountPercent?: number;
  note?: string;
}

// PaymentMethod is now a free string so cashiers can define any method name
export type PaymentMethod = string;

export type TransactionStatus = 'LUNAS' | 'MENUNGGU_KONFIRMASI' | 'BATAL';

// A configured payment method entry managed by the cashier
export interface PaymentMethodConfig {
  id: string;
  name: string;           // e.g. "Tunai", "BCA", "QRIS"
  type: 'TUNAI' | 'TRANSFER'; // TUNAI = confirm directly, TRANSFER = need proof
  icon: string;           // emoji or identifier
  color: string;          // tailwind color accent e.g. "emerald" | "sky" | "violet"
  isActive: boolean;
  isDefault: boolean;     // true for the built-in Tunai — cannot be deleted
  bankName?: string;      // e.g. "Bank Central Asia (BCA)"
  accountNumber?: string; // e.g. "8820 4912 3901"
  accountHolder?: string; // e.g. "ARFA FASHION"
  description?: string;   // e.g. "Verifikasi mutasi m-banking"
}

export interface TransactionItem {
  productId: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  subtotal: number;
  selectedColor?: string;
  selectedSize?: string;
}

export interface Transaction {
  id: string;
  invoiceNumber: string;
  date: string; // ISO string
  cashierName: string;
  items: TransactionItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentMethodType?: 'TUNAI' | 'TRANSFER'; // stored alongside for display logic
  status: TransactionStatus;
  // Tunai details
  cashGiven?: number;
  changeAmount?: number;
  // Transfer details
  transferBank?: string;
  transferProofUrl?: string;
  transferProofVerified?: boolean;
  transferConfirmedAt?: string;
  transferConfirmedBy?: string;
  customerNote?: string;
}

export type UserRole = 'super_admin' | 'kasir';

export interface CashierProfile {
  id: string;
  name: string;
  role: UserRole;
  shift: string;
  outletName: string;
  outletAddress: string;
  outletPhone: string;
}

export interface CashierAuth {
  isLoggedIn: boolean;
  pin: string; // stored as simple base64, not for production security
}

export type ActiveTab = 'transaksi' | 'dashboard' | 'produk' | 'riwayat' | 'metode';

