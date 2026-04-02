'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function CollapsiblePanel({ icon: Icon, title, subtitle, color, open, onToggle, children }) {
  const colorMap = {
    blue: {
      border: 'border-blue-500 dark:border-blue-400',
      glow: 'bg-blue-500/10 dark:bg-blue-400/10',
      iconBg: 'from-blue-500 to-blue-600',
      dot: 'bg-blue-500',
      chevron: open ? 'text-blue-400' : 'text-gray-400 dark:text-gray-500',
    },
    green: {
      border: 'border-green-500 dark:border-green-400',
      glow: 'bg-green-500/10 dark:bg-green-400/10',
      iconBg: 'from-green-500 to-green-600',
      dot: 'bg-green-500',
      chevron: open ? 'text-green-400' : 'text-gray-400 dark:text-gray-500',
    },
    purple: {
      border: 'border-purple-500 dark:border-purple-400',
      glow: 'bg-purple-500/10 dark:bg-purple-400/10',
      iconBg: 'from-purple-500 to-purple-600',
      dot: 'bg-purple-500',
      chevron: open ? 'text-purple-400' : 'text-gray-400 dark:text-gray-500',
    },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className="animate-fade-in">
      <button
        type="button"
        onClick={onToggle}
        className={`relative flex items-center gap-3 w-full text-left mb-3 pb-3 border-b-2 ${c.border} group`}
      >
        <div className={`absolute -left-2 -right-2 -top-1 -bottom-1 ${c.glow} rounded-lg blur-sm`} />
        <div className={`relative p-2 bg-gradient-to-br ${c.iconBg} rounded-xl shadow-lg`}>
          <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <div className="relative flex-1">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h2>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 ${c.dot} rounded-full animate-pulse`} />
            {subtitle}
          </p>
        </div>
        <ChevronDown className={`relative w-5 h-5 ${c.chevron} transition-transform duration-300 ${open ? '' : '-rotate-90'}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-400 ease-in-out ${open ? 'max-h-[2200px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {children}
      </div>
    </div>
  );
}

export function StepSection({ step, title, children, color = 'blue', collapsible = false, defaultOpen = true }) {
  const badgeColors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
  };
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const contentVisible = collapsible ? isOpen : true;

  return (
    <div className="relative">
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br ${badgeColors[color] || badgeColors.blue} text-[10px] font-bold text-white shadow-sm shrink-0`}>
          {step}
        </span>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <span>{title}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${contentVisible ? '' : '-rotate-90'}`} />
          </button>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {title}
          </span>
        )}
        <div className="flex-1 h-px bg-gradient-to-r from-gray-300 dark:from-gray-600 to-transparent" />
      </div>
      <div className={`pl-1 overflow-hidden transition-all duration-300 ${contentVisible ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {children}
      </div>
    </div>
  );
}

export function RadioOption({ name, value, checked, onChange, label, description, icon: Icon }) {
  return (
    <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${
      checked
        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-500 shadow-sm'
        : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
    }`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      {Icon && (
        <div className={`p-1.5 rounded-lg shrink-0 ${
          checked
            ? 'bg-blue-100 dark:bg-blue-800/40 text-blue-600 dark:text-blue-400'
            : 'bg-gray-100 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500'
        }`}>
          <Icon className="w-4 h-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-semibold block ${
          checked ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
        }`}>{label}</span>
        {description && (
          <span className={`text-[10px] block mt-0.5 leading-tight ${
            checked ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
          }`}>{description}</span>
        )}
      </div>
      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
        checked ? 'border-blue-500 dark:border-blue-400' : 'border-gray-300 dark:border-gray-600'
      }`}>
        {checked && <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />}
      </div>
    </label>
  );
}

export function RadioCard({ name, value, checked, onChange, label, badge }) {
  return (
    <label className={`flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer transition-all border-2 text-center ${
      checked
        ? 'bg-blue-50 dark:bg-blue-900/25 border-blue-500 dark:border-blue-400 shadow-sm'
        : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
    }`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="sr-only" />
      <span className={`text-sm font-bold ${checked ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>{label}</span>
      {badge && (
        <span className={`text-[10px] font-semibold mt-1 px-2 py-0.5 rounded-full ${
          checked
            ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
        }`}>{badge}</span>
      )}
    </label>
  );
}
