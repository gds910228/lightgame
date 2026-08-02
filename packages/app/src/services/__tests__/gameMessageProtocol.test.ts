import { describe, it, expect } from 'vitest';
import {
  isLightGameReportMessage,
  parseReportMessage,
  buildReadyMessage,
  LIGHTGAME_SOURCE,
  REPORT_MESSAGE_TYPE,
  READY_MESSAGE_TYPE,
  PROTOCOL_VERSION,
} from '../gameMessageProtocol';

describe('isLightGameReportMessage', () => {
  it('accepts a valid score report', () => {
    const msg = { source: 'lightgame', type: 'lightgame:report', payload: { kind: 'score', score: 42 } };
    expect(isLightGameReportMessage(msg)).toBe(true);
  });

  it('accepts all payload kinds', () => {
    expect(isLightGameReportMessage({ source: 'lightgame', type: 'lightgame:report', payload: { kind: 'progress', data: { a: 1 } } })).toBe(true);
    expect(isLightGameReportMessage({ source: 'lightgame', type: 'lightgame:report', payload: { kind: 'gameOver', score: 10 } })).toBe(true);
    expect(isLightGameReportMessage({ source: 'lightgame', type: 'lightgame:report', payload: { kind: 'complete' } })).toBe(true);
    expect(isLightGameReportMessage({ source: 'lightgame', type: 'lightgame:report', payload: { kind: 'event', event: 'start' } })).toBe(true);
  });

  it('rejects wrong source/type', () => {
    expect(isLightGameReportMessage({ source: 'other', type: 'lightgame:report', payload: { kind: 'score', score: 1 } })).toBe(false);
    expect(isLightGameReportMessage({ source: 'lightgame', type: 'other', payload: { kind: 'score', score: 1 } })).toBe(false);
    expect(isLightGameReportMessage({ type: 'SHARE_GAME', data: { score: 1 } })).toBe(false);
  });

  it('rejects invalid scores (negative, NaN, string, missing)', () => {
    expect(isLightGameReportMessage({ source: 'lightgame', type: 'lightgame:report', payload: { kind: 'score', score: -1 } })).toBe(false);
    expect(isLightGameReportMessage({ source: 'lightgame', type: 'lightgame:report', payload: { kind: 'score', score: Number.NaN } })).toBe(false);
    expect(isLightGameReportMessage({ source: 'lightgame', type: 'lightgame:report', payload: { kind: 'score', score: '10' } })).toBe(false);
    expect(isLightGameReportMessage({ source: 'lightgame', type: 'lightgame:report', payload: { kind: 'score' } })).toBe(false);
  });

  it('rejects non-objects and unknown kinds', () => {
    expect(isLightGameReportMessage(null)).toBe(false);
    expect(isLightGameReportMessage('x')).toBe(false);
    expect(isLightGameReportMessage([])).toBe(false);
    expect(isLightGameReportMessage({ source: 'lightgame', type: 'lightgame:report', payload: { kind: 'unknown' } })).toBe(false);
  });

  it('rejects event without event name', () => {
    expect(isLightGameReportMessage({ source: 'lightgame', type: 'lightgame:report', payload: { kind: 'event' } })).toBe(false);
    expect(isLightGameReportMessage({ source: 'lightgame', type: 'lightgame:report', payload: { kind: 'event', event: '' } })).toBe(false);
  });
});

describe('parseReportMessage', () => {
  it('parses and returns the payload for valid messages', () => {
    const payload = parseReportMessage({ source: 'lightgame', type: 'lightgame:report', payload: { kind: 'score', score: 7, label: 'best' } });
    expect(payload).toEqual({ kind: 'score', score: 7, label: 'best' });
  });
  it('returns null for invalid messages', () => {
    expect(parseReportMessage(null)).toBeNull();
    expect(parseReportMessage({ type: 'SHARE_GAME' })).toBeNull();
    expect(parseReportMessage({ source: 'lightgame', type: 'lightgame:report', payload: { kind: 'score', score: -1 } })).toBeNull();
  });
});

describe('buildReadyMessage', () => {
  it('builds a well-formed ready handshake', () => {
    const msg = buildReadyMessage('game-xyz');
    expect(msg).toEqual({
      source: LIGHTGAME_SOURCE,
      type: READY_MESSAGE_TYPE,
      gameId: 'game-xyz',
      v: PROTOCOL_VERSION,
    });
    expect(msg.type).toBe('lightgame:ready');
    expect(REPORT_MESSAGE_TYPE).toBe('lightgame:report');
  });
});
