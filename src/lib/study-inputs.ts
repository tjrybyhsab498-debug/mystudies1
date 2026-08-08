import { z } from "zod";

const sourceInput = z.object({
  documentId: z.string().uuid(),
  pageFrom: z.number().int().min(1).max(10_000).nullable(),
  pageTo: z.number().int().min(1).max(10_000).nullable(),
  count: z.number().int().min(5).max(60).default(20),
  sourceText: z.string().trim().min(200).max(150_000),
});

const tutorInput = z.object({
  documentId: z.string().uuid().nullable(),
  question: z.string().trim().min(2).max(2000),
});

export function parseStudySourceInput(input: unknown) {
  return sourceInput.parse(input);
}

export function parseTutorInput(input: unknown) {
  return tutorInput.parse(input);
}