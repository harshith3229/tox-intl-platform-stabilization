import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findOneMock } = vi.hoisted(() => ({ findOneMock: vi.fn() }));

vi.mock('../src/models/DocumentRecord.js', () => ({
  DocumentRecord: {
    findOne: findOneMock
  }
}));

const { app } = await import('../src/app.js');

function chain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result)
  };
}

const VALID_ID = '507f1f77bcf86cd799439011';

describe('GET /api/documents/:id', () => {
  beforeEach(() => {
    findOneMock.mockReset();
  });

  it('returns the document when it belongs to the requesting user organisation', async () => {
    const doc = {
      _id: VALID_ID,
      organisationId: 'org-northwind',
      fileName: 'invoice.txt',
      status: 'completed'
    };
    findOneMock.mockReturnValue(chain(doc));

    const response = await request(app)
      .get(`/api/documents/${VALID_ID}`)
      .set('x-demo-user', 'alice');

    expect(response.status).toBe(200);
    expect(response.body.item).toEqual(doc);
    // The lookup must be scoped by the requester's organisation, not just the id.
    expect(findOneMock).toHaveBeenCalledWith({
      _id: VALID_ID,
      organisationId: 'org-northwind'
    });
  });

  it('returns 404 (not the other organisation\'s document) when the id belongs to a different organisation', async () => {
    // Simulates the real query behaviour once scoped: a mismatched organisationId
    // means Mongo finds no matching document, so this must resolve to null.
    findOneMock.mockReturnValue(chain(null));

    const response = await request(app)
      .get(`/api/documents/${VALID_ID}`)
      .set('x-demo-user', 'bob');

    expect(response.status).toBe(404);
    expect(findOneMock).toHaveBeenCalledWith({
      _id: VALID_ID,
      organisationId: 'org-contoso'
    });
  });

  it('returns 400 for a malformed id without querying the database', async () => {
    const response = await request(app)
      .get('/api/documents/not-an-object-id')
      .set('x-demo-user', 'alice');

    expect(response.status).toBe(400);
    expect(findOneMock).not.toHaveBeenCalled();
  });
});
