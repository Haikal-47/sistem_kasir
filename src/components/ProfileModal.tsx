import React, { useState, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import {
  X,
  Crown,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Store,
  MapPin,
  Phone,
  User,
  Clock,
  Sparkles,
  Lock,
  Save,
  ArrowRight
} from 'lucide-react';

export const ProfileModal: React.FC = () => {
  const {
    isProfileModalOpen,
    setIsProfileModalOpen,
    cashier,
    updateCashier,
    isSuperAdmin,
    changePassword,
    switchRole,
  } = usePOS();

  const [activeTab, setActiveTab] = useState<'password' | 'profile'>('password');

  // Password state
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [passwordError, setPasswordError] = useState<string>('');
  const [passwordSuccess, setPasswordSuccess] = useState<string>('');

  // Profile data state
  const [profileName, setProfileName] = useState<string>('');
  const [shiftName, setShiftName] = useState<string>('');
  const [outletName, setOutletName] = useState<string>('');
  const [outletAddress, setOutletAddress] = useState<string>('');
  const [outletPhone, setOutletPhone] = useState<string>('');
  const [profileSuccess, setProfileSuccess] = useState<string>('');

  // Sync state whenever modal opens or cashier changes
  useEffect(() => {
    if (isProfileModalOpen) {
      setProfileName(cashier.name || '');
      setShiftName(cashier.shift || '');
      setOutletName(cashier.outletName || 'ARFA FASHION');
      setOutletAddress(cashier.outletAddress || '');
      setOutletPhone(cashier.outletPhone || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      setPasswordSuccess('');
      setProfileSuccess('');
    }
  }, [isProfileModalOpen, cashier]);

  if (!isProfileModalOpen) return null;

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Masukkan kata sandi saat ini.');
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      setPasswordError('Kata sandi baru minimal 4 karakter / digit.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi kata sandi tidak cocok dengan kata sandi baru.');
      return;
    }

    const res = changePassword(cashier.role, currentPassword, newPassword);
    if (!res.success) {
      setPasswordError(res.message);
    } else {
      setPasswordSuccess('Kata sandi berhasil diubah! Gunakan kata sandi baru ini saat login.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordSuccess('');
      }, 4000);
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess('');

    if (!profileName.trim()) {
      alert('Nama pengguna tidak boleh kosong.');
      return;
    }

    updateCashier({
      name: profileName.trim(),
      shift: shiftName.trim() || cashier.shift,
      outletName: outletName.trim() || 'ARFA FASHION',
      outletAddress: outletAddress.trim(),
      outletPhone: outletPhone.trim(),
    });

    setProfileSuccess('Data profil dan toko berhasil disimpan!');
    setTimeout(() => {
      setProfileSuccess('');
    }, 3000);
  };

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      style={{ zIndex: 99999 }}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] relative"
        style={{ zIndex: 100000 }}
      >
        {/* Accent top gradient bar */}
        <div className={`h-1.5 ${
          isSuperAdmin
            ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500'
            : 'bg-gradient-to-r from-brand-600 to-indigo-500'
        }`} />

        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
              isSuperAdmin
                ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/30 text-amber-400 border border-amber-500/30'
                : 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
            }`}>
              {isSuperAdmin ? <Crown className="w-6 h-6" /> : <User className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-base md:text-lg text-white">
                  Profil &amp; Keamanan Akun
                </h2>
                {isSuperAdmin ? (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 tracking-wider">
                    Super Admin
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 tracking-wider">
                    Kasir
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {cashier.name} • {cashier.outletName || 'ARFA FASHION'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsProfileModalOpen(false)}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`pb-3 px-3 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'password'
                ? 'text-brand-700 border-b-2 border-brand-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Ganti Kata Sandi / PIN</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-3 px-3 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'text-brand-700 border-b-2 border-brand-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Data Profil &amp; Toko</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white">
          {/* TAB 1: GANTI KATA SANDI */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {/* Informational Callout */}
              <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
                isSuperAdmin
                  ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                  : 'bg-brand-50 border-brand-200 text-brand-900'
              }`}>
                <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${
                  isSuperAdmin ? 'text-amber-600' : 'text-brand-600'
                }`} />
                <div className="space-y-1">
                  <p className="font-bold">
                    Pengaturan Kata Sandi Akun {isSuperAdmin ? 'Super Admin' : 'Kasir'}
                  </p>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    Kata sandi / PIN ini digunakan saat masuk ke terminal POS. Anda dapat menggunakan kombinasi angka (PIN) atau huruf &amp; angka (minimal 4 karakter).
                  </p>
                </div>
              </div>

              {/* Error Message Banner */}
              {passwordError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2.5 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{passwordError}</span>
                </div>
              )}

              {/* Success Message Banner */}
              {passwordSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5 animate-in fade-in duration-150">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {/* 1. Kata Sandi Saat Ini */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kata Sandi / PIN Saat Ini <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan kata sandi lama (Default: 123456)"
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-brand-600 rounded-xl text-xs font-medium text-slate-900 outline-hidden transition-all shadow-2xs"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    tabIndex={-1}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 2. Kata Sandi Baru */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kata Sandi / PIN Baru <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 4 karakter / angka"
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-brand-600 rounded-xl text-xs font-medium text-slate-900 outline-hidden transition-all shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 3. Konfirmasi Kata Sandi Baru */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Konfirmasi Kata Sandi Baru <span className="text-rose-500">*</span>
                  </label>
                  {newPassword && confirmPassword && (
                    <span className={`text-[11px] font-bold flex items-center gap-1 ${
                      passwordsMatch ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {passwordsMatch ? (
                        <><CheckCircle2 className="w-3.5 h-3.5" /> Cocok</>
                      ) : (
                        <><AlertCircle className="w-3.5 h-3.5" /> Belum cocok</>
                      )}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi baru"
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-brand-600 rounded-xl text-xs font-medium text-slate-900 outline-hidden transition-all shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className={`w-full py-3 px-4 rounded-xl text-xs font-extrabold text-white flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] ${
                    isSuperAdmin
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                      : 'bg-brand-600 hover:bg-brand-700 shadow-brand-600/20'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Kata Sandi Baru</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: PROFIL & DATA TOKO */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {profileSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5 animate-in fade-in duration-150">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {/* Nama Pengguna */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Tampilan Akun
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Nama Admin / Kasir..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-brand-600 rounded-xl text-xs font-medium text-slate-900 outline-hidden transition-all shadow-2xs"
                  />
                </div>
              </div>

              {/* Shift Kasir */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Shift / Keterangan Waktu
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={shiftName}
                    onChange={(e) => setShiftName(e.target.value)}
                    placeholder="Contoh: Shift 1 (07:00 - 15:00) atau Full Akses"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-brand-600 rounded-xl text-xs font-medium text-slate-900 outline-hidden transition-all shadow-2xs"
                  />
                </div>
              </div>

              {/* Nama Toko / Outlet */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Toko / Outlet (Dicetak pada Struk)
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={outletName}
                    onChange={(e) => setOutletName(e.target.value)}
                    placeholder="ARFA FASHION"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-brand-600 rounded-xl text-xs font-bold text-slate-900 outline-hidden transition-all shadow-2xs"
                  />
                </div>
              </div>

              {/* Alamat Outlet */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Alamat Toko / Outlet
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <textarea
                    rows={2}
                    value={outletAddress}
                    onChange={(e) => setOutletAddress(e.target.value)}
                    placeholder="Jl. Merdeka Raya No. 45, Jakarta Pusat"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-brand-600 rounded-xl text-xs font-medium text-slate-900 outline-hidden transition-all shadow-2xs resize-none"
                  />
                </div>
              </div>

              {/* No Telepon Outlet */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor Telepon / WhatsApp Toko
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={outletPhone}
                    onChange={(e) => setOutletPhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx / 021-5550192"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-brand-600 rounded-xl text-xs font-medium text-slate-900 outline-hidden transition-all shadow-2xs"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl text-xs font-extrabold text-white bg-slate-900 hover:bg-slate-800 shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Data Profil &amp; Toko</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer with quick role switch info */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="text-[11px]">Role aktif saat ini:</span>
            <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
              isSuperAdmin ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700'
            }`}>
              {isSuperAdmin ? 'Super Admin' : 'Kasir'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              const nextRole = isSuperAdmin ? 'kasir' : 'super_admin';
              switchRole(nextRole);
            }}
            className="text-[11px] font-bold text-brand-700 hover:text-brand-900 flex items-center gap-1 hover:underline"
          >
            <span>Beralih ke {isSuperAdmin ? 'Kasir' : 'Super Admin'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
