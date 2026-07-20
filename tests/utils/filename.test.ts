import { describe, it, expect } from 'vitest';
import {
  generateVersionedFilename,
  formatTimestampForFilename,
  getLanguageExtension,
  sanitizeSlug,
  buildProblemFolder,
  buildSubmissionPath,
  buildManifestPath,
  difficultyBadge,
  formatDateForDisplay,
} from '../../src/utils/filename';

describe('generateVersionedFilename', () => {
  it('creates a correctly formatted filename', () => {
    const result = generateVersionedFilename(
      1,
      '2026-07-18T14:32:00Z',
      'Accepted',
      'python3'
    );
    expect(result).toBe('v1_2026-07-18T14-32-00_accepted.py');
  });

  it('handles version numbers > 1', () => {
    const result = generateVersionedFilename(
      5,
      '2026-07-20T09:10:11.123Z',
      'Accepted',
      'java'
    );
    expect(result).toBe('v5_2026-07-20T09-10-11_accepted.java');
  });

  it('handles multi-word status', () => {
    const result = generateVersionedFilename(
      1,
      '2026-07-18T14:32:00Z',
      'Wrong Answer',
      'cpp'
    );
    expect(result).toBe('v1_2026-07-18T14-32-00_wrong-answer.cpp');
  });

  it('falls back to .txt for unknown languages', () => {
    const result = generateVersionedFilename(1, '2026-07-18T14:32:00Z', 'Accepted', 'brainfuck');
    expect(result).toMatch(/\.txt$/);
  });
});

describe('formatTimestampForFilename', () => {
  it('replaces colons with hyphens', () => {
    expect(formatTimestampForFilename('2026-07-18T14:32:00Z')).toBe('2026-07-18T14-32-00');
  });

  it('strips milliseconds', () => {
    expect(formatTimestampForFilename('2026-07-18T14:32:00.123Z')).toBe('2026-07-18T14-32-00');
  });
});

describe('getLanguageExtension', () => {
  it('maps python3 to .py', () => {
    expect(getLanguageExtension('python3')).toBe('.py');
  });

  it('maps java to .java', () => {
    expect(getLanguageExtension('java')).toBe('.java');
  });

  it('maps cpp to .cpp', () => {
    expect(getLanguageExtension('cpp')).toBe('.cpp');
  });

  it('is case-insensitive', () => {
    expect(getLanguageExtension('Python3')).toBe('.py');
    expect(getLanguageExtension('JAVA')).toBe('.java');
  });

  it('returns .txt for unknown languages', () => {
    expect(getLanguageExtension('unknown')).toBe('.txt');
  });
});

describe('sanitizeSlug', () => {
  it('converts title to kebab-case', () => {
    expect(sanitizeSlug('Two Sum')).toBe('two-sum');
  });

  it('handles numbers', () => {
    expect(sanitizeSlug('3Sum Closest')).toBe('3sum-closest');
  });

  it('removes special characters', () => {
    expect(sanitizeSlug("Valid Parentheses ()")).toBe('valid-parentheses');
  });

  it('collapses multiple hyphens', () => {
    expect(sanitizeSlug('  Two   Sum  ')).toBe('two-sum');
  });
});

describe('buildProblemFolder', () => {
  it('pads the number to 4 digits', () => {
    expect(buildProblemFolder(1, 'two-sum')).toBe('0001-two-sum');
    expect(buildProblemFolder(42, 'trapping-rain-water')).toBe('0042-trapping-rain-water');
    expect(buildProblemFolder(1234, 'some-problem')).toBe('1234-some-problem');
  });
});

describe('buildSubmissionPath', () => {
  it('builds the full path', () => {
    const path = buildSubmissionPath(1, 'two-sum', 'python3', 'v1_2026-07-18T14-32-00_accepted.py');
    expect(path).toBe('problems/0001-two-sum/python/v1_2026-07-18T14-32-00_accepted.py');
  });
});

describe('buildManifestPath', () => {
  it('builds the manifest path', () => {
    expect(buildManifestPath(1, 'two-sum')).toBe('problems/0001-two-sum/manifest.json');
  });
});

describe('difficultyBadge', () => {
  it('returns correct emojis', () => {
    expect(difficultyBadge('Easy')).toBe('🟢');
    expect(difficultyBadge('Medium')).toBe('🟡');
    expect(difficultyBadge('Hard')).toBe('🔴');
    expect(difficultyBadge('Unknown')).toBe('⚪');
  });
});

describe('formatDateForDisplay', () => {
  it('extracts the date portion', () => {
    expect(formatDateForDisplay('2026-07-18T14:32:00Z')).toBe('2026-07-18');
  });
});
