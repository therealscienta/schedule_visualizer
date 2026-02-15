import { describe, it, expect } from 'vitest';
import { SCHEDULE_COLORS, getColorForIndex } from './colors';

describe('colors', () => {
  describe('SCHEDULE_COLORS', () => {
    it('should have 10 distinct colors', () => {
      expect(SCHEDULE_COLORS).toHaveLength(10);
    });

    it('should contain valid hex color codes', () => {
      SCHEDULE_COLORS.forEach((color) => {
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });

    it('should have unique colors', () => {
      const uniqueColors = new Set(SCHEDULE_COLORS);
      expect(uniqueColors.size).toBe(SCHEDULE_COLORS.length);
    });
  });

  describe('getColorForIndex', () => {
    it('should return first color for index 0', () => {
      expect(getColorForIndex(0)).toBe(SCHEDULE_COLORS[0]);
    });

    it('should return second color for index 1', () => {
      expect(getColorForIndex(1)).toBe(SCHEDULE_COLORS[1]);
    });

    it('should return last color for last index', () => {
      const lastIndex = SCHEDULE_COLORS.length - 1;
      expect(getColorForIndex(lastIndex)).toBe(SCHEDULE_COLORS[lastIndex]);
    });

    it('should cycle back to first color after array length', () => {
      expect(getColorForIndex(10)).toBe(SCHEDULE_COLORS[0]);
      expect(getColorForIndex(11)).toBe(SCHEDULE_COLORS[1]);
    });

    it('should handle large indices with modulo', () => {
      expect(getColorForIndex(20)).toBe(SCHEDULE_COLORS[0]);
      expect(getColorForIndex(25)).toBe(SCHEDULE_COLORS[5]);
      expect(getColorForIndex(99)).toBe(SCHEDULE_COLORS[9]);
    });

    it('should handle negative indices gracefully', () => {
      // JavaScript modulo with negative numbers
      const result = getColorForIndex(-1);
      expect(SCHEDULE_COLORS).toContain(result);
    });
  });
});
