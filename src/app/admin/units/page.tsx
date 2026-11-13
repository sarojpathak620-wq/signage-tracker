'use client';

import React, { useState, useEffect } from 'react';
import { Unit } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { 
  Building2, Plus, Edit2, Trash2, Search, 
  MapPin, BookmarkCheck, AlertCircle, X, Check 
} from 'lucide-react';

export default function AdminUnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Delete modal
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const data = await DataService.getUnits();
      setUnits(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load units' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnits();
  }, []);

  const openCreateModal = () => {
    setEditingUnit(null);
    setName('');
    setCity('');
    setIsModalOpen(true);
    setFeedback(null);
  };

  const openEditModal = (unit: Unit) => {
    setEditingUnit(unit);
    setName(unit.name);
    setCity(unit.city);
    setIsModalOpen(true);
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !city.trim()) return;

    setSubmitting(true);
    try {
      if (editingUnit) {
        await DataService.updateUnit(editingUnit.id, name.trim(), city.trim());
        setFeedback({ type: 'success', message: `Unit "${name}" updated successfully.` });
      } else {
        await DataService.createUnit(name.trim(), city.trim());
        setFeedback({ type: 'success', message: `Unit "${name}" created successfully.` });
      }
      setIsModalOpen(false);
      await loadUnits();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save unit' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUnit) return;
    try {
      await DataService.deleteUnit(deletingUnit.id);
      setFeedback({ type: 'success', message: `Unit "${deletingUnit.name}" deleted.` });
      setDeletingUnit(null);
      await loadUnits();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete unit' });
    }
  };

  const filteredUnits = units.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            <span>Hospital Units</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage hospital branches and coverage locations across cities
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs sm:text-sm hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Unit</span>
        </button>
      </div>

      {/* Notifications / Toast */}
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

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search unit by name or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 shadow-2xs"
          />
        </div>
      </div>

      {/* Units List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
          ))}
        </div>
      ) : filteredUnits.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700">No units found</h3>
          <p className="text-xs text-slate-500 mt-1">Get started by creating your first hospital unit.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUnits.map((unit) => (
            <div
              key={unit.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{unit.name}</h3>
                    <div className="flex items-center space-x-1 text-slate-500 text-xs mt-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-500" />
                      <span>{unit.city}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                    Active
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
                  <div className="bg-slate-50 p-2.5 rounded-xl">
                    <span className="block text-base font-extrabold text-slate-800">
                      {unit._count?.areas ?? 0}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">Areas</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl">
                    <span className="block text-base font-extrabold text-slate-800">
                      {unit._count?.signages ?? 0}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">Signages</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2 mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => openEditModal(unit)}
                  className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition-colors cursor-pointer"
                  title="Edit Unit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeletingUnit(unit)}
                  className="p-2 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Delete Unit"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingUnit ? 'Edit Hospital Unit' : 'Add New Hospital Unit'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Unit Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. City Hospital Central"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bangalore"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingUnit ? 'Save Changes' : 'Create Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete Unit?</h3>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to delete <span className="font-semibold text-slate-800">{deletingUnit.name}</span>? 
              This will also remove associated areas and signage records.
            </p>

            <div className="flex items-center justify-end space-x-2 mt-6">
              <button
                type="button"
                onClick={() => setDeletingUnit(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
