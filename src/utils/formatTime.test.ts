import { describe, it, expect } from 'vitest';
import { formatTimestamp } from './formatTime';

describe('formatTime', () => {
  describe('formatTimestamp', () => {
    const testDate = new Date('2024-01-15T14:30:00Z');

    it('should format with 12-hour time format', () => {
      const result = formatTimestamp(testDate, '12h');
      // Format: "Jan 15, 02:30 PM" (may vary based on locale)
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toMatch(/\d{2}:\d{2}/); // Should contain time
    });

    it('should format with 24-hour time format', () => {
      const result = formatTimestamp(testDate, '24h');
      // Format: "Jan 15, 14:30" (may vary based on locale)
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toMatch(/\d{2}:\d{2}/); // Should contain time
    });

    it('should include month abbreviation', () => {
      const result = formatTimestamp(testDate, '24h');
      expect(result).toContain('Jan');
    });

    it('should include day of month', () => {
      const result = formatTimestamp(testDate, '24h');
      expect(result).toContain('15');
    });

    it('should include hours and minutes', () => {
      const result = formatTimestamp(testDate, '24h');
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it('should format midnight correctly in 12h format', () => {
      const midnight = new Date(2024, 0, 15, 0, 0, 0); // local midnight
      const result = formatTimestamp(midnight, '12h');
      expect(result).toMatch(/12:00/);
    });

    it('should format midnight correctly in 24h format', () => {
      const midnight = new Date(2024, 0, 15, 0, 0, 0); // local midnight
      const result = formatTimestamp(midnight, '24h');
      expect(result).toMatch(/00:00|24:00/);
    });

    it('should format noon correctly', () => {
      const noon = new Date(2024, 0, 15, 12, 0, 0); // local noon
      const result12h = formatTimestamp(noon, '12h');
      const result24h = formatTimestamp(noon, '24h');

      expect(result12h).toMatch(/12:00/);
      expect(result24h).toMatch(/12:00/);
    });

    it('should handle different months', () => {
      const feb = new Date('2024-02-01T10:00:00Z');
      const jul = new Date('2024-07-01T10:00:00Z');
      const dec = new Date('2024-12-01T10:00:00Z');

      expect(formatTimestamp(feb, '24h')).toContain('Feb');
      expect(formatTimestamp(jul, '24h')).toContain('Jul');
      expect(formatTimestamp(dec, '24h')).toContain('Dec');
    });

    it('should handle single-digit days', () => {
      const singleDigitDay = new Date('2024-01-05T10:00:00Z');
      const result = formatTimestamp(singleDigitDay, '24h');
      expect(result).toMatch(/\b5\b/);
    });

    it('should handle different times of day', () => {
      const morning = new Date('2024-01-15T08:30:00Z');
      const afternoon = new Date('2024-01-15T15:45:00Z');
      const evening = new Date('2024-01-15T20:00:00Z');

      const morningResult = formatTimestamp(morning, '24h');
      const afternoonResult = formatTimestamp(afternoon, '24h');
      const eveningResult = formatTimestamp(evening, '24h');

      expect(morningResult).toBeTruthy();
      expect(afternoonResult).toBeTruthy();
      expect(eveningResult).toBeTruthy();
    });
  });
});
