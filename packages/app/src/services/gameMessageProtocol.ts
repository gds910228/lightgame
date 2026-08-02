import type { LightGameReportMessage, LightGameReportPayload, LightGameReadyMessage } from '../types';

export const LIGHTGAME_SOURCE = 'lightgame';
export const REPORT_MESSAGE_TYPE = 'lightgame:report';
export const READY_MESSAGE_TYPE = 'lightgame:ready';
export const PROTOCOL_VERSION = 1;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isValidScore(score: unknown): score is number {
  return typeof score === 'number' && Number.isFinite(score) && score >= 0;
}
function parsePayload(raw: unknown): LightGameReportPayload | null {
  if (!isObject(raw) || typeof raw.kind !== 'string') return null;
  switch (raw.kind) {
    case 'score': {
      if (!isValidScore(raw.score)) return null;
      const label = typeof raw.label === 'string' ? raw.label : undefined;
      return { kind: 'score', score: raw.score, label };
    }
    case 'progress':
      return isObject(raw.data) ? { kind: 'progress', data: raw.data } : null;
    case 'gameOver': {
      const score = isValidScore(raw.score) ? raw.score : undefined;
      const progress = isObject(raw.progress) ? raw.progress : undefined;
      return { kind: 'gameOver', score, progress };
    }
    case 'complete': {
      const score = isValidScore(raw.score) ? raw.score : undefined;
      return { kind: 'complete', score };
    }
    case 'event': {
      if (typeof raw.event !== 'string' || !raw.event) return null;
      const data = isObject(raw.data) ? raw.data : undefined;
      return { kind: 'event', event: raw.event, data };
    }
    default:
      return null;
  }
}
export function isLightGameReportMessage(data: unknown): data is LightGameReportMessage {
  if (!isObject(data)) return false;
  if (data.source !== LIGHTGAME_SOURCE || data.type !== REPORT_MESSAGE_TYPE) return false;
  return parsePayload(data.payload) !== null;
}
export function parseReportMessage(data: unknown): LightGameReportPayload | null {
  if (!isObject(data)) return null;
  if (data.source !== LIGHTGAME_SOURCE || data.type !== REPORT_MESSAGE_TYPE) return null;
  return parsePayload(data.payload);
}
export function buildReadyMessage(gameId: string): LightGameReadyMessage {
  return { source: LIGHTGAME_SOURCE, type: READY_MESSAGE_TYPE, gameId, v: PROTOCOL_VERSION };
}
