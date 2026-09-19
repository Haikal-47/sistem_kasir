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
}

export interface CartItem {
  product: Product;
  quantity: number;
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
}

export interface TransactionItem {
  productId: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  subtotal: number;
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

export interface CashierProfile {
  id: string;
  name: string;
  shift: string;
  outletName: string;
  outletAddress: string;
  outletPhone: string;
}

export interface CashierAuth {
  isLoggedIn: boolean;
  pin: string; // stored as simple base64, not for production security
}
