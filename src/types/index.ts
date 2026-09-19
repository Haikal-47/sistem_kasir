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

export type PaymentMethod = 'TUNAI' | 'TRANSFER';

export type TransactionStatus = 'LUNAS' | 'MENUNGGU_KONFIRMASI' | 'BATAL';

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
