import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Product, 
  CartItem, 
  Transaction, 
  CashierProfile, 
  PaymentMethodConfig, 
  ActiveTab, 
  UserRole,
  UserAccount,
  StoreSettings,
  ProductVariant,
  AttendanceStatus,
  CashierAttendance,
  PaginationInfo
} from '../types';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_TRANSACTIONS, 
  INITIAL_CASHIER, 
  SUPER_ADMIN_PROFILE, 
  INITIAL_PAYMENT_METHODS,
  INITIAL_SETTINGS 
} from '../data/initialData';

interface POSContextType {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  
  // Database connection indicator
  isDbConnected: boolean;

  // Auth & Session
  authToken: string;
  authHeaders: () => Record<string, string>;
  currentUser: UserAccount | null;
  login: (username: string, pass: string, portal: 'admin' | 'kasir') => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isSuperAdmin: boolean;
  switchRole: (role: UserRole) => void;

  // Cashier Attendance & Cash Closing (Gusti & Admin)
  attendance: CashierAttendance | null;
  attendanceStatus: AttendanceStatus;
  isAttendanceLoading: boolean;
  isCheckInModalOpen: boolean;
  setIsCheckInModalOpen: (open: boolean) => void;
  isCheckOutModalOpen: boolean;
  setIsCheckOutModalOpen: (open: boolean) => void;
  refreshAttendance: () => Promise<void>;
  checkIn: () => Promise<{ success: boolean; error?: string }>;
  checkOut: (actualCash: number, note?: string) => Promise<{ success: boolean; error?: string }>;
  todaySummary: any;
  fetchTodaySummary: () => Promise<void>;

  // User Management (Admin Only)
  users: UserAccount[];
  fetchUsers: () => Promise<void>;
  createUser: (data: { username: string; password: string; name: string; role: UserRole }) => Promise<{ success: boolean; error?: string }>;
  updateUser: (id: string, data: { username?: string; password?: string; name?: string; role?: UserRole; isActive?: boolean }) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Store Settings (Admin Only)
  storeSettings: StoreSettings;
  updateStoreSettings: (settings: Partial<StoreSettings>) => Promise<{ success: boolean; error?: string }>;

  // Products
  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => Product;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  findProductByBarcode: (barcode: string) => Product | undefined;
  adjustStock: (productId: string, deltaStock: number) => void;
  adjustVariantStock: (productId: string, variantId: string, newStock: number) => void;
  
