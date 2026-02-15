// src/components/CustomDateRangePicker.tsx

import { useState } from 'react';
import type { CustomDateRange } from '../types';

interface CustomDateRangePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (range: CustomDateRange) => void;
  currentRange?: CustomDateRange;
}

export function CustomDateRangePicker({
  isOpen,
  onClose,
  onApply,
  currentRange,
}: CustomDateRangePickerProps) {
  const [startDate, setStartDate] = useState<string>(() => {
    if (currentRange) {
      return currentRange.startDate.toISOString().slice(0, 16);
    }
    return new Date().toISOString().slice(0, 16);
  });

  const [endDate, setEndDate] = useState<string>(() => {
    if (currentRange) {
      return currentRange.endDate.toISOString().slice(0, 16);
    }
    const end = new Date();
    end.setDate(end.getDate() + 7);
    return end.toISOString().slice(0, 16);
  });

  const [error, setError] = useState<string | null>(null);

  const handleApply = (): void => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      setError('Start date must be before end date');
      return;
    }

    const diffMs = end.getTime() - start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays > 365) {
      setError('Date range cannot exceed 365 days');
      return;
    }

    onApply({ startDate: start, endDate: end });
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            Custom Date Range
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Start Date & Time
            </label>
            <input
              id="startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
            />
          </div>

          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              End Date & Time
            </label>
            <input
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
