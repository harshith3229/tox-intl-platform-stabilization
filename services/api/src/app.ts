import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { demoAuth } from './middleware/demoAuth.js';
import documentsRouter from './routes/documents.js';

export const app = express();

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '200kb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/documents', demoAuth, documentsRouter);

const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  void next;
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request', details: error.flatten() });
    return;
  }

  console.error('request_failed', {
    name: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : 'Unknown error'
  });
  res.status(500).json({ error: 'Unexpected server error' });
};

app.use(errorHandler);
