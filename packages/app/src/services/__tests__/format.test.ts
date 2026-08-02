import { describe, it, expect } from 'vitest';
import { formatDuration, formatNumber, formatScore, formatDate } from '../format';

describe('formatDuration', () => {
  it('returns "< 1m" for zero or negative', () => {
    expect(formatDuration(0)).toBe('< 1m');
    expect(formatDuration(-100)).toBe('< 1m');
    expect(formatDuration(Number.NaN)).toBe('< 1m');
  });
  it('formats seconds only', () => {
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(5_000)).toBe('5s');
  });
  it('formats minutes and seconds', () => {
    expect(formatDuration(90_000)).toBe('1m 30s');
    expect(formatDuration(3 * 60_000)).toBe('3m 0s');
  });
  it('formats hours and minutes', () => {
    expect(formatDuration(60 * 60_000)).toBe('1h 0m');
    expect(formatDuration(90 * 60_000)).toBe('1h 30m');
    expect(formatDuration(2 * 60 * 60_000 + 5 * 60_000)).toBe('2h 5m');
  });
});

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(1000000)).toBe('1,000,000');
  });
});

describe('formatScore', () => {
  it('returns em dash for null/non-finite', () => {
    expect(formatScore(null)).toBe('—');
    expect(formatScore(Number.NaN)).toBe('—');
  });
  it('formats valid numbers', () => {
    expect(formatScore(0)).toBe('0');
    expect(formatScore(9999)).toBe('9,999');
  });
});

describe('formatDate', () => {
  it('returns em dash for zero/falsy', () => {
    expect(formatDate(0)).toBe('—');
  });
  it('formats a valid timestamp', () => {
    const d = formatDate(new Date('2026-07-29T00:00:00Z').getTime());
    expect(typeof d).toBe('string');
    expect(d).not.toBe('—');
  });
});
