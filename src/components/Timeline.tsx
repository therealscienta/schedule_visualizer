// src/components/Timeline.tsx

import { useMemo, useState, useRef } from 'react';
import type { Schedule, Project, TimeRange, CustomDateRange } from '../types';
import { TIME_RANGE_CONFIGS } from '../types';
import { generateExecutions, detectOverlaps } from '../utils/cronParser';
import { useSettings } from '../contexts/SettingsContext';
import { formatTimestamp } from '../utils/formatTime';
import { StatisticsPanel } from './StatisticsPanel';
import { ExportMenu } from './ExportMenu';

interface TimelineProps {
  schedules: Schedule[];
  projects?: Project[];
  timeRange: TimeRange;
  customDateRange?: CustomDateRange | null;
}

export function Timeline({ schedules, projects = [], timeRange, customDateRange }: TimelineProps) {
  const { timeFormat, timelineMode } = useSettings();
  const [showStats, setShowStats] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = (): void => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = (): void => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = (): void => {
    setZoomLevel(1);
  };

  const startDate = useMemo(() => {
    if (timeRange === 'custom' && customDateRange) {
      return customDateRange.startDate;
    }
    return new Date();
  }, [timeRange, customDateRange]);

  const endDate = useMemo(() => {
    if (timeRange === 'custom' && customDateRange) {
      return customDateRange.endDate;
    }
    const config = TIME_RANGE_CONFIGS[timeRange];
    return new Date(startDate.getTime() + config.hours * 60 * 60 * 1000);
  }, [timeRange, customDateRange, startDate]);

  const hours = useMemo(() => {
    const diffMs = endDate.getTime() - startDate.getTime();
    return diffMs / (1000 * 60 * 60);
  }, [startDate, endDate]);

  const { executions, overlaps } = useMemo(() => {
    const execs = generateExecutions(schedules, startDate, hours);
    const overlaps = detectOverlaps(execs);
    return { executions: execs, overlaps };
  }, [schedules, startDate, hours]);

  if (schedules.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">Timeline</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center py-12">
          Add schedules to see the timeline visualization
        </p>
      </div>
    );
  }

  const totalDuration = endDate.getTime() - startDate.getTime();

  const getTimelinePosition = (timestamp: Date): number => {
    const elapsed = timestamp.getTime() - startDate.getTime();
    return (elapsed / totalDuration) * 100;
  };

  const getBarWidth = (start: Date, end: Date): number => {
    const duration = end.getTime() - start.getTime();
    if (duration === 0) return 0;
    const widthPct = (duration / totalDuration) * 100;
    return Math.max(widthPct, 0.15);
  };

  const fmt = (date: Date): string => formatTimestamp(date, timeFormat);

  const getTimeMarkers = (): Date[] => {
    const markers: Date[] = [];
    const markerCount = Math.min(10, Math.ceil(hours / 24));
    const interval = hours / markerCount;

    for (let i = 0; i <= markerCount; i++) {
      markers.push(new Date(startDate.getTime() + i * interval * 60 * 60 * 1000));
    }

    return markers;
  };

  const getTooltipAlignment = (position: number): string => {
    if (position < 10) return 'left-0';
    if (position > 90) return 'right-0';
    return 'left-1/2 -translate-x-1/2';
  };

  const timeMarkers = getTimeMarkers();

  return (
    <>
      {showStats && (
        <div className="mb-6">
          <StatisticsPanel
            executions={executions}
            overlaps={overlaps}
            startDate={startDate}
            endDate={endDate}
          />
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6" ref={timelineRef}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Timeline</h2>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <button
              onClick={() => setShowStats(!showStats)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showStats ? 'Hide' : 'Show'} Statistics
            </button>
            <div className="flex items-center gap-1 sm:gap-2 border border-gray-300 dark:border-gray-600 rounded-lg p-1">
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                className="px-1 sm:px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom out"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>
              <span className="text-xs text-gray-600 dark:text-gray-400 font-mono min-w-[2.5rem] sm:min-w-[3rem] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                className="px-1 sm:px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom in"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </button>
              {zoomLevel !== 1 && (
                <button
                  onClick={handleResetZoom}
                  className="px-1 sm:px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  title="Reset zoom"
                >
                  Reset
                </button>
              )}
            </div>
            <ExportMenu timelineRef={timelineRef} schedules={schedules} projects={projects} />
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 w-full sm:w-auto text-center sm:text-left">
              {fmt(startDate)} - {fmt(endDate)}
            </div>
          </div>
        </div>

      <div className="space-y-6 overflow-x-auto" style={{ transform: `scaleX(${zoomLevel})`, transformOrigin: 'left center', transition: 'transform 0.2s ease' }}>
        {/* Time axis */}
        <div className="relative h-8 border-b-2 border-gray-300 dark:border-gray-600">
          {timeMarkers.map((marker, idx) => {
            const position = getTimelinePosition(marker);
            const alignClass =
              idx === 0
                ? 'translate-x-0'
                : idx === timeMarkers.length - 1
                  ? '-translate-x-full'
                  : '-translate-x-1/2';
            return (
              <div
                key={idx}
                className="absolute top-0 h-full"
                style={{ left: `${position}%` }}
              >
                <div className="w-px h-full bg-gray-300 dark:bg-gray-600" />
                <div className={`absolute top-full mt-1 text-xs text-gray-600 dark:text-gray-400 ${alignClass} whitespace-nowrap`}>
                  {fmt(marker)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Schedule rows */}
        <div className="space-y-4 mt-12">
          {timelineMode === 'multi' ? (
            // Multi-lane: one row per schedule
            schedules.map((schedule) => {
              const scheduleExecutions = executions.filter(
                (exec) => exec.scheduleId === schedule.id
              );

              return (
                <div key={schedule.id} className="relative">
                  <div className="flex items-center mb-2">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: schedule.color }}
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
                      {schedule.label}
                    </span>
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      ({scheduleExecutions.length} executions)
                    </span>
                  </div>

                  <div className="relative h-12 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                    {scheduleExecutions.map((execution, idx) => {
                      const position = getTimelinePosition(execution.timestamp);
                      const hasDuration = execution.endTimestamp.getTime() > execution.timestamp.getTime();
                      const width = hasDuration ? getBarWidth(execution.timestamp, execution.endTimestamp) : 0;

                      return hasDuration ? (
                        <div
                          key={idx}
                          className="absolute top-1/2 -translate-y-1/2 h-8 rounded-sm cursor-pointer hover:opacity-80 transition-opacity group"
                          style={{
                            left: `${position}%`,
                            width: `${width}%`,
                            minWidth: '3px',
                            backgroundColor: schedule.color,
                          }}
                        >
                          <div className={`absolute bottom-full mb-2 ${getTooltipAlignment(position)} hidden group-hover:block z-10`}>
                            <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                              {fmt(execution.timestamp)} – {fmt(execution.endTimestamp)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={idx}
                          className="absolute top-1/2 -translate-y-1/2 w-2 h-8 rounded-sm cursor-pointer hover:scale-125 transition-transform group"
                          style={{ left: `${position}%`, backgroundColor: schedule.color }}
                        >
                          <div className={`absolute bottom-full mb-2 ${getTooltipAlignment(position)} hidden group-hover:block z-10`}>
                            <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                              {fmt(execution.timestamp)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            // Single-lane: all executions merged into one row
            <div className="relative">
              <div className="flex items-center mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  All Schedules
                </span>
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  ({executions.length} executions)
                </span>
              </div>

              <div className="relative h-16 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                {executions.map((execution, idx) => {
                  const position = getTimelinePosition(execution.timestamp);
                  const hasDuration = execution.endTimestamp.getTime() > execution.timestamp.getTime();
                  const width = hasDuration ? getBarWidth(execution.timestamp, execution.endTimestamp) : 0;

                  return hasDuration ? (
                    <div
                      key={idx}
                      className="absolute top-1/2 -translate-y-1/2 h-10 rounded-sm cursor-pointer hover:opacity-100 transition-opacity group"
                      style={{
                        left: `${position}%`,
                        width: `${width}%`,
                        minWidth: '3px',
                        backgroundColor: execution.color,
                        opacity: 0.7,
                      }}
                    >
                      <div className={`absolute bottom-full mb-2 ${getTooltipAlignment(position)} hidden group-hover:block z-10`}>
                        <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                          <span className="font-medium">{execution.label}</span>
                          <br />
                          {fmt(execution.timestamp)} – {fmt(execution.endTimestamp)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={idx}
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-10 rounded-sm cursor-pointer hover:scale-125 transition-transform group"
                      style={{ left: `${position}%`, backgroundColor: execution.color, opacity: 0.7 }}
                    >
                      <div className={`absolute bottom-full mb-2 ${getTooltipAlignment(position)} hidden group-hover:block z-10`}>
                        <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                          <span className="font-medium">{execution.label}</span>
                          <br />
                          {fmt(execution.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-3">
                {schedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: schedule.color }}
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {schedule.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overlap row */}
          {overlaps.length > 0 && (
            <div className="relative mt-8 pt-4 border-t-2 border-gray-300 dark:border-gray-600">
              <div className="flex items-center mb-2">
                <div className="w-3 h-3 rounded-full mr-2 bg-red-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Overlaps
                </span>
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  ({overlaps.length} conflicts)
                </span>
              </div>

              <div className="relative h-12 bg-red-50 dark:bg-red-900/20 rounded border-2 border-red-200 dark:border-red-800 overflow-visible">
                {overlaps.map((overlap, idx) => {
                  const position = getTimelinePosition(overlap.startTimestamp);
                  const hasDuration = overlap.endTimestamp.getTime() > overlap.startTimestamp.getTime();
                  const width = hasDuration ? getBarWidth(overlap.startTimestamp, overlap.endTimestamp) : 0;

                  return hasDuration ? (
                    <div
                      key={idx}
                      className="absolute top-1/2 -translate-y-1/2 h-10 bg-red-600 rounded-sm cursor-pointer hover:opacity-80 transition-opacity group overflow-visible"
                      style={{
                        left: `${position}%`,
                        width: `${width}%`,
                        minWidth: '4px',
                      }}
                    >
                      <div className="absolute -top-1 -right-1 z-10 bg-white dark:bg-gray-800 text-red-600 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center border border-red-600">
                        {overlap.count}
                      </div>
                      <div className={`absolute bottom-full mb-2 ${getTooltipAlignment(position)} hidden group-hover:block z-10`}>
                        <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                          {fmt(overlap.startTimestamp)} – {fmt(overlap.endTimestamp)}
                          <br />
                          {overlap.count} schedules
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={idx}
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-10 bg-red-600 rounded-sm cursor-pointer hover:scale-125 transition-transform group overflow-visible"
                      style={{ left: `${position}%` }}
                    >
                      <div className="absolute -top-1 -right-1 z-10 bg-white dark:bg-gray-800 text-red-600 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center border border-red-600">
                        {overlap.count}
                      </div>
                      <div className={`absolute bottom-full mb-2 ${getTooltipAlignment(position)} hidden group-hover:block z-10`}>
                        <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                          {fmt(overlap.startTimestamp)}
                          <br />
                          {overlap.count} schedules
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

        {executions.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No executions in the selected time range
          </div>
        )}
      </div>
    </>
  );
}
