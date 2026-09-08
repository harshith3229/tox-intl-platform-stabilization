import mongoose from 'mongoose';
import { app } from './app.js';
import { env } from './config/env.js';

async function start(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  app.listen(env.PORT, () => {
    console.log(`api_ready port=${env.PORT}`);
  });
}

start().catch((error) => {
  console.error('api_start_failed', error);
  process.exit(1);
});
