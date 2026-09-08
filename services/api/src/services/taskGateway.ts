import axios from 'axios';
import { env } from '../config/env.js';

export type ProcessingJob = {
  documentId: string;
  organisationId: string;
  attempt: number;
  fileName: string;
  sourceText: string;
};

export async function enqueueProcessing(job: ProcessingJob): Promise<void> {
  await axios.post(`${env.TASK_GATEWAY_URL}/tasks/process-document`, job, {
    timeout: 3_000
  });
}
