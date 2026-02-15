import { describe, it, expect } from 'vitest';
import { generateId } from './id';

describe('id', () => {
  describe('generateId', () => {
    it('should generate a string', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
    });

    it('should generate UUID v4 format', () => {
      const id = generateId();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      // where y is one of [8, 9, a, b]
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidV4Regex);
    });

    it('should have correct length (36 characters including hyphens)', () => {
      const id = generateId();
      expect(id).toHaveLength(36);
    });

    it('should have hyphens in correct positions', () => {
      const id = generateId();
      expect(id[8]).toBe('-');
      expect(id[13]).toBe('-');
      expect(id[18]).toBe('-');
      expect(id[23]).toBe('-');
    });

    it('should have "4" in the version position (index 14)', () => {
      const id = generateId();
      expect(id[14]).toBe('4');
    });

    it('should have correct variant bits (8, 9, a, or b at index 19)', () => {
      const id = generateId();
      const variantChar = id[19].toLowerCase();
      expect(['8', '9', 'a', 'b']).toContain(variantChar);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      const count = 1000;

      for (let i = 0; i < count; i++) {
        ids.add(generateId());
      }

      // All IDs should be unique
      expect(ids.size).toBe(count);
    });

    it('should only contain valid hexadecimal characters and hyphens', () => {
      const id = generateId();
      const validCharsRegex = /^[0-9a-f-]+$/i;
      expect(id).toMatch(validCharsRegex);
    });

    it('should generate different IDs on consecutive calls', () => {
      const id1 = generateId();
      const id2 = generateId();
      const id3 = generateId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should handle many generations without collision', () => {
      const iterations = 100;
      const ids: string[] = [];

      for (let i = 0; i < iterations; i++) {
        ids.push(generateId());
      }

      // Check no duplicates
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(iterations);
    });
  });
});
