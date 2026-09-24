import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { PaymentMethodConfig } from '../types';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Check,
  Banknote,
  CreditCard,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from 'lucide-react';

interface PaymentMethodsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLOR_OPTIONS = [
  { key: 'emerald', label: 'Hijau', bg: 'bg-emerald-500', ring: 'ring-emerald-400' },
  { key: 'sky', label: 'Biru Muda', bg: 'bg-sky-500', ring: 'ring-sky-400' },
  { key: 'blue', label: 'Biru', bg: 'bg-blue-600', ring: 'ring-blue-400' },
  { key: 'violet', label: 'Ungu', bg: 'bg-violet-600', ring: 'ring-violet-400' },
  { key: 'orange', label: 'Oranye', bg: 'bg-orange-500', ring: 'ring-orange-400' },
  { key: 'yellow', label: 'Kuning', bg: 'bg-yellow-500', ring: 'ring-yellow-400' },
  { key: 'rose', label: 'Merah Muda', bg: 'bg-rose-500', ring: 'ring-rose-400' },
  { key: 'slate', label: 'Abu', bg: 'bg-slate-500', ring: 'ring-slate-400' },
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

const EMPTY_FORM = {
  name: '',
  type: 'TRANSFER' as 'TUNAI' | 'TRANSFER',
  icon: '🏦',
  color: 'sky',
  isActive: true,
  isDefault: false,
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  description: '',
};

export const PaymentMethodsModal: React.FC<PaymentMethodsModalProps> = ({ isOpen, onClose }) => {
  const { paymentMethods, addPaymentMethod, updatePaymentMethod, deletePaymentMethod } = usePOS();

  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [formError, setFormError] = useState<string>('');

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const handleOpenEdit = (m: PaymentMethodConfig) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      type: m.type,
      icon: m.icon,
      color: m.color,
      isActive: m.isActive,
      isDefault: m.isDefault,
      bankName: m.bankName || '',
      accountNumber: m.accountNumber || '',
      accountHolder: m.accountHolder || '',
      description: m.description || '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      setFormError('Nama metode pembayaran tidak boleh kosong.');
      return;
    }
    // Check duplicate name (excluding the one being edited)
    const duplicate = paymentMethods.find(
      m => m.name.toLowerCase() === form.name.trim().toLowerCase() && m.id !== editingId
    );
    if (duplicate) {
      setFormError(`Metode "${form.name}" sudah ada. Gunakan nama lain.`);
      return;
    }

    if (editingId) {
      updatePaymentMethod(editingId, { ...form, name: form.name.trim() });
    } else {
      addPaymentMethod({ ...form, name: form.name.trim() });
    }
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleDelete = (m: PaymentMethodConfig) => {
    if (m.isDefault) return;
    if (confirm(`Hapus metode pembayaran "${m.name}"?`)) {
      deletePaymentMethod(m.id);
    }
  };

  const ICON_OPTIONS = ['💵', '🏦', '📱', '💳', '🔑', '🪙', '💰', '🎫'];

  return (
    <div 
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      style={{ zIndex: 9999 }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] relative"
        style={{ zIndex: 10000 }}
      >
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-brand-400" />
              Kelola Metode Pembayaran
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Aktif: {paymentMethods.filter(m => m.isActive).length} dari {paymentMethods.length} metode
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          
          {/* Method List */}
          {!showForm && (
            <div className="p-4 space-y-2">
              {paymentMethods.map((m) => {
                const c = getColorClasses(m.color);
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                      m.isActive ? `${c.bg} ${c.border}` : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    {/* Icon */}
                    <span className="text-2xl leading-none w-8 text-center">{m.icon}</span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${c.text}`}>{m.name}</span>
                        {m.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold">Default</span>
                        )}
                      </div>
                      <div className={`inline-flex items-center gap-1 text-[10px] font-semibold mt-0.5 px-1.5 py-0.5 rounded-full ${c.badge}`}>
                        {m.type === 'TUNAI' ? (
                          <><Banknote className="w-2.5 h-2.5" /> Konfirmasi Langsung</>
                        ) : (
                          <><CreditCard className="w-2.5 h-2.5" /> Perlu Bukti Transfer</>
                        )}
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Active toggle */}
                      <button
                        onClick={() => updatePaymentMethod(m.id, { isActive: !m.isActive })}
                        className="p-1.5 rounded-lg hover:bg-white/60 transition-colors"
                        title={m.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        {m.isActive
                          ? <ToggleRight className={`w-5 h-5 ${c.text}`} />
                          : <ToggleLeft className="w-5 h-5 text-slate-400" />
                        }
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => handleOpenEdit(m)}
                        className="p-1.5 rounded-lg hover:bg-white/60 transition-colors text-slate-500 hover:text-slate-800"
                        title="Edit Metode"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* Delete (disabled for default) */}
                      {!m.isDefault && (
                        <button
                          onClick={() => handleDelete(m)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 transition-colors text-slate-400 hover:text-rose-600"
                          title="Hapus Metode"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add New Button */}
              <button
                onClick={handleOpenAdd}
                className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50/50 transition-all flex items-center justify-center gap-2 text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Tambah Metode Pembayaran Baru
              </button>
            </div>
          )}

          {/* Add / Edit Form */}
          {showForm && (
            <div className="p-5 space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">
                {editingId ? '✏️ Edit Metode Pembayaran' : '➕ Metode Pembayaran Baru'}
              </h3>

              {formError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nama Metode *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => { setForm(f => ({ ...f, name: e.target.value })); setFormError(''); }}
                  placeholder="Contoh: GoPay, OVO, Dana, BCA..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-brand-500 rounded-xl text-sm text-slate-900 outline-none transition-all"
                  autoFocus
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tipe Konfirmasi *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: 'TUNAI' }))}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all text-xs font-semibold ${
                      form.type === 'TUNAI'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className={`w-4 h-4 ${form.type === 'TUNAI' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div>
                      <div>Konfirmasi Langsung</div>
                      <div className="font-normal text-[10px] mt-0.5 opacity-80">Langsung lunas tanpa bukti</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: 'TRANSFER' }))}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all text-xs font-semibold ${
                      form.type === 'TRANSFER'
                        ? 'border-sky-500 bg-sky-50 text-sky-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className={`w-4 h-4 ${form.type === 'TRANSFER' ? 'text-sky-600' : 'text-slate-400'}`} />
                    <div>
                      <div>Perlu Bukti Transfer</div>
                      <div className="font-normal text-[10px] mt-0.5 opacity-80">Verifikasi bukti pembayaran</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Bank & Account Info */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nama Bank / Provider</label>
                    <input
                      type="text"
                      value={form.bankName}
                      onChange={(e) => setForm(f => ({ ...f, bankName: e.target.value }))}
                      placeholder="Contoh: Bank BCA"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 focus:border-brand-500 rounded-lg text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nomor Rekening / VA</label>
                    <input
                      type="text"
                      value={form.accountNumber}
                      onChange={(e) => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                      placeholder="Contoh: 8820 4912 3901"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 focus:border-brand-500 rounded-lg text-xs font-mono outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nama Pemilik Rekening (A/N)</label>
                  <input
                    type="text"
                    value={form.accountHolder}
                    onChange={(e) => setForm(f => ({ ...f, accountHolder: e.target.value }))}
                    placeholder="Contoh: ARFA FASHION"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 focus:border-brand-500 rounded-lg text-xs outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Keterangan / Petunjuk Pembayaran</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Contoh: Verifikasi mutasi m-banking otomatis"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-brand-500 rounded-xl text-xs outline-none"
                />
              </div>

              {/* Icon */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ikon</label>
                <div className="flex flex-wrap gap-2">
                  {ICON_OPTIONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, icon: ic }))}
                      className={`w-9 h-9 rounded-lg border text-lg flex items-center justify-center transition-all ${
                        form.icon === ic
                          ? 'border-brand-500 bg-brand-50 scale-110 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Warna Aksen</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, color: c.key }))}
                      title={c.label}
                      className={`w-7 h-7 rounded-full ${c.bg} transition-all ${
                        form.color === c.key ? `ring-2 ring-offset-2 ${c.ring} scale-110` : 'hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {editingId ? 'Simpan Perubahan' : 'Tambah Metode'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showForm && (
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors"
            >
              Selesai
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
