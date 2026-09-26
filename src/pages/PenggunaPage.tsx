import React, { useState, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import { UserAccount, UserRole } from '../types';
import { 
  Users, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  ShieldCheck, 
  Crown, 
  User, 
  ToggleLeft, 
  ToggleRight, 
  X, 
  Check, 
  Lock, 
  KeyRound, 
  AlertCircle 
} from 'lucide-react';

export const PenggunaPage: React.FC = () => {
  const { users, fetchUsers, createUser, updateUser, deleteUser, currentUser } = usePOS();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'super_admin' | 'kasir'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  // Form Fields
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<UserRole>('kasir');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQ = !q || u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q);
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesQ && matchesRole;
  });

  const handleOpenAdd = () => {
    setEditingUser(null);
    setUsername('');
    setPassword('');
    setName('');
    setRole('kasir');
    setIsActive(true);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: UserAccount) => {
    setEditingUser(u);
    setUsername(u.username);
    setPassword(''); // leave blank if unchanged
    setName(u.name);
    setRole(u.role);
    setIsActive(u.isActive);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !name.trim()) {
      setErrorMsg('Username dan Nama Lengkap wajib diisi.');
      return;
    }
    if (!editingUser && (!password || password.length < 4)) {
      setErrorMsg('Kata sandi awal minimal 4 karakter.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    if (editingUser) {
      const payload: { username: string; name: string; role: UserRole; isActive: boolean; password?: string } = {
        username: username.trim(),
        name: name.trim(),
        role,
        isActive
      };
      if (password && password.trim().length >= 4) {
        payload.password = password.trim();
      }
      const res = await updateUser(editingUser.id, payload);
      setIsSubmitting(false);
      if (res.success) {
        setIsModalOpen(false);
      } else {
        setErrorMsg(res.error || 'Gagal memperbarui pengguna.');
      }
    } else {
      const res = await createUser({
        username: username.trim(),
        password: password.trim(),
        name: name.trim(),
        role
      });
      setIsSubmitting(false);
      if (res.success) {
        setIsModalOpen(false);
      } else {
        setErrorMsg(res.error || 'Gagal membuat pengguna.');
      }
    }
  };

  const handleToggleActive = async (u: UserAccount) => {
    if (currentUser?.id === u.id) {
      alert('Anda tidak dapat menonaktifkan akun yang sedang aktif digunakan.');
      return;
    }
    await updateUser(u.id, { isActive: !u.isActive });
  };

  const handleDelete = async (u: UserAccount) => {
    if (currentUser?.id === u.id) {
      alert('Anda tidak dapat menghapus akun Anda sendiri.');
      return;
    }
    if (confirm(`Yakin ingin menghapus pengguna "${u.name}" (${u.username})?`)) {
      const res = await deleteUser(u.id);
      if (!res.success) {
        alert(res.error || 'Gagal menghapus pengguna.');
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden">
      
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-800">
              Pengelolaan Pengguna &amp; Hak Akses Role
            </h1>
            <p className="text-xs text-slate-500">
              Kelola akun staf kasir dan super administrator sistem ARFA FASHION.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-brand-600/25 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>+ Tambah Pengguna Baru</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {[
            { key: 'ALL', label: `Semua User (${users.length})` },
            { key: 'super_admin', label: `Super Admin (${users.filter(u => u.role === 'super_admin').length})` },
            { key: 'kasir', label: `Kasir (${users.filter(u => u.role === 'kasir').length})` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setRoleFilter(f.key as any)}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all ${
                roleFilter === f.key
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
            placeholder="Cari username atau nama..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 focus:border-brand-600 rounded-xl text-xs text-slate-800 outline-none shadow-2xs"
          />
        </div>
      </div>

      {/* User Table */}
      <div className="flex-1 px-6 pb-6 overflow-hidden">
        <div className="h-full bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-5">Nama Pengguna</th>
                  <th className="py-3 px-4">Username Login</th>
                  <th className="py-3 px-4">Role / Hak Akses</th>
                  <th className="py-3 px-4 text-center">Status Akun</th>
                  <th className="py-3 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-700">Tidak ada pengguna yang cocok</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSuper = u.role === 'super_admin';
                    const isSelf = currentUser?.id === u.id;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        
                        {/* Name & Avatar */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                              isSuper ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-brand-50 text-brand-700 border border-brand-200'
                            }`}>
                              {isSuper ? <Crown className="w-4 h-4" /> : <User className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 text-sm">{u.name}</span>
                                {isSelf && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                                    Anda
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">{u.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Username */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                          @{u.username}
                        </td>

                        {/* Role Badge */}
                        <td className="py-3.5 px-4">
                          {isSuper ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[11px] font-bold">
                              <Crown className="w-3.5 h-3.5 text-amber-600" />
                              <span>Super Admin (Full Akses)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold">
                              <User className="w-3.5 h-3.5 text-slate-500" />
                              <span>Kasir (Operasional POS)</span>
                            </span>
                          )}
                        </td>

                        {/* Status Toggle */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleToggleActive(u)}
                            disabled={isSelf}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                              u.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'
                            } ${isSelf ? 'opacity-60 cursor-not-allowed' : ''}`}
                            title={isSelf ? 'Akun Anda sendiri' : 'Klik untuk ubah status aktif/nonaktif'}
                          >
                            {u.isActive ? (
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
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(u)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-700 hover:bg-brand-50 transition-colors"
                              title="Edit Pengguna & Password"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDelete(u)}
                              disabled={isSelf}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isSelf ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              }`}
                              title={isSelf ? 'Tidak bisa menghapus diri sendiri' : 'Hapus Pengguna'}
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

          <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between px-5">
            <span>
              Total <strong>{users.length}</strong> akun terdaftar di sistem ARFA FASHION POS.
            </span>
            <span className="text-[11px] text-slate-400">
              Role kasir otomatis dibatasi hanya untuk terminal transaksi &amp; riwayat.
            </span>
          </div>
        </div>
      </div>

      {/* Modal Add / Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {editingUser ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {editingUser ? `Perbarui akun ${editingUser.name}` : 'Buat akun untuk kasir atau administrator baru'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Gusti Wardana"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:border-brand-600 outline-none font-medium text-slate-900"
                  autoFocus
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Username Login <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="Contoh: gusti"
                  className="w-full px-3.5 py-2.5 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:border-brand-600 outline-none text-slate-900"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kata Sandi {editingUser && <span className="text-slate-400 font-normal">(kosongkan jika tidak diubah)</span>}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUser ? '••••••' : 'Minimal 4 karakter'}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:border-brand-600 outline-none font-mono text-slate-900"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tentukan Hak Akses Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('kasir')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      role === 'kasir'
                        ? 'border-brand-500 bg-brand-50 text-brand-900 ring-2 ring-brand-400/40 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <User className="w-3.5 h-3.5" />
                      <span>Kasir</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Hanya akses Kasir &amp; Riwayat</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('super_admin')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      role === 'super_admin'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-400/40 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Crown className="w-3.5 h-3.5 text-amber-600" />
                      <span>Super Admin</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Full kontrol seluruh sistem</p>
                  </button>
                </div>
              </div>

              {/* Status Aktif */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700">Status Akun Aktif</span>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {isActive ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                  <span>{isActive ? 'Aktif' : 'Nonaktif'}</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex gap-2 justify-end border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 px-5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 shadow-md shadow-brand-600/25 flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingUser ? 'Simpan Perubahan' : 'Buat Pengguna'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
