'use client';

import React, { useState, useEffect } from 'react';
import { AppSettings } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { 
  Settings, Calendar, Bell, Save, CheckCircle2, 
  AlertCircle, ShieldCheck, Clock, X 
} from 'lucide-react';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    deadline_day: 25,
    reminder_days: [20, 28],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form inputs
  const [deadlineDay, setDeadlineDay] = useState<number>(25);
  const [firstReminderDay, setFirstReminderDay] = useState<number>(20);
  const [secondReminderDay, setSecondReminderDay] = useState<number>(28);

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const data = await DataService.getSettings();
        setSettings(data);
        setDeadlineDay(data.deadline_day);
        if (data.reminder_days && data.reminder_days.length >= 2) {
          setFirstReminderDay(data.reminder_days[0]);
          setSecondReminderDay(data.reminder_days[1]);
        }
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'Failed to load settings' });
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const updated: AppSettings = {
        deadline_day: Number(deadlineDay),
        reminder_days: [Number(firstReminderDay), Number(secondReminderDay)],
      };
      await DataService.updateSettings(updated);
      setSettings(updated);
      setFeedback({ type: 'success', message: 'Compliance and reminder settings saved successfully.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
          <Settings className="w-6 h-6 text-cyan-600" />
          <span>App Compliance & Notification Settings</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Configure monthly photo verification deadlines and automated escalation schedules
        </p>
      </div>

      {feedback && (
        <div className={`mb-6 p-4 rounded-2xl flex items-center justify-between text-xs font-medium border ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="h-64 rounded-3xl bg-slate-100 animate-pulse border border-slate-200" />
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Monthly Deadline */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">Monthly Verification Deadline</h3>
                <p className="text-xs text-slate-500">Day of the month when monthly signage verification is due</p>
              </div>
            </div>

            <div className="max-w-xs">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Deadline Day of Month (1 - 28)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={28}
                  required
                  value={deadlineDay}
                  onChange={(e) => setDeadlineDay(parseInt(e.target.value) || 25)}
                  className="w-full px-4 py-3 min-h-[48px] bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
                />
                <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-semibold text-slate-400 pointer-events-none">
                  th of every month
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Signages pending verification after the {deadlineDay}th are marked as <span className="font-bold text-rose-600">Overdue</span>.
              </p>
            </div>
          </div>

          {/* Section 2: Automated Reminders Schedule */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">Automated Reminders & Escalations</h3>
                <p className="text-xs text-slate-500">Schedule daily automated triggers via Supabase Edge Function / pg_cron</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pre-Deadline Executive Reminder Day
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={27}
                    required
                    value={firstReminderDay}
                    onChange={(e) => setFirstReminderDay(parseInt(e.target.value) || 20)}
                    className="w-full px-4 py-3 min-h-[48px] bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-semibold text-slate-400 pointer-events-none">
                    th of month
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Sends friendly email + in-app notification to BD executives with pending items.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Post-Deadline Supervisor Escalation Day
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={secondReminderDay}
                    onChange={(e) => setSecondReminderDay(parseInt(e.target.value) || 28)}
                    className="w-full px-4 py-3 min-h-[48px] bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-semibold text-slate-400 pointer-events-none">
                    th of month
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Escalates overdue unit & area lists directly to unit supervisors and management.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Policy Summary */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-3xl p-6 text-white shadow-md">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Active Compliance Rules Summary</span>
            </h4>
            <ul className="mt-3 space-y-2 text-xs text-slate-300">
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <span>Executive camera captures verify live GPS. Flags distance &gt; 200m as mismatch.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <span>One update per signage per month (same-day replacement permitted).</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <span>Damaged or Missing conditions instantly notify admins.</span>
              </li>
            </ul>
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 min-h-[48px] rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm shadow-md shadow-cyan-600/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Settings...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
