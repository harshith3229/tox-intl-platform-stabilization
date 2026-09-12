import { describe, expect, it } from 'vitest';
import { hasActiveDocuments, isActiveStatus } from './polling';

describe('isActiveStatus', () => {
  it.each([
    ['queued', true],
    ['processing', true],
    ['completed', false],
    ['failed', false]
  ] as const)('%s -> %s', (status, expected) => {
    expect(isActiveStatus(status)).toBe(expected);
  });
});

describe('hasActiveDocuments', () => {
  it('is false for an empty list', () => {
    expect(hasActiveDocuments([])).toBe(false);
  });

  it('is false when every document is terminal', () => {
    expect(hasActiveDocuments([{ status: 'completed' }, { status: 'failed' }])).toBe(false);
  });

  it('is true when at least one document is still queued or processing', () => {
    expect(hasActiveDocuments([{ status: 'completed' }, { status: 'processing' }])).toBe(true);
    expect(hasActiveDocuments([{ status: 'queued' }])).toBe(true);
  });
});
