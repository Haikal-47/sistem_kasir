import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { PaymentMethodConfig } from '../types';
import { 
  CreditCard, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  X, 
  Check, 
  Banknote,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Building2,
  Hash,
  User,
  FileText,
  ShieldCheck,
  Layers,
  Copy
} from 'lucide-react';

const COLOR_OPTIONS = [
  { key: 'emerald', label: 'Hijau', bg: 'bg-emerald-500', ring: 'ring-emerald-400' },
  { key: 'sky', label: 'Biru Muda', bg: 'bg-sky-500', ring: 'ring-sky-400' },
  { key: 'blue', label: 'Biru', bg: 'bg-blue-600', ring: 'ring-blue-400' },
  { key: 'violet', label: 'Ungu', bg: 'bg-violet-600', ring: 'ring-violet-400' },
  { key: 'orange', label: 'Oranye', bg: 'bg-orange-500', ring: 'ring-orange-400' },
  { key: 'yellow', label: 'Kuning', bg: 'bg-yellow-500', ring: 'ring-yellow-400' },
  { key: 'rose', label: 'Merah Muda', bg: 'bg-rose-500', ring: 'ring-rose-400' },
  { key: 'slate', label: 'Abu-Abu', bg: 'bg-slate-500', ring: 'ring-slate-400' },
];

const getColorClasses = (color: string) => {
  const map: Record<string, { bg: string; text: string; border: string; badge: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
    sky:     { bg: 'bg-sky-50',     text: 'text-sky-800',     border: 'border-sky-200',     badge: 'bg-sky-100 text-sky-700' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700' },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-800',  border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-700' },
    orange:  { bg: 'bg-orange-50',  text: 'text-orange-800',  border: 'border-orange-200',  badge: 'bg-orange-100 text-orange-700' },
    yellow:  { bg: 'bg-yellow-50',  text: 'text-yellow-800',  border: 'border-yellow-200',  badge: 'bg-yellow-100 text-yellow-800' },
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-800',    border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-700' },
    slate:   { bg: 'bg-slate-50',   text: 'text-slate-800',   border: 'border-slate-200',   badge: 'bg-slate-100 text-slate-700' },
  };
  return map[color] || map['slate'];
};

const ICON_OPTIONS = ['💵', '🏦', '📱', '💳', '🔑', '🪙', '💰', '🎫', '🛒', '⚡'];

