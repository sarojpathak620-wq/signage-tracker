'use client';

import React, { useState, useEffect } from 'react';
import { Profile, Unit, UserRole } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { 
  Users, UserPlus, Edit2, Shield, Phone, Mail, 
  Building2, Search, Filter, X, CheckCircle2, AlertCircle, Trash2 
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  
  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('bd_executive');
  const [phone, setPhone] = useState('');
  const [unitId, setUnitId] = useState<string>('');
  
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Delete User Confirmation State
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<Profile | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';
  const adminCount = users.filter(u => u.role === 'admin').length;
  const isSelf = editingUser?.id === currentUser?.id;
  const isLastAdmin = editingUser?.role === 'admin' && adminCount <= 1;
  const canDelete = isAdmin && !isSelf && !isLastAdmin;

  const handleConfirmDeleteUser = async () => {
    if (!confirmDeleteUser) return;
    try {
      setDeletingUser(true);
      setDeleteError(null);
      await DataService.deleteUser(confirmDeleteUser.id);
      setFeedback({
        type: 'success',
        message: `User "${confirmDeleteUser.full_name}" has been permanently removed. Any assigned signages are now unassigned.`,
      });
      setConfirmDeleteUser(null);
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      setDeleteError(err.message || 'Failed to delete user.');
    } finally {
      setDeletingUser(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [profilesData, unitsData] = await Promise.all([
        DataService.getProfiles(),
        DataService.getUnits(),
      ]);
      setUsers(profilesData);
      setUnits(unitsData);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('bd_executive');
    setPhone('');
    setUnitId(units[0]?.id || '');
    setIsModalOpen(true);
    setFeedback(null);
  };

  const openEditModal = (profile: Profile) => {
    setEditingUser(profile);
    setFullName(profile.full_name);
    setEmail(profile.email || '');
    setPassword('');
    setRole(profile.role);
    setPhone(profile.phone || '');
    setUnitId(profile.unit_id || '');
    setIsModalOpen(true);
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    setSubmitting(true);
    try {
      if (editingUser) {
        await DataService.updateProfile(editingUser.id, {
          full_name: fullName.trim(),
          role,
          phone: phone.trim() || null,
          unit_id: unitId || null,
        });
        setFeedback({ type: 'success', message: `User "${fullName}" updated successfully.` });
      } else {
        if (!email.trim()) throw new Error('Email is required');
        await DataService.createProfile({
          full_name: fullName.trim(),
          email: email.trim(),
          role,
          phone: phone.trim() || undefined,
          unit_id: unitId || null,
          password: password.trim() || undefined,
        });
        setFeedback({ type: 'success', message: `User "${fullName}" created/invited successfully.` });
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save user' });
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'admin':
        return { label: 'Admin', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'supervisor':
        return { label: 'Unit Head (View & Approve Only)', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'bd_executive':
        return { label: 'BD Executive', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.full_name.toLowerCase().includes(search.toLowerCase()) || 
                          (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
                          (u.phone || '').includes(search);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesUnit = unitFilter === 'all' || u.unit_id === unitFilter;
    return matchesSearch && matchesRole && matchesUnit;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <Users className="w-6 h-6 text-purple-600" />
            <span>User Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Create users, assign security roles, and map executives to hospital units
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs sm:text-sm hover:bg-purple-700 shadow-sm shadow-purple-500/20 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite / Add User</span>
        </button>
      </div>

      {feedback && (
        <div className={`mb-4 p-3.5 rounded-2xl flex items-center justify-between text-xs font-medium border ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 shadow-2xs"
          />
        </div>

        <div className="flex gap-2 sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 font-medium shadow-2xs cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="supervisor">Unit Head (View &amp; Approve Only)</option>
            <option value="bd_executive">BD Executive</option>
          </select>

          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 font-medium shadow-2xs cursor-pointer"
          >
            <option value="all">All Units</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-44 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700">No users match criteria</h3>
          <p className="text-xs text-slate-500 mt-1">Try resetting the filters or add a user.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((profile) => {
            const badge = getRoleBadge(profile.role);
            return (
              <div
                key={profile.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        {profile.full_name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                          {profile.full_name}
                        </h3>
                        <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => openEditModal(profile)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-purple-600 transition-colors cursor-pointer"
                      title="Edit User"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    {profile.email && (
                      <div className="flex items-center space-x-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{profile.email}</span>
                      </div>
                    )}
                    {profile.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{profile.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-800">
                        {profile.unit ? profile.unit.name : (profile.role === 'admin' ? 'All Units (Admin)' : 'No Unit Assigned')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invite / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingUser ? 'Edit User Details' : 'Invite / Create New User'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-3 min-h-[48px] bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-slate-900"
                />
              </div>

              {!editingUser && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="ramesh@hospital.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-3 min-h-[48px] bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Initial Password
                    </label>
                    <input
                      type="password"
                      placeholder="Set password (or leave blank for TempPass123!)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-3 min-h-[48px] bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-slate-900"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Minimum 6 characters. If left empty, default &quot;TempPass123!&quot; will be used.
                    </p>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  System Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-3 min-h-[48px] bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-slate-900 font-medium"
                >
                  <option value="bd_executive">BD Executive (Signs &amp; updates their assigned signage)</option>
                  <option value="supervisor">Unit Head (View &amp; Approve Only - Scoped to their unit)</option>
                  <option value="admin">Admin (Full administrative &amp; CRUD control)</option>
                </select>
              </div>

              {role !== 'admin' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Assigned Hospital Unit {role === 'supervisor' && <span className="text-rose-500">*</span>}
                    </label>
                    {role === 'supervisor' && (
                      <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        Scoped to 1 Unit
                      </span>
                    )}
                  </div>
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    required={role === 'supervisor'}
                    className="w-full px-3.5 py-3 min-h-[48px] bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-slate-900"
                  >
                    <option value="">No Unit Assigned</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.city})
                      </option>
                    ))}
                  </select>
                  {role === 'supervisor' && (
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      A Unit Head can only view signage, BD executives, and reports for this assigned unit.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-3 min-h-[48px] bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-slate-900"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                {/* Bottom-left: Delete User button (Only visible in edit mode for Admins) */}
                {editingUser && isAdmin ? (
                  <div className="flex flex-col items-start">
                    <button
                      type="button"
                      disabled={!canDelete || submitting || deletingUser}
                      onClick={() => {
                        setDeleteError(null);
                        setConfirmDeleteUser(editingUser);
                      }}
                      className="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title={
                        isSelf 
                          ? 'You cannot delete your own admin account' 
                          : isLastAdmin 
                          ? 'Cannot delete the last remaining admin' 
                          : 'Permanently remove this user'
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete User</span>
                    </button>
                    {isSelf && (
                      <span className="text-[10px] text-slate-400 mt-1 font-medium">Your account (cannot delete self)</span>
                    )}
                    {isLastAdmin && !isSelf && (
                      <span className="text-[10px] text-amber-600 mt-1 font-medium">Last remaining admin</span>
                    )}
                  </div>
                ) : (
                  <div />
                )}

                {/* Bottom-right: Cancel & Save actions */}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || deletingUser}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : editingUser ? 'Save Changes' : 'Invite User'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">
                Delete User: {confirmDeleteUser.full_name}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                {confirmDeleteUser.email || confirmDeleteUser.role}
              </p>
              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                This will permanently remove <strong>{confirmDeleteUser.full_name}</strong>&apos;s login access and unassign their signage. Their past inspection history will be kept for records. Continue?
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {deleteError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteUser(null)}
                disabled={deletingUser}
                className="min-h-[48px] py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={deletingUser}
                className="min-h-[48px] py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 flex items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {deletingUser ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
