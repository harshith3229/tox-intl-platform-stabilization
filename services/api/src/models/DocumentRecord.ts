import { Schema, model } from 'mongoose';

export type ProcessingStatus = 'queued' | 'processing' | 'completed' | 'failed';

const resultSchema = new Schema(
  {
    invoiceNumber: String,
    supplier: String,
    total: Number,
    currency: String,
    date: String,
    summary: String
  },
  { _id: false }
);

const documentRecordSchema = new Schema(
  {
    organisationId: { type: String, required: true, index: true },
    uploadedBy: { type: String, required: true },
    fileName: { type: String, required: true },
    sourceText: { type: String, required: true },
    uploadFingerprint: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
      required: true
    },
    attempt: { type: Number, default: 1, required: true },
    result: resultSchema,
    errorMessage: String
  },
  { timestamps: true }
);

export const DocumentRecord = model('DocumentRecord', documentRecordSchema);
