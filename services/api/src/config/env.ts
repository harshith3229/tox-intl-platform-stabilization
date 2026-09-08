import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/tox_documents'),
  TASK_GATEWAY_URL: z.string().url().default('http://localhost:8000')
});

export const env = schema.parse(process.env);
