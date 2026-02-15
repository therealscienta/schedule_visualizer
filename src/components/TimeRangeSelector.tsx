// src/components/TimeRangeSelector.tsx

import type { TimeRange } from '../types';
import { TIME_RANGE_CONFIGS } from '../types';

interface TimeRangeSelectorProps {
  selectedRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  onCustomClick?: () => void;
}

export function TimeRangeSelector({ selectedRange, onRangeChange, onCustomClick }: TimeRangeSelectorProps) {
  const handleRangeClick = (range: TimeRange): void => {
    if (range === 'custom' && onCustomClick) {
      onCustomClick();
    } else {
      onRangeChange(range);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(TIME_RANGE_CONFIGS) as TimeRange[]).map((range) => (
        <button
          key={range}
          onClick={() => handleRangeClick(range)}
          className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedRange === range
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'
          }`}
        >
          {TIME_RANGE_CONFIGS[range].label}
        </button>
      ))}
    </div>
  );
}