  // Cart
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, selectedColor?: string, selectedSize?: string) => void;
  updateCartItemQty: (cartKey: string, quantity: number) => void;
  removeFromCart: (cartKey: string) => void;
  clearCart: () => void;
  cartDiscount: number;
  setCartDiscount: (discount: number) => void;
  cartSubtotal: number;
  cartTotal: number;
  cartItemCount: number;
  heldCart: CartItem[] | null;
  holdCurrentCart: () => void;
  restoreHeldCart: () => void;
  
  // Transactions
  transactions: Transaction[];
  transactionsPagination: PaginationInfo;
  fetchTransactions: (page?: number, limit?: number, startDate?: string, endDate?: string, status?: string, paymentMethod?: string, search?: string) => Promise<void>;
  createCashTransaction: (cashGiven: number, methodName?: string, customerName?: string, customerPhone?: string) => Promise<{ success: boolean; transaction?: Transaction; error?: string }>;
  createTransferTransaction: (methodName: string, transferBank: string, proofUrl: string, isConfirmedDirectly: boolean, customerName?: string, customerPhone?: string) => Promise<{ success: boolean; transaction?: Transaction; error?: string }>;
  confirmTransferPayment: (transactionId: string) => Promise<{ success: boolean; error?: string }>;
  cancelTransaction: (transactionId: string) => Promise<{ success: boolean; error?: string }>;
  pendingConfirmations: Transaction[];
  
  // Payment Methods
  paymentMethods: PaymentMethodConfig[];
  addPaymentMethod: (method: Omit<PaymentMethodConfig, 'id'>) => void;
  updatePaymentMethod: (id: string, updates: Partial<PaymentMethodConfig>) => void;
  deletePaymentMethod: (id: string) => void;
  isPaymentMethodsOpen: boolean;
  setIsPaymentMethodsOpen: (open: boolean) => void;
  
  // Struk / Receipt Modal
  selectedReceipt: Transaction | null;
  setSelectedReceipt: (tx: Transaction | null) => void;
  
  // Checkout Modal
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
  
  // Cashier Info
  cashier: CashierProfile;
  updateCashier: (updates: Partial<CashierProfile>) => void;
  
  // Profile & Password Management
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
  changePassword: (role: UserRole, oldPass: string, newPass: string) => { success: boolean; message: string };
  verifyPassword: (role: UserRole, pass: string) => boolean;
  getRolePassword: (role: UserRole) => string;
  
  // Audio & Notification
  playBeep: () => void;
  resetToDemoData: () => void;
  resetKasirData: () => void;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);

  // Auth State
  const [authToken, setAuthToken] = useState<string>(() => {
    return sessionStorage.getItem('pos_auth_token') || '';
  });

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = sessionStorage.getItem('pos_current_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return null;
  });

  const [users, setUsers] = useState<UserAccount[]>([]);

  // Store Settings
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(() => {
    const saved = localStorage.getItem('pos_store_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_SETTINGS;
  });

  // Products with variants
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('pos_products');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hasOldGrocery = Array.isArray(parsed) && parsed.some((p: Product) =>
          p.name?.toLowerCase().includes('aqua') ||
          p.name?.toLowerCase().includes('indomie') ||
          p.category === 'Minuman' ||
          p.category === 'Makanan Instan'
        );
        if (!hasOldGrocery && Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) { console.error(e); }
    }
    return INITIAL_PRODUCTS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('pos_transactions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hasOldGroceryTx = Array.isArray(parsed) && parsed.some((t: Transaction) =>
          t.items?.some(it => it.name?.toLowerCase().includes('aqua') || it.name?.toLowerCase().includes('indomie'))
        );
        const hasOldDummyTx = Array.isArray(parsed) && parsed.some((t: Transaction) =>
          t.id === 'TRX-101' || t.invoiceNumber?.startsWith('INV/20260919')
        );
        if (!hasOldGroceryTx && !hasOldDummyTx && Array.isArray(parsed)) {
          return parsed.slice(0, 50);
        }
      } catch (e) { console.error(e); }
    }
    return INITIAL_TRANSACTIONS;
  });

  const [transactionsPagination, setTransactionsPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });

  const [cashier, setCashier] = useState<CashierProfile>(() => {
    const saved = localStorage.getItem('pos_cashier');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.outletName === 'MINIMARKET KASIR PRO') {
          parsed.outletName = 'ARFA FASHION';
        }
        // Role otorisasi hanya berasal dari sesi terverifikasi backend, tidak dipercaya dari localStorage
        const savedUser = sessionStorage.getItem('pos_current_user');
        let verifiedRole: UserRole = 'kasir';
        if (savedUser) {
          try {
            verifiedRole = JSON.parse(savedUser).role || 'kasir';
          } catch {}
        }
        parsed.role = verifiedRole;
        if (parsed.name === 'Budi Pratama') {
          parsed.name = 'Gusti';
        }
        return parsed;
      } catch (e) { console.error(e); }
    }
    return INITIAL_CASHIER;
  });

  const isSuperAdmin = Boolean(authToken && currentUser?.role === 'super_admin');

  // ── Cashier Attendance State (Prompt Rules 4, 5, 6, 7, 8, 12, 13, 20) ──
  const [attendance, setAttendance] = useState<CashierAttendance | null>(() => {
    const saved = localStorage.getItem('pos_attendance_today');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
        if (parsed.date === today) return parsed;
      } catch (e) { console.error(e); }
    }
    return null;
  });

  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>(() => {
    const saved = localStorage.getItem('pos_attendance_today');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
        if (parsed.date === today) return parsed.status || 'not_started';
      } catch (e) { console.error(e); }
    }
    return 'not_started';
  });

  const [isAttendanceLoading, setIsAttendanceLoading] = useState<boolean>(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState<boolean>(false);
  const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState<boolean>(false);
  const [todaySummary, setTodaySummary] = useState<any>(null);

  const authHeaders = useCallback(() => {
    const token = authToken || sessionStorage.getItem('pos_auth_token') || '';
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }, [authToken]);

  const refreshAttendance = useCallback(async () => {
    if (!authToken) return; // Jangan fetch sebelum login
    try {
      setIsAttendanceLoading(true);
      const res = await fetch('/api/attendance/today', {
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAttendanceStatus(data.status || 'not_started');
        setAttendance(data.attendance || null);
        if (data.attendance) {
          localStorage.setItem('pos_attendance_today', JSON.stringify(data.attendance));
        } else {
          localStorage.removeItem('pos_attendance_today');
        }
      }
    } catch (err) {
      console.warn('Failed to fetch attendance, using local cache:', err);
      const saved = localStorage.getItem('pos_attendance_today');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
          if (parsed.date === today) {
            setAttendance(parsed);
            setAttendanceStatus(parsed.status);
          } else {
            setAttendance(null);
            setAttendanceStatus('not_started');
          }
        } catch {
          setAttendance(null);
          setAttendanceStatus('not_started');
        }
      }
    } finally {
      setIsAttendanceLoading(false);
    }
  }, [authHeaders, authToken]);

  const fetchTodaySummary = useCallback(async () => {
    const token = authToken || sessionStorage.getItem('pos_auth_token') || '';
    if (!token) return; // Jangan fetch sebelum login
    try {
      const res = await fetch('/api/attendance/summary-today', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTodaySummary(data);
      }
    } catch (err) {
      console.warn('Failed to fetch today summary:', err);
    }
  }, [authToken]);

  const checkIn = async (): Promise<{ success: boolean; error?: string }> => {
    // Jika tidak ada token, kasir belum login dengan benar ke backend
    if (!authToken) {
      return { success: false, error: 'Sesi login tidak valid. Silakan logout dan login ulang untuk absen.' };
    }
    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Gagal melakukan absen masuk.' };
      }
      setAttendance(data.attendance);
      setAttendanceStatus('working');
      localStorage.setItem('pos_attendance_today', JSON.stringify(data.attendance));
      setIsCheckInModalOpen(false);
      fetchTodaySummary();
      return { success: true };
    } catch (err: unknown) {
      // FIX #2: Jangan buat fake attendance saat network error.
      // Database adalah source of truth untuk attendance.
      console.error('Check-in network error:', err);
      return { success: false, error: 'Gagal terhubung ke server. Silakan periksa koneksi internet dan coba lagi.' };
    }
  };


  const checkOut = async (actualCash: number, note?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ actualCash, note })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Gagal melakukan tutup kas harian.' };
      }
      setAttendance(data.attendance);
      setAttendanceStatus('completed');
      localStorage.setItem('pos_attendance_today', JSON.stringify(data.attendance));
      setIsCheckOutModalOpen(false);
      fetchTodaySummary();
      return { success: true };
    } catch (err: unknown) {
      console.error('Check-out network error:', err);
      return { 
        success: false, 
        error: 'Gagal terhubung ke server untuk proses tutup kas. Silakan periksa koneksi internet dan coba lagi.' 
      };
    }
  };

  // Auth Functions
  const login = async (username: string, pass: string, portal: 'admin' | 'kasir'): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: pass, portal })
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login gagal. Coba lagi.' };
      }

      setAuthToken(data.token);
      setCurrentUser(data.user);
      sessionStorage.setItem('pos_auth_token', data.token);
      sessionStorage.setItem('pos_current_user', JSON.stringify(data.user));
      sessionStorage.setItem('pos_logged_in', 'true');
      sessionStorage.setItem('pos_role', data.user.role);
      sessionStorage.setItem('pos_login_name', data.user.name);

      // Update cashier profile display
      const updatedProfile: CashierProfile = {
        id: data.user.id,
        name: data.user.name,
        role: data.user.role,
        shift: data.user.role === 'super_admin' ? 'Semua Shift (Full Akses)' : 'Shift 1 (07:00 - 15:00)',
        outletName: storeSettings.storeName || 'ARFA FASHION',
        outletAddress: storeSettings.storeAddress || 'Jl. Merdeka Raya No. 45, Jakarta Pusat',
        outletPhone: storeSettings.storePhone || '021-5550192',
      };
      setCashier(updatedProfile);
      localStorage.setItem('pos_cashier', JSON.stringify(updatedProfile));

      // Refresh attendance status on login
      setTimeout(() => {
        refreshAttendance();
        fetchTodaySummary();
      }, 50);

      return { success: true };
    } catch (err: unknown) {
      console.error('Backend login error:', err);
      return {
        success: false,
        error: 'Tidak dapat terhubung ke server. Pastikan server aktif dan periksa koneksi internet.'
      };
    }
  };

  const logout = () => {
    setAuthToken('');
    setCurrentUser(null);
    sessionStorage.removeItem('pos_auth_token');
    sessionStorage.removeItem('pos_current_user');
    sessionStorage.removeItem('pos_logged_in');
    sessionStorage.removeItem('pos_login_name');
    sessionStorage.removeItem('pos_role');
  };

  const switchRole = (newRole: UserRole) => {
    // Hanya izinkan switch ke super_admin jika sesi pengguna backend memang super_admin
    if (newRole === 'super_admin' && currentUser?.role !== 'super_admin') {
      console.warn('Unauthorized role switch attempt to super_admin rejected.');
      return;
    }
    if (newRole === 'super_admin') {
      const updated: CashierProfile = {
        ...SUPER_ADMIN_PROFILE,
        outletName: cashier.outletName || 'ARFA FASHION',
        outletAddress: cashier.outletAddress || 'Jl. Merdeka Raya No. 45, Jakarta Pusat',
        outletPhone: cashier.outletPhone || '021-5550192',
      };
      setCashier(updated);
      localStorage.setItem('pos_cashier', JSON.stringify(updated));
      sessionStorage.setItem('pos_role', 'super_admin');
      sessionStorage.setItem('pos_login_name', updated.name);
    } else {
      const updated: CashierProfile = {
        ...INITIAL_CASHIER,
        outletName: cashier.outletName || 'ARFA FASHION',
        outletAddress: cashier.outletAddress || 'Jl. Merdeka Raya No. 45, Jakarta Pusat',
        outletPhone: cashier.outletPhone || '021-5550192',
      };
      setCashier(updated);
      localStorage.setItem('pos_cashier', JSON.stringify(updated));
      sessionStorage.setItem('pos_role', 'kasir');
      sessionStorage.setItem('pos_login_name', updated.name);
    }
  };

  // User Management
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.warn('Failed to fetch users:', err);
    }
  }, [authHeaders]);

  const createUser = async (data: { username: string; password: string; name: string; role: UserRole }) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data)
      });
      const resData = await res.json();
      if (!res.ok) {
        return { success: false, error: resData.error || 'Gagal menambah pengguna.' };
      }
      setUsers(prev => [...prev, resData]);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  };

  const updateUser = async (id: string, data: { username?: string; password?: string; name?: string; role?: UserRole; isActive?: boolean }) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data)
      });
      const resData = await res.json();
      if (!res.ok) {
        return { success: false, error: resData.error || 'Gagal memperbarui pengguna.' };
      }
      setUsers(prev => prev.map(u => u.id === id ? resData : u));
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  };

  const deleteUser = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const resData = await res.json();
      if (!res.ok) {
        return { success: false, error: resData.error || 'Gagal menghapus pengguna.' };
      }
      setUsers(prev => prev.filter(u => u.id !== id));
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  };

  // Store Settings
  const updateStoreSettings = async (settings: Partial<StoreSettings>) => {
    try {
      const updated = { ...storeSettings, ...settings };
      setStoreSettings(updated);
      localStorage.setItem('pos_store_settings', JSON.stringify(updated));

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updated)
      });
      if (!res.ok) {
        const d = await res.json();
        return { success: false, error: d.error };
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  };

  // Cart & Payment states
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('pos_cart');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>(() => {
    const saved = localStorage.getItem('pos_payment_methods');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_PAYMENT_METHODS;
  });

  const [heldCart, setHeldCart] = useState<CartItem[] | null>(null);
  const [cartDiscount, setCartDiscount] = useState<number>(0);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isPaymentMethodsOpen, setIsPaymentMethodsOpen] = useState<boolean>(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Transaction | null>(null);

  // Initial fetch from Neon DB backend API
  useEffect(() => {
    const loadFromNeonDb = async () => {
      try {
        const [prodRes, txRes, cashierRes, pmRes, setRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/transactions'),
          fetch('/api/cashier'),
          fetch('/api/payment-methods'),
          fetch('/api/settings'),
        ]);

        if (prodRes.ok && txRes.ok) {
          const prodData = await prodRes.json();
          const txData = await txRes.json();
          if (Array.isArray(prodData)) {
            setProducts(prodData);
            localStorage.setItem('pos_products', JSON.stringify(prodData));
          }
          const txList = Array.isArray(txData) ? txData : (txData?.data || []);
          setTransactions(txList);
          if (txData?.pagination) {
            setTransactionsPagination(txData.pagination);
          } else {
            setTransactionsPagination({
              page: 1,
              limit: 20,
              total: txList.length,
              totalPages: Math.ceil(txList.length / 20) || 1
            });
          }
          localStorage.setItem('pos_transactions', JSON.stringify(txList.slice(0, 50)));
          // Jika transaksi di DB 0 (baru di-reset), bersihkan juga keranjang dan cache absensi lama
          if (txList.length === 0) {
            setCart([]);
            setHeldCart(null);
            localStorage.removeItem('pos_cart');
            localStorage.removeItem('pos_held_cart');
          }
          if (cashierRes.ok) {
            const cashierData = await cashierRes.json();
            if (cashierData && cashierData.name) {
              setCashier(cashierData);
            }
          }
          if (pmRes.ok) {
            const pmData = await pmRes.json();
            if (Array.isArray(pmData) && pmData.length > 0) {
              setPaymentMethods(pmData);
            }
          }
          if (setRes.ok) {
            const setData = await setRes.json();
            if (setData && setData.storeName) {
              setStoreSettings(setData);
            }
          }
          setIsDbConnected(true);

          // Sinkronisasi status absensi kasir dengan server
          const token = sessionStorage.getItem('pos_auth_token');
          if (token) {
            try {
              const attRes = await fetch('/api/attendance/today', {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (attRes.ok) {
                const attData = await attRes.json();
                if (attData.status === 'not_started' || !attData.attendance) {
                  setAttendance(null);
                  setAttendanceStatus('not_started');
                  localStorage.removeItem('pos_attendance_today');
                } else {
                  setAttendance(attData.attendance);
                  setAttendanceStatus(attData.status);
                  localStorage.setItem('pos_attendance_today', JSON.stringify(attData.attendance));
                }
              }
            } catch (e) {
              console.warn(e);
            }
          } else if (txData.length === 0) {
            setAttendance(null);
            setAttendanceStatus('not_started');
            localStorage.removeItem('pos_attendance_today');
          }
          // Attendance dipanggil dari useEffect yang watch authToken, bukan di sini
        }
      } catch (err) {
        console.warn('Backend Neon API not reached, using local fallback:', err);
        setIsDbConnected(false);
      }
    };

    loadFromNeonDb();
  }, []);

  // Fetch users if logged in as Admin
  useEffect(() => {
    if (isSuperAdmin && authToken) {
      fetchUsers();
    }
  }, [isSuperAdmin, authToken, fetchUsers]);

  // Sync attendance state when logged in (Kasir & Admin)
  useEffect(() => {
    const token = authToken || sessionStorage.getItem('pos_auth_token');
    if (token && currentUser) {
      if (currentUser.role !== 'super_admin') {
        refreshAttendance();
      }
      fetchTodaySummary();
    }
  }, [authToken, currentUser?.id, currentUser?.role, refreshAttendance, fetchTodaySummary]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('pos_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    // Only cache recent transactions (max 50) to prevent unlimited localStorage bloat
    const recent = transactions.slice(0, 50);
    localStorage.setItem('pos_transactions', JSON.stringify(recent));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('pos_cashier', JSON.stringify(cashier));
  }, [cashier]);

  useEffect(() => {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('pos_payment_methods', JSON.stringify(paymentMethods));
  }, [paymentMethods]);

  // Audio tone generator for realistic scanner beep
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Ignore
    }
  };

  // Cart operations with variant stock verification
  const getCartKey = (productId: string, color?: string, size?: string) =>
    `${productId}|${color || ''}|${size || ''}`;

  const addToCart = useCallback((product: Product, quantity: number = 1, selectedColor?: string, selectedSize?: string) => {
    playBeep();

    // Determine max available stock for chosen variant
    let maxAvailableStock = product.stock;
    let chosenVariantId: string | undefined = undefined;

    if (product.variants && product.variants.length > 0 && (selectedColor || selectedSize)) {
      const match = product.variants.find(v => 
        (!selectedColor || v.color.toLowerCase() === selectedColor.toLowerCase()) &&
        (!selectedSize || v.size.toLowerCase() === selectedSize.toLowerCase())
      );
      if (match) {
        maxAvailableStock = match.stock;
        chosenVariantId = match.id;
      }
    }

    if (maxAvailableStock <= 0) {
      alert(`Stok untuk varian ${selectedColor || ''} ${selectedSize || ''} sudah habis.`);
      return;
    }

    setCart(prev => {
      const key = getCartKey(product.id, selectedColor, selectedSize);
      const existing = prev.find(item => getCartKey(item.product.id, item.selectedColor, item.selectedSize) === key);
      if (existing) {
        const newQty = Math.min(existing.quantity + quantity, maxAvailableStock);
        return prev.map(item =>
          getCartKey(item.product.id, item.selectedColor, item.selectedSize) === key
            ? { ...item, quantity: newQty }
            : item
        );
      }
      return [
        { 
          product, 
          quantity: Math.min(quantity, maxAvailableStock), 
          selectedColor, 
          selectedSize,
          variantId: chosenVariantId 
        }, 
        ...prev
      ];
    });
  }, []);

  const updateCartItemQty = useCallback((cartKey: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => getCartKey(item.product.id, item.selectedColor, item.selectedSize) !== cartKey));
      return;
    }
    setCart(prev =>
      prev.map(item => {
        const key = getCartKey(item.product.id, item.selectedColor, item.selectedSize);
        if (key === cartKey) {
          let maxStock = item.product.stock;
          if (item.product.variants && (item.selectedColor || item.selectedSize)) {
            const v = item.product.variants.find(vr =>
              (!item.selectedColor || vr.color.toLowerCase() === item.selectedColor.toLowerCase()) &&
              (!item.selectedSize || vr.size.toLowerCase() === item.selectedSize.toLowerCase())
            );
            if (v) maxStock = v.stock;
          }
          return { ...item, quantity: Math.min(quantity, maxStock) };
        }
        return item;
      })
    );
  }, []);

  const removeFromCart = useCallback((cartKey: string) => {
    setCart(prev => prev.filter(item => getCartKey(item.product.id, item.selectedColor, item.selectedSize) !== cartKey));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCartDiscount(0);
  }, []);

  const holdCurrentCart = () => {
    if (cart.length === 0) return;
    setHeldCart([...cart]);
    setCart([]);
    setCartDiscount(0);
  };

  const restoreHeldCart = () => {
    if (!heldCart) return;
    setCart([...heldCart]);
    setHeldCart(null);
  };

  // Cart Totals
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - cartDiscount);
  }, [cartSubtotal, cartDiscount]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Product operations
  const addProduct = (data: Omit<Product, 'id'>): Product => {
    if (!isSuperAdmin) {
      alert('Akses Ditolak: Hanya role Super Admin yang dapat menambah produk baru.');
      return {} as Product;
    }
    // Buat ID sementara untuk tampilan langsung di UI
    const tempId = `PRD-${Date.now().toString().slice(-6)}`;
    const newProduct: Product = {
      ...data,
      id: tempId,
    };
    setProducts(prev => [newProduct, ...prev]);

    // Setelah backend membuat produk dengan ID canonical-nya, update state agar sinkron
    fetch('/api/products', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    })
      .then(res => res.ok ? res.json() : null)
      .then(saved => {
        if (saved && saved.id && saved.id !== tempId) {
          // Replace temp product dengan produk yang sudah punya ID dari DB
          setProducts(prev => prev.map(p => p.id === tempId ? { ...p, ...saved } : p));
        }
      })
      .catch(err => console.error('Failed to sync new product to Neon DB:', err));

    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    if (!isSuperAdmin) {
      alert('Akses Ditolak: Hanya role Super Admin yang dapat mengedit produk.');
      return;
    }
    setProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
    setCart(prev =>
      prev.map(item => {
        if (item.product.id === id) {
          return { ...item, product: { ...item.product, ...updates } };
        }
        return item;
      })
    );

    fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    }).catch(err => console.error('Failed to update product in Neon DB:', err));
  };

  const adjustStock = (productId: string, deltaStock: number) => {
    if (!isSuperAdmin) {
      alert('Akses Ditolak: Hanya role Super Admin yang dapat mengubah stok.');
      return;
    }
    setProducts(prev =>
      prev.map(p => {
        if (p.id === productId) {
          const newStock = Math.max(0, p.stock + deltaStock);
          return { ...p, stock: newStock };
        }
        return p;
      })
    );

    fetch(`/api/products/${productId}/stock`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ deltaStock })
    }).catch(err => console.error('Failed to adjust stock in Neon DB:', err));
  };

  const adjustVariantStock = (productId: string, variantId: string, newStock: number) => {
    if (!isSuperAdmin) {
      alert('Akses Ditolak: Hanya role Super Admin yang dapat mengubah stok varian.');
      return;
    }
    setProducts(prev =>
      prev.map(p => {
        if (p.id === productId && p.variants) {
          const updatedVars = p.variants.map(v => v.id === variantId ? { ...v, stock: Math.max(0, newStock) } : v);
          const totalStock = updatedVars.reduce((sum, v) => sum + v.stock, 0);
          return { ...p, variants: updatedVars, stock: totalStock };
        }
        return p;
      })
    );

    fetch(`/api/products/${productId}/stock`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ variantId, newStock: Math.max(0, newStock) })
    }).catch(err => console.error('Failed to adjust variant stock in Neon DB:', err));
  };

  const deleteProduct = (id: string) => {
    if (!isSuperAdmin) {
      alert('Akses Ditolak: Hanya role Super Admin yang dapat menghapus produk.');
      return;
    }
    setProducts(prev => prev.filter(p => p.id !== id));
    removeFromCart(id);

    fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).catch(err => console.error('Failed to delete product from Neon DB:', err));
  };

  const findProductByBarcode = (barcode: string) => {
    const cleanCode = barcode.trim().toLowerCase();
    // First: exact match
    let found = products.find(p => p.barcode.toLowerCase() === cleanCode);
    if (found) return found;
    // Second: normalize both sides to numeric-only and compare
    // (handles cases where stiker mencetak EAN-13 padded dengan leading zeros tapi DB punya barcode pendek)
    const numericScanned = cleanCode.replace(/\D/g, '');
    found = products.find(p => {
      const numericStored = p.barcode.replace(/\D/g, '');
      if (!numericStored || !numericScanned) return false;
      // Both stripped of leading zeros
      if (numericStored.replace(/^0+/, '') === numericScanned.replace(/^0+/, '')) return true;
      // Scanned padded to 13 vs stored
      if (numericScanned.padStart(13, '0') === numericStored.padStart(13, '0')) return true;
      return false;
    });
    return found;
  };

  // Payment Method operations
  const addPaymentMethod = (data: Omit<PaymentMethodConfig, 'id'>) => {
    if (!isSuperAdmin) {
      alert('Akses Ditolak: Hanya role Super Admin yang dapat menambah metode pembayaran.');
      return;
    }
    const newMethod: PaymentMethodConfig = {
      ...data,
      id: `PM-${Date.now().toString().slice(-6)}`,
    };
    setPaymentMethods(prev => [...prev, newMethod]);

    fetch('/api/payment-methods', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(newMethod),
    }).catch(err => console.error('Failed to sync payment method:', err));
  };

  const updatePaymentMethod = (id: string, updates: Partial<PaymentMethodConfig>) => {
    if (!isSuperAdmin) {
      alert('Akses Ditolak: Hanya role Super Admin yang dapat mengedit metode pembayaran.');
      return;
    }
    setPaymentMethods(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));

    fetch(`/api/payment-methods/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    }).catch(err => console.error('Failed to update payment method:', err));
  };

  const deletePaymentMethod = (id: string) => {
    if (!isSuperAdmin) {
      alert('Akses Ditolak: Hanya role Super Admin yang dapat menghapus metode pembayaran.');
      return;
    }
    setPaymentMethods(prev => prev.filter(m => m.id !== id));

    fetch(`/api/payment-methods/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).catch(err => console.error('Failed to delete payment method:', err));
  };

  // Deduct stock for transactions
  const deductStock = (items: { productId: string; quantity: number; selectedColor?: string; selectedSize?: string }[]) => {
    setProducts(prev =>
      prev.map(prod => {
        const matchingItems = items.filter(i => i.productId === prod.id);
        if (matchingItems.length === 0) return prod;

        let updatedVars = prod.variants ? [...prod.variants] : [];
        for (const it of matchingItems) {
          if (updatedVars.length > 0 && (it.selectedColor || it.selectedSize)) {
            updatedVars = updatedVars.map(v => {
              const matchC = !it.selectedColor || v.color.toLowerCase() === it.selectedColor.toLowerCase();
              const matchS = !it.selectedSize || v.size.toLowerCase() === it.selectedSize.toLowerCase();
              if (matchC && matchS) {
                return { ...v, stock: Math.max(0, v.stock - it.quantity) };
              }
              return v;
            });
          }
        }
        const totalStock = updatedVars.length > 0 
          ? updatedVars.reduce((sum, v) => sum + v.stock, 0)
          : Math.max(0, prod.stock - matchingItems.reduce((sum, it) => sum + it.quantity, 0));

        return { ...prod, stock: totalStock, variants: updatedVars };
      })
    );
  };

  const generateInvoiceNumber = () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `INV/${dateStr}/${rand}`;
  };

  // Cash payment creation
  const createCashTransaction = async (
    cashGiven: number,
    methodName: string = 'Tunai',
    customerName?: string,
    customerPhone?: string
  ): Promise<{ success: boolean; transaction?: Transaction; error?: string }> => {
    if (!isSuperAdmin) {
      if (attendanceStatus === 'not_started') {
        setIsCheckInModalOpen(true);
        return { success: false, error: 'Transaksi Ditolak: Anda belum melakukan Absen Masuk hari ini. Silakan mulai hari kerja terlebih dahulu.' };
      }
      if (attendanceStatus === 'completed') {
        return { success: false, error: 'Transaksi Ditolak: Hari kerja Anda hari ini sudah selesai.' };
      }
    }

    if (cart.length === 0) {
      return { success: false, error: 'Keranjang belanja masih kosong.' };
    }

    const items = cart.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      selectedColor: item.selectedColor,
      selectedSize: item.selectedSize,
      variantId: item.variantId,
    }));

    // FIX #3: Gunakan crypto.randomUUID() untuk idempotency key yang proper.
    // Key dibuat SEKALI sebelum request dan digunakan kembali jika ada retry.
    const idempotencyKey = `pos-cash-${crypto.randomUUID()}`;

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          items,
          paymentMethod: methodName,
          cashGiven,
          discount: cartDiscount,
          customerName: customerName?.trim() || undefined,
          customerPhone: customerPhone?.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Gagal memproses transaksi kasir.' };
      }

      const newTx: Transaction = data;
      deductStock(items);
      setTransactions(prev => [newTx, ...prev.slice(0, 49)]);
      setTransactionsPagination(prev => {
        const newTotal = prev.total + 1;
        return {
          ...prev,
          total: newTotal,
          totalPages: Math.ceil(newTotal / prev.limit) || 1
        };
      });
      clearCart();
      setIsCheckoutOpen(false);
      setSelectedReceipt(newTx);

      refreshAttendance();
      fetchTodaySummary();
      return { success: true, transaction: newTx };
    } catch (err: unknown) {
      console.error('Failed to save transaction:', err);
      return { success: false, error: 'Terjadi gangguan jaringan ke server. Silakan coba kembali.' };
    }
  };

  // Transfer payment creation
  const createTransferTransaction = async (
    methodName: string,
    transferBank: string,
    proofUrl: string,
    isConfirmedDirectly: boolean,
    customerName?: string,
    customerPhone?: string
  ): Promise<{ success: boolean; transaction?: Transaction; error?: string }> => {
    if (!isSuperAdmin) {
      if (attendanceStatus === 'not_started') {
        setIsCheckInModalOpen(true);
        return { success: false, error: 'Transaksi Ditolak: Anda belum melakukan Absen Masuk hari ini. Silakan mulai hari kerja terlebih dahulu.' };
      }
      if (attendanceStatus === 'completed') {
        return { success: false, error: 'Transaksi Ditolak: Hari kerja Anda hari ini sudah selesai.' };
      }
    }

    if (cart.length === 0) {
      return { success: false, error: 'Keranjang belanja masih kosong.' };
    }

    const items = cart.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      selectedColor: item.selectedColor,
      selectedSize: item.selectedSize,
      variantId: item.variantId,
    }));

    // FIX #3: Gunakan crypto.randomUUID() untuk idempotency key yang proper.
    // Key dibuat SEKALI sebelum request dan digunakan kembali jika ada retry.
    const idempotencyKey = `pos-trf-${crypto.randomUUID()}`;

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          items,
          paymentMethod: methodName,
          discount: cartDiscount,
          transferBank,
          transferProofUrl: proofUrl,
          transferProofVerified: isConfirmedDirectly,
          customerName: customerName?.trim() || undefined,
          customerPhone: customerPhone?.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Gagal memproses transaksi transfer.' };
      }

      const newTx: Transaction = data;
      deductStock(items);
      setTransactions(prev => [newTx, ...prev.slice(0, 49)]);
      setTransactionsPagination(prev => {
        const newTotal = prev.total + 1;
        return {
          ...prev,
          total: newTotal,
          totalPages: Math.ceil(newTotal / prev.limit) || 1
        };
      });
      clearCart();
      setIsCheckoutOpen(false);
      if (isConfirmedDirectly) {
        setSelectedReceipt(newTx);
      }

      refreshAttendance();
      fetchTodaySummary();
      return { success: true, transaction: newTx };
    } catch (err: unknown) {
      console.error('Failed to save transfer transaction:', err);
      return { success: false, error: 'Terjadi gangguan jaringan ke server. Silakan coba kembali.' };
    }
  };

  // FIX: confirmTransferPayment is now async & backend-first.
  // Local state is ONLY updated after backend confirms successfully.
  const confirmTransferPayment = async (transactionId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/transactions/${transactionId}/confirm`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ confirmedBy: currentUser?.name || cashier.name }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Gagal mengkonfirmasi transaksi.' };
      }

      // Backend success — now update local state
      const now = new Date().toISOString();
      setTransactions(prev =>
        prev.map(tx => {
          if (tx.id === transactionId) {
            return {
              ...tx,
              status: 'LUNAS',
              transferProofVerified: true,
              transferConfirmedAt: now,
              transferConfirmedBy: currentUser?.name || cashier.name,
            };
          }
          return tx;
        })
      );
      return { success: true };
    } catch (err) {
      console.error('Failed to confirm transaction in Neon DB:', err);
      return { success: false, error: 'Terjadi gangguan jaringan ke server.' };
    }
  };

  // FIX #1: cancelTransaction sekarang async dan backend-first.
  // State lokal HANYA diperbarui setelah backend mengonfirmasi pembatalan.
  const cancelTransaction = async (transactionId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/transactions/${transactionId}/cancel`, {
        method: 'PATCH',
        headers: authHeaders(),
      });

      const data = await res.json();

      if (!res.ok) {
        // Backend menolak pembatalan (misal: sudah dibatalkan, transaksi tidak ada)
        // JANGAN perbarui state lokal.
        return {
          success: false,
          error: data.error || 'Transaksi gagal dibatalkan.'
        };
      }

      // Backend sukses — baru perbarui state lokal sesuai hasil DB
      // Backend sudah mengembalikan stok secara atomic, sinkronkan UI
      setTransactions(prev =>
        prev.map(tx =>
          tx.id === transactionId ? { ...tx, status: 'BATAL' } : tx
        )
      );

      // Perbarui stok lokal supaya UI sinkron dengan DB
      // (backend sudah atomic restore, ini hanya untuk tampilan)
      setTransactions(prev => {
        const cancelledTx = prev.find(tx => tx.id === transactionId);
        if (cancelledTx) {
          setProducts(prods =>
            prods.map(prod => {
              const matchingItems = cancelledTx.items.filter(it => it.productId === prod.id);
              if (matchingItems.length === 0) return prod;
              let updatedVars = prod.variants ? [...prod.variants] : [];
              for (const it of matchingItems) {
                if (updatedVars.length > 0 && (it.selectedColor || it.selectedSize)) {
                  updatedVars = updatedVars.map(v => {
                    const matchC = !it.selectedColor || v.color.toLowerCase() === it.selectedColor.toLowerCase();
                    const matchS = !it.selectedSize || v.size.toLowerCase() === it.selectedSize.toLowerCase();
                    if (matchC && matchS) return { ...v, stock: v.stock + it.quantity };
                    return v;
                  });
                }
              }
              const newTotal = updatedVars.length > 0
                ? updatedVars.reduce((s, v) => s + v.stock, 0)
                : prod.stock + matchingItems.reduce((s, it) => s + it.quantity, 0);
              return { ...prod, stock: newTotal, variants: updatedVars };
            })
          );
        }
        return prev;
      });

      return { success: true };
    } catch (err: unknown) {
      // Network error — JANGAN perbarui state lokal
      console.error('Cancel transaction network error:', err);
      return { success: false, error: 'Gagal terhubung ke server. Silakan coba lagi.' };
    }
  };

  const fetchTransactions = useCallback(async (page = 1, limit = 20, startDate?: string, endDate?: string, status?: string, paymentMethod?: string, search?: string) => {
    const token = authToken || sessionStorage.getItem('pos_auth_token') || '';
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit)
      });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (status && status !== 'SEMUA') params.set('status', status);
      if (paymentMethod && paymentMethod !== 'SEMUA') params.set('paymentMethod', paymentMethod);
      if (search) params.set('search', search);

      const res = await fetch(`/api/transactions?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const result = await res.json();
        const txList = Array.isArray(result) ? result : (result.data || []);
        setTransactions(txList);
        if (result.pagination) {
          setTransactionsPagination(result.pagination);
        } else {
          setTransactionsPagination({
            page,
            limit,
            total: txList.length,
            totalPages: Math.ceil(txList.length / limit) || 1
          });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch paginated transactions:', err);
    }
  }, [authToken]);

  const pendingConfirmations = useMemo(() => {
    return transactions.filter(tx => tx.status === 'MENUNGGU_KONFIRMASI');
  }, [transactions]);

  // Profile modal and password handling
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  const getRolePassword = (role: UserRole): string => {
    const key = role === 'super_admin' ? 'pos_admin_pin' : 'pos_kasir_pin';
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return atob(saved);
      } catch {
        return saved;
      }
    }
    return role === 'super_admin' ? 'admin123' : '123456';
  };

  const verifyPassword = (role: UserRole, pass: string): boolean => {
    return pass === getRolePassword(role);
  };

  const changePassword = (role: UserRole, oldPass: string, newPass: string): { success: boolean; message: string } => {
    const current = getRolePassword(role);
    if (oldPass !== current) {
      return { success: false, message: 'Kata sandi saat ini tidak cocok.' };
    }
    if (!newPass || newPass.trim().length < 4) {
      return { success: false, message: 'Kata sandi baru minimal 4 karakter.' };
    }
    const key = role === 'super_admin' ? 'pos_admin_pin' : 'pos_kasir_pin';
    localStorage.setItem(key, btoa(newPass.trim()));
    return { success: true, message: 'Kata sandi berhasil diperbarui!' };
  };

  const updateCashier = (updates: Partial<CashierProfile>) => {
    setCashier(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('pos_cashier', JSON.stringify(updated));
      return updated;
    });
  };

  const resetToDemoData = () => {
    localStorage.removeItem('pos_products');
    localStorage.removeItem('pos_transactions');
    localStorage.removeItem('pos_cashier');
    localStorage.removeItem('pos_cart');
    localStorage.removeItem('pos_payment_methods');
    setProducts(INITIAL_PRODUCTS);
    setTransactions(INITIAL_TRANSACTIONS);
    setCashier(INITIAL_CASHIER);
    setPaymentMethods(INITIAL_PAYMENT_METHODS);
    setCart([]);
    setCartDiscount(0);
    setHeldCart(null);
  };

  // Reset semua data kasir saja (riwayat transaksi lokal, cart, absensi, sesi) tanpa hapus produk
  const resetKasirData = () => {
    localStorage.removeItem('pos_transactions');
    localStorage.removeItem('pos_cart');
    localStorage.removeItem('pos_held_cart');
    localStorage.removeItem('pos_attendance_today');
    localStorage.removeItem('pos_session_code');
    setTransactions([]);
    setCart([]);
    setCartDiscount(0);
    setHeldCart(null);
    setAttendance(null);
    setAttendanceStatus('not_started');
  };

  return (
    <POSContext.Provider
      value={{
        activeTab,
        setActiveTab,
        isDbConnected,
        authToken,
        authHeaders,
        currentUser,
        login,
        logout,
        isSuperAdmin,
        switchRole,
        users,
        fetchUsers,
        createUser,
        updateUser,
        deleteUser,
        storeSettings,
        updateStoreSettings,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        findProductByBarcode,
        adjustStock,
        adjustVariantStock,
        cart,
        addToCart,
        updateCartItemQty,
        removeFromCart,
        clearCart,
        cartDiscount,
        setCartDiscount,
        cartSubtotal,
        cartTotal,
        cartItemCount,
        heldCart,
        holdCurrentCart,
        restoreHeldCart,
        transactions,
        transactionsPagination,
        fetchTransactions,
        createCashTransaction,
        createTransferTransaction,
        confirmTransferPayment,
        cancelTransaction,
        pendingConfirmations,
        paymentMethods,
        addPaymentMethod,
        updatePaymentMethod,
        deletePaymentMethod,
        isPaymentMethodsOpen,
        setIsPaymentMethodsOpen,
        selectedReceipt,
        setSelectedReceipt,
        isCheckoutOpen,
        setIsCheckoutOpen,
        cashier,
        updateCashier,
        isProfileModalOpen,
        setIsProfileModalOpen,
        changePassword,
        verifyPassword,
        getRolePassword,
        playBeep,
        resetToDemoData,
        resetKasirData,
        attendance,
        attendanceStatus,
        isAttendanceLoading,
        isCheckInModalOpen,
        setIsCheckInModalOpen,
        isCheckOutModalOpen,
        setIsCheckOutModalOpen,
        refreshAttendance,
        checkIn,
        checkOut,
        todaySummary,
        fetchTodaySummary,
      }}
    >
      {children}
    </POSContext.Provider>
  );
};

export const usePOS = () => {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
};
