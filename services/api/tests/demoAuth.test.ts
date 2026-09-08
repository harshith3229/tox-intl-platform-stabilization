import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { demoAuth } from '../src/middleware/demoAuth.js';

function responseStub() {
  const response = {
    status: vi.fn(),
    json: vi.fn()
  };
  response.status.mockReturnValue(response);
  return response;
}

describe('demoAuth', () => {
  it('resolves a supported demo identity', () => {
    const req = { header: () => 'alice' } as unknown as Request;
    const res = responseStub() as unknown as Response;
    const next = vi.fn() as NextFunction;

    demoAuth(req, res, next);

    expect(req.demoUser.organisationId).toBe('org-northwind');
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects an unknown demo identity', () => {
    const req = { header: () => 'unknown' } as unknown as Request;
    const res = responseStub();
    const next = vi.fn() as NextFunction;

    demoAuth(req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
