'use client';

import React, { useState, useEffect } from 'react';
import { Area, Unit } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { 
  MapPin, Building2, Plus, Edit2, Trash2, 
  Search, Filter, X, AlertCircle, BookmarkCheck 
} from 'lucide-react';

export default function AdminAreasPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [name, setName] = useState('');
  const [unitId, setUnitId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [deletingArea, setDeletingArea] = useState<Area | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [areasData, unitsData] = await Promise.all([
        DataService.getAreas(),
        DataService.getUnits(),
      ]);
      setAreas(areasData);
      setUnits(unitsData);
      if (unitsData.length > 0 && !unitId) {
        setUnitId(unitsData[0].id);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load areas' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingArea(null);
    setName('');
    if (selectedUnitFilter !== 'all') {
      setUnitId(selectedUnitFilter);
    } else if (units.length > 0) {
      setUnitId(units[0].id);
    }
    setIsModalOpen(true);
    setFeedback(null);
  };

  const openEditModal = (area: Area) => {
    setEditingArea(area);
    setName(area.name);
    setUnitId(area.unit_id);
    setIsModalOpen(true);
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !unitId) return;

    setSubmitting(true);
    try {
      if (editingArea) {
        await DataService.updateArea(editingArea.id, unitId, name.trim());
        setFeedback({ type: 'success', message: `Area "${name}" updated successfully.` });
      } else {
        await DataService.createArea(unitId, name.trim());
        setFeedback({ type: 'success', message: `Area "${name}" created successfully.` });
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save area' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingArea) return;
    try {
      await DataService.deleteArea(deletingArea.id);
      setFeedback({ type: 'success', message: `Area "${deletingArea.name}" deleted.` });
      setDeletingArea(null);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete area' });
    }
  };

  const filteredAreas = areas.filter(a => {
    const matchesUnit = selectedUnitFilter === 'all' || a.unit_id === selectedUnitFilter;
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) || 
                          (a.unit?.name || '').toLowerCase().includes(search.toLowerCase());
    return matchesUnit && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <MapPin className="w-6 h-6 text-emerald-600" />
            <span>Geographical Areas</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Define localities and catchment zones linked to hospital units
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs sm:text-sm hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Area</span>
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search area name or unit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 shadow-2xs"
          />
        </div>

        <div className="sm:w-64">
          <select
            value={selectedUnitFilter}
            onChange={(e) => setSelectedUnitFilter(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium shadow-2xs cursor-pointer"
          >
            <option value="all">All Hospital Units ({units.length})</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Areas List */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
          ))}
        </div>
      ) : filteredAreas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700">No areas found</h3>
          <p className="text-xs text-slate-500 mt-1">Try another filter or create a new area.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAreas.map((area) => (
            <div
              key={area.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">{area.name}</h3>
                    <div className="flex items-center space-x-1 text-slate-500 text-xs mt-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate max-w-[160px]">{area.unit?.name || 'Unit'}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                    {area._count?.signages ?? 0} Signages
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2 mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => openEditModal(area)}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-emerald-600 transition-colors cursor-pointer"
                  title="Edit Area"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeletingArea(area)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Delete Area"
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
                {editingArea ? 'Edit Area' : 'Add New Area'}
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
                  Hospital Unit
                </label>
                <select
                  required
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Area Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Indiranagar 100ft Road"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
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
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingArea ? 'Save Changes' : 'Create Area'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete Area?</h3>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to delete <span className="font-semibold text-slate-800">{deletingArea.name}</span>?
            </p>

            <div className="flex items-center justify-end space-x-2 mt-6">
              <button
                type="button"
                onClick={() => setDeletingArea(null)}
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
