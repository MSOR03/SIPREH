'use client';

import { Calendar } from 'lucide-react';

export default function DateRangePicker({ startDate, endDate, onStartDateChange, onEndDateChange }) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Fecha Inicial
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-full px-4 py-2.5 bg-white dark:bg-[#1a1f2e] border-2 border-blue-200 dark:border-blue-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 transition-all duration-200 shadow-sm hover:border-blue-400 dark:hover:border-blue-600 cursor-pointer scheme-light dark:scheme-dark"
        />
      </div>
      
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Fecha Final
        </label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-full px-4 py-2.5 bg-white dark:bg-[#1a1f2e] border-2 border-blue-200 dark:border-blue-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 transition-all duration-200 shadow-sm hover:border-blue-400 dark:hover:border-blue-600 cursor-pointer scheme-light dark:scheme-dark"
        />
      </div>
    </div>
  );
}
