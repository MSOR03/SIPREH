'use client';

export default function Select({ label, options, value, onChange, placeholder }) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 bg-white dark:bg-[#1a1f2e] border-2 border-blue-200 dark:border-blue-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 transition-all duration-200 shadow-sm hover:border-blue-400 dark:hover:border-blue-600 cursor-pointer"
      >
        <option value="" className="bg-white dark:bg-[#1a1f2e] text-gray-900 dark:text-gray-100">{placeholder || 'Seleccionar...'}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-white dark:bg-[#1a1f2e] text-gray-900 dark:text-gray-100">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