export const PaymentMethodsPage: React.FC = () => {
  const { paymentMethods, addPaymentMethod, updatePaymentMethod, deletePaymentMethod } = usePOS();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'TUNAI' | 'TRANSFER'>('ALL');
  
  // Modal Form State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethodConfig | null>(null);
  
  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formBankName, setFormBankName] = useState<string>('');
  const [formAccountNumber, setFormAccountNumber] = useState<string>('');
  const [formAccountHolder, setFormAccountHolder] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formType, setFormType] = useState<'TUNAI' | 'TRANSFER'>('TRANSFER');
  const [formIcon, setFormIcon] = useState<string>('🏦');
  const [formColor, setFormColor] = useState<string>('sky');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Stats
  const totalCount = paymentMethods.length;
  const activeCount = paymentMethods.filter(m => m.isActive).length;
  const tunaiCount = paymentMethods.filter(m => m.type === 'TUNAI').length;
  const transferCount = paymentMethods.filter(m => m.type === 'TRANSFER').length;

  // Filtered List
  const filteredMethods = paymentMethods.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      m.name.toLowerCase().includes(q) || 
      (m.bankName && m.bankName.toLowerCase().includes(q)) ||
      (m.accountNumber && m.accountNumber.includes(q)) ||
      (m.accountHolder && m.accountHolder.toLowerCase().includes(q)) ||
      (m.description && m.description.toLowerCase().includes(q));
    
    let matchesFilter = true;
    if (filterType === 'ACTIVE') matchesFilter = m.isActive;
    else if (filterType === 'INACTIVE') matchesFilter = !m.isActive;
    else if (filterType === 'TUNAI') matchesFilter = m.type === 'TUNAI';
    else if (filterType === 'TRANSFER') matchesFilter = m.type === 'TRANSFER';

    return matchesSearch && matchesFilter;
  });

  const handleOpenAdd = () => {
    setEditingMethod(null);
    setFormName('');
    setFormBankName('');
    setFormAccountNumber('');
    setFormAccountHolder('');
    setFormDescription('');
    setFormType('TRANSFER');
    setFormIcon('🏦');
    setFormColor('sky');
    setFormIsActive(true);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: PaymentMethodConfig) => {
    setEditingMethod(m);
    setFormName(m.name);
    setFormBankName(m.bankName || '');
    setFormAccountNumber(m.accountNumber || '');
    setFormAccountHolder(m.accountHolder || '');
    setFormDescription(m.description || '');
    setFormType(m.type);
    setFormIcon(m.icon);
    setFormColor(m.color);
    setFormIsActive(m.isActive);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleDelete = (m: PaymentMethodConfig) => {
    if (m.isDefault) {
      alert('Metode Tunai adalah metode bawaan sistem dan tidak dapat dihapus.');
      return;
    }
    if (confirm(`Hapus metode pembayaran "${m.name}"?`)) {
      deletePaymentMethod(m.id);
    }
  };

  const handleToggleActive = (m: PaymentMethodConfig) => {
    updatePaymentMethod(m.id, { isActive: !m.isActive });
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) {
      setErrorMessage('Nama metode pembayaran wajib diisi.');
      return;
    }

    // Duplicate check
    const isDuplicate = paymentMethods.some(
      m => m.name.toLowerCase() === cleanName.toLowerCase() && m.id !== editingMethod?.id
    );
    if (isDuplicate) {
      setErrorMessage(`Metode dengan nama "${cleanName}" sudah terdaftar.`);
      return;
    }

    if (editingMethod) {
      updatePaymentMethod(editingMethod.id, {
        name: cleanName,
        type: formType,
        icon: formIcon,
        color: formColor,
        isActive: formIsActive,
        bankName: formBankName.trim(),
        accountNumber: formAccountNumber.trim(),
        accountHolder: formAccountHolder.trim(),
        description: formDescription.trim(),
      });
    } else {
      addPaymentMethod({
        name: cleanName,
        type: formType,
        icon: formIcon,
        color: formColor,
        isActive: formIsActive,
        isDefault: false,
        bankName: formBankName.trim(),
        accountNumber: formAccountNumber.trim(),
        accountHolder: formAccountHolder.trim(),
        description: formDescription.trim(),
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden">
      
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-800">
                Pengelolaan Metode Pembayaran
              </h1>
              <p className="text-xs text-slate-500">
                Atur metode bayar, nama bank, no rekening, pemilik, keterangan & status aktif kasir.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-brand-600/25 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>+ Tambah Metode Baru</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="p-6 pb-2 grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Metode</p>
            <p className="text-xl font-extrabold text-slate-800">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Metode Aktif</p>
            <p className="text-xl font-extrabold text-emerald-700">{activeCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-600">Tipe Tunai</p>
            <p className="text-xl font-extrabold text-teal-700">{tunaiCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600">Transfer & QRIS</p>
            <p className="text-xl font-extrabold text-sky-700">{transferCount}</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { key: 'ALL', label: 'Semua' },
            { key: 'ACTIVE', label: `Aktif (${activeCount})` },
            { key: 'INACTIVE', label: `Nonaktif (${totalCount - activeCount})` },
            { key: 'TUNAI', label: 'Tunai' },
            { key: 'TRANSFER', label: 'Transfer / QRIS' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key as any)}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap ${
                filterType === f.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama metode, bank, rekening..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 focus:border-brand-600 rounded-xl text-xs text-slate-800 outline-hidden transition-all"
          />
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 px-6 pb-6 overflow-hidden">
        <div className="h-full bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col overflow-hidden">
          
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-5">Metode Pembayaran</th>
                  <th className="py-3 px-4">Informasi Rekening / Bank</th>
                  <th className="py-3 px-4">Jenis Alur</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-4 text-center">Status Aktif</th>
                  <th className="py-3 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredMethods.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <CreditCard className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-700">Tidak ada metode pembayaran ditemukan</p>
                      <p className="text-[11px] text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau tambah metode baru.</p>
                    </td>
                  </tr>
                ) : (
                  filteredMethods.map((method) => {
                    const colors = getColorClasses(method.color);
                    const isTunai = method.type === 'TUNAI';

                    return (
                      <tr key={method.id} className="hover:bg-slate-50/70 transition-colors group">
                        
                        {/* Name & Icon */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border ${colors.bg} ${colors.border} shadow-2xs shrink-0`}>
                              {method.icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm">{method.name}</span>
                                {method.isDefault && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 uppercase tracking-wider">
                                    Bawaan
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {method.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Bank & Account Info */}
                        <td className="py-3.5 px-4">
                          {method.accountNumber || method.bankName ? (
                            <div className="space-y-0.5">
                              {method.bankName && (
                                <p className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{method.bankName}</span>
                                </p>
                              )}
                              {method.accountNumber && (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                                    {method.accountNumber}
                                  </span>
                                  <button
                                    onClick={() => handleCopy(method.accountNumber!, method.id)}
                                    className="text-slate-400 hover:text-brand-600 p-0.5"
                                    title="Salin nomor rekening"
                                  >
                                    {copiedId === method.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              )}
                              {method.accountHolder && (
                                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span>A/N: <strong className="text-slate-700">{method.accountHolder}</strong></span>
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">
                              {isTunai ? '— Kasir Tunai —' : 'Belum ada data rekening'}
                            </span>
                          )}
                        </td>

                        {/* Type */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                            isTunai ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                          }`}>
                            {isTunai ? <Banknote className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                            <span>{isTunai ? 'Tunai' : 'Transfer'}</span>
                          </span>
                        </td>

                        {/* Description */}
                        <td className="py-3.5 px-4 max-w-xs">
                          {method.description ? (
                            <p className="text-[11px] text-slate-600 line-clamp-2" title={method.description}>
                              {method.description}
                            </p>
                          ) : (
                            <span className="text-slate-300 text-[11px]">-</span>
                          )}
                        </td>

                        {/* Status Toggle */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleToggleActive(method)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                              method.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                                : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'
                            }`}
                            title={method.isActive ? 'Metode aktif di kasir. Klik untuk menonaktifkan' : 'Metode nonaktif. Klik untuk mengaktifkan'}
                          >
                            {method.isActive ? (
                              <>
                                <ToggleRight className="w-4 h-4 text-emerald-600" />
                                <span>Aktif</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-4 h-4 text-slate-400" />
                                <span>Nonaktif</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(method)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 border border-transparent hover:border-brand-200 transition-colors"
                              title="Edit Metode"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDelete(method)}
                              disabled={method.isDefault}
                              className={`p-1.5 rounded-lg transition-colors ${
                                method.isDefault
                                  ? 'text-slate-200 cursor-not-allowed'
                                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200'
                              }`}
                              title={method.isDefault ? 'Metode Tunai bawaan tidak dapat dihapus' : 'Hapus Metode'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer note */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between px-5">
            <span>
              Menampilkan <strong>{filteredMethods.length}</strong> dari <strong>{totalCount}</strong> metode pembayaran.
            </span>
            <span className="text-[11px] text-slate-400">
              Tersambung langsung dengan Neon PostgreSQL Database
            </span>
          </div>

        </div>
      </div>

      {/* ================= MODAL TAMBAH / EDIT METODE (LENGKAP) ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-60 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white text-lg">
                  {formIcon}
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {editingMethod ? 'Edit Metode Pembayaran' : 'Tambah Metode Pembayaran Baru'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {editingMethod ? `Memperbarui data ${editingMethod.name}` : 'Form lengkap nama metode, bank, rekening, keterangan & status'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveForm} className="p-6 overflow-y-auto flex-1 space-y-4">
              
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. Nama Metode & Jenis Alur */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Metode Pembayaran <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Contoh: BCA Transfer, QRIS, GoPay"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-brand-600 outline-hidden transition-all"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jenis Alur Pembayaran
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormType('TUNAI');
                        if (formIcon === '🏦') setFormIcon('💵');
                      }}
                      className={`py-2 px-2.5 rounded-xl border text-center font-bold text-xs transition-all ${
                        formType === 'TUNAI'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      💵 Tunai Langsung
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormType('TRANSFER');
                        if (formIcon === '💵') setFormIcon('🏦');
                      }}
                      className={`py-2 px-2.5 rounded-xl border text-center font-bold text-xs transition-all ${
                        formType === 'TRANSFER'
                          ? 'bg-sky-50 border-sky-500 text-sky-900 ring-1 ring-sky-500'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      🏦 Transfer / QRIS
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Informasi Bank & Rekening (Hanya relevan jika Transfer / Non-tunai) */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand-600" />
                  <p className="text-xs font-bold text-slate-800">
                    Informasi Rekening & Bank {formType === 'TUNAI' && <span className="text-slate-400 font-normal">(Opsional untuk Tunai)</span>}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Nama Bank / Provider
                    </label>
                    <input
                      type="text"
                      value={formBankName}
                      onChange={(e) => setFormBankName(e.target.value)}
                      placeholder="Contoh: Bank Central Asia (BCA)"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-brand-600 outline-hidden transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Nomor Rekening / No. VA
                    </label>
                    <input
                      type="text"
                      value={formAccountNumber}
                      onChange={(e) => setFormAccountNumber(e.target.value)}
                      placeholder="Contoh: 8820 4912 3901"
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:border-brand-600 outline-hidden transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Nama Pemilik Rekening (Atas Nama)
                  </label>
                  <input
                    type="text"
                    value={formAccountHolder}
                    onChange={(e) => setFormAccountHolder(e.target.value)}
                    placeholder="Contoh: Kasir Kita Pro / PT Toko Retail"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-brand-600 outline-hidden transition-all"
                  />
                </div>
              </div>

              {/* 3. Keterangan / Petunjuk */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Keterangan / Catatan Pembayaran</span>
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Contoh: Verifikasi bukti mutasi via m-banking, scan QRIS statis kasir, atau bebas biaya admin"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-brand-600 outline-hidden transition-all resize-none"
                />
              </div>

              {/* 4. Ikon & Aksen Warna */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Pilih Ikon Emoji
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ICON_OPTIONS.map((ico) => (
                      <button
                        key={ico}
                        type="button"
                        onClick={() => setFormIcon(ico)}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center text-base transition-all ${
                          formIcon === ico
                            ? 'bg-brand-50 border-brand-500 ring-2 ring-brand-400'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        {ico}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Pilihan Aksen Warna
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setFormColor(opt.key)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                          formColor === opt.key
                            ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-400'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${opt.bg}`} />
                        <span>{opt.label.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 5. Status Aktif / Nonaktif */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Status Aktif Metode</p>
                  <p className="text-[11px] text-slate-500">Jika aktif, metode ini dapat dipilih kasir saat checkout belanja</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormIsActive(!formIsActive)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                    formIsActive
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {formIsActive ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                  <span>{formIsActive ? 'Aktif' : 'Nonaktif'}</span>
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/25 transition-all active:scale-[0.99]"
                >
                  {editingMethod ? 'Simpan Perubahan' : 'Tambah Metode Pembayaran'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
