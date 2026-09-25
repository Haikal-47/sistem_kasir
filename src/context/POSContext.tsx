import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Product, CartItem, Transaction, CashierProfile, PaymentMethodConfig, ActiveTab } from '../types';
import { INITIAL_PRODUCTS, INITIAL_TRANSACTIONS, INITIAL_CASHIER, INITIAL_PAYMENT_METHODS } from '../data/initialData';

interface POSContextType {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  
  // Database connection indicator
  isDbConnected: boolean;

  // Products
  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => Product;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  findProductByBarcode: (barcode: string) => Product | undefined;
  
  // Cart
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  updateCartItemQty: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
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
  createCashTransaction: (cashGiven: number, methodName: string) => Transaction;
  createTransferTransaction: (methodName: string, transferBank: string, proofUrl: string, isConfirmedDirectly: boolean) => Transaction;
  confirmTransferPayment: (transactionId: string) => void;
  cancelTransaction: (transactionId: string) => void;
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
  
  // Audio & Notification
  playBeep: () => void;
  resetToDemoData: () => void;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('transaksi');
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);

  // Load from localStorage or initial fallback
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
        if (!hasOldGrocery && parsed.length > 0) {
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
        if (!hasOldGroceryTx && parsed.length > 0) {
          return parsed;
        }
      } catch (e) { console.error(e); }
    }
    return INITIAL_TRANSACTIONS;
  });

  const [cashier, setCashier] = useState<CashierProfile>(() => {
    const saved = localStorage.getItem('pos_cashier');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.outletName === 'MINIMARKET KASIR PRO') {
          parsed.outletName = 'ARFA FASHION';
          localStorage.setItem('pos_cashier', JSON.stringify(parsed));
        }
        return parsed;
      } catch (e) { console.error(e); }
    }
    return INITIAL_CASHIER;
  });

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
        const [prodRes, txRes, cashierRes, pmRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/transactions'),
          fetch('/api/cashier'),
          fetch('/api/payment-methods'),
        ]);

        if (prodRes.ok && txRes.ok) {
          const prodData = await prodRes.json();
          const txData = await txRes.json();
          if (Array.isArray(prodData) && prodData.length > 0) {
            const hasOldGrocery = prodData.some((p: Product) =>
              p.name?.toLowerCase().includes('aqua') ||
              p.name?.toLowerCase().includes('indomie') ||
              p.category === 'Minuman' ||
              p.category === 'Makanan Instan'
            );
            if (!hasOldGrocery) {
              setProducts(prodData);
            }
          }
          if (Array.isArray(txData)) {
            const hasOldTx = txData.some((t: Transaction) =>
              t.items?.some(it => it.name?.toLowerCase().includes('aqua') || it.name?.toLowerCase().includes('indomie'))
            );
            if (!hasOldTx) {
              setTransactions(txData);
            }
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
          setIsDbConnected(true);
        }
      } catch (err) {
        console.warn('Backend Neon API not reached, using local fallback:', err);
        setIsDbConnected(false);
      }
    };

    loadFromNeonDb();
  }, []);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('pos_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('pos_transactions', JSON.stringify(transactions));
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
    } catch (e) {
      // Ignore
    }
  };

  // Cart operations
  const addToCart = (product: Product, quantity: number = 1) => {
    playBeep();
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const newQty = Math.min(existing.quantity + quantity, product.stock);
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: newQty } : item
        );
      }
      return [{ product, quantity: Math.min(quantity, Math.max(1, product.stock)) }, ...prev];
    });
  };

  const updateCartItemQty = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item => {
        if (item.product.id === productId) {
          const maxStock = item.product.stock;
          return { ...item, quantity: Math.min(quantity, maxStock) };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCartDiscount(0);
  };

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
    const newProduct: Product = {
      ...data,
      id: `PRD-${Date.now().toString().slice(-4)}`,
    };
    setProducts(prev => [newProduct, ...prev]);

    fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(err => console.error('Failed to sync new product to Neon DB:', err));

    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(err => console.error('Failed to update product in Neon DB:', err));
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    removeFromCart(id);

    fetch(`/api/products/${id}`, {
      method: 'DELETE',
    }).catch(err => console.error('Failed to delete product from Neon DB:', err));
  };

  const findProductByBarcode = (barcode: string) => {
    const cleanCode = barcode.trim().toLowerCase();
    return products.find(p => p.barcode.toLowerCase() === cleanCode);
  };

  // Payment Method operations
  const addPaymentMethod = (data: Omit<PaymentMethodConfig, 'id'>) => {
    const newMethod: PaymentMethodConfig = {
      ...data,
      id: `PM-${Date.now().toString().slice(-6)}`,
    };
    setPaymentMethods(prev => [...prev, newMethod]);

    fetch('/api/payment-methods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMethod),
    }).catch(err => console.error('Failed to sync payment method:', err));
  };

  const updatePaymentMethod = (id: string, updates: Partial<PaymentMethodConfig>) => {
    setPaymentMethods(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));

    fetch(`/api/payment-methods/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(err => console.error('Failed to update payment method:', err));
  };

  const deletePaymentMethod = (id: string) => {
    setPaymentMethods(prev => prev.filter(m => m.id !== id));

    fetch(`/api/payment-methods/${id}`, {
      method: 'DELETE',
    }).catch(err => console.error('Failed to delete payment method:', err));
  };

  const deductStock = (items: { productId: string; quantity: number }[]) => {
    setProducts(prev =>
      prev.map(prod => {
        const bought = items.find(i => i.productId === prod.id);
        if (bought) {
          return { ...prod, stock: Math.max(0, prod.stock - bought.quantity) };
        }
        return prod;
      })
    );
  };

  const generateInvoiceNumber = () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `INV/${dateStr}/${rand}`;
  };

  // Cash payment creation — now accepts method name for flexibility
  const createCashTransaction = (cashGiven: number, methodName: string = 'Tunai'): Transaction => {
    const items = cart.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      brand: item.product.brand,
      price: item.product.price,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity,
    }));

    const changeAmount = Math.max(0, cashGiven - cartTotal);
    const newTx: Transaction = {
      id: `TRX-${Date.now()}`,
      invoiceNumber: generateInvoiceNumber(),
      date: new Date().toISOString(),
      cashierName: cashier.name,
      items,
      subtotal: cartSubtotal,
      tax: 0,
      discount: cartDiscount,
      total: cartTotal,
      paymentMethod: methodName,
      paymentMethodType: 'TUNAI',
      status: 'LUNAS',
      cashGiven,
      changeAmount,
    };

    deductStock(items);
    setTransactions(prev => [newTx, ...prev]);
    clearCart();
    setIsCheckoutOpen(false);
    setSelectedReceipt(newTx);

    fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTx),
    }).catch(err => console.error('Failed to save transaction to Neon DB:', err));

    return newTx;
  };

  // Transfer payment creation — now accepts method name
  const createTransferTransaction = (
    methodName: string,
    transferBank: string,
    proofUrl: string,
    isConfirmedDirectly: boolean
  ): Transaction => {
    const items = cart.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      brand: item.product.brand,
      price: item.product.price,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity,
    }));

    const now = new Date().toISOString();
    const newTx: Transaction = {
      id: `TRX-${Date.now()}`,
      invoiceNumber: generateInvoiceNumber(),
      date: now,
      cashierName: cashier.name,
      items,
      subtotal: cartSubtotal,
      tax: 0,
      discount: cartDiscount,
      total: cartTotal,
      paymentMethod: methodName,
      paymentMethodType: 'TRANSFER',
      status: isConfirmedDirectly ? 'LUNAS' : 'MENUNGGU_KONFIRMASI',
      transferBank,
      transferProofUrl: proofUrl,
      transferProofVerified: isConfirmedDirectly,
      transferConfirmedAt: isConfirmedDirectly ? now : undefined,
      transferConfirmedBy: isConfirmedDirectly ? cashier.name : undefined,
    };

    deductStock(items);
    setTransactions(prev => [newTx, ...prev]);
    clearCart();
    setIsCheckoutOpen(false);

    if (isConfirmedDirectly) {
      setSelectedReceipt(newTx);
    }

    fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTx),
    }).catch(err => console.error('Failed to save transfer transaction to Neon DB:', err));

    return newTx;
  };

  const confirmTransferPayment = (transactionId: string) => {
    const now = new Date().toISOString();
    setTransactions(prev =>
      prev.map(tx => {
        if (tx.id === transactionId) {
          return {
            ...tx,
            status: 'LUNAS',
            transferProofVerified: true,
            transferConfirmedAt: now,
            transferConfirmedBy: cashier.name,
          };
        }
        return tx;
      })
    );

    fetch(`/api/transactions/${transactionId}/confirm`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmedBy: cashier.name }),
    }).catch(err => console.error('Failed to confirm transaction in Neon DB:', err));
  };

  const cancelTransaction = (transactionId: string) => {
    setTransactions(prev =>
      prev.map(tx => {
        if (tx.id === transactionId) {
          tx.items.forEach(it => {
            setProducts(prods =>
              prods.map(p => (p.id === it.productId ? { ...p, stock: p.stock + it.quantity } : p))
            );
          });
          return { ...tx, status: 'BATAL' };
        }
        return tx;
      })
    );

    fetch(`/api/transactions/${transactionId}/cancel`, {
      method: 'PATCH',
    }).catch(err => console.error('Failed to cancel transaction in Neon DB:', err));
  };

  const pendingConfirmations = useMemo(() => {
    return transactions.filter(tx => tx.status === 'MENUNGGU_KONFIRMASI');
  }, [transactions]);

  const updateCashier = (updates: Partial<CashierProfile>) => {
    setCashier(prev => ({ ...prev, ...updates }));
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

  return (
    <POSContext.Provider
      value={{
        activeTab,
        setActiveTab,
        isDbConnected,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        findProductByBarcode,
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
        playBeep,
        resetToDemoData,
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
