import type { NextFunction, Request, Response } from 'express';

export const demoUsers = {
  alice: {
    id: 'user-alice',
    name: 'Alice Rao',
    organisationId: 'org-northwind',
    organisationName: 'Northwind Finance'
  },
  bob: {
    id: 'user-bob',
    name: 'Bob Singh',
    organisationId: 'org-contoso',
    organisationName: 'Contoso Operations'
  }
} as const;

export function demoAuth(req: Request, res: Response, next: NextFunction): void {
  const key = String(req.header('x-demo-user') ?? 'alice').toLowerCase();
  const user = demoUsers[key as keyof typeof demoUsers];

  if (!user) {
    res.status(401).json({ error: 'Unknown demo identity' });
    return;
  }

  req.demoUser = user;
  next();
}
