import { z } from "zod";

const generateSummaryInput = z.object({
  documentId: z.string().uuid(),
  pageFrom: z.number().int().min(1).max(10_000).nullable(),
  pageTo: z.number().int().min(1).max(10_000).nullable(),
  depth: z.enum(["standard", "comprehensive"]).default("standard"),
  sourceText: z.string().trim().min(200).max(400_000),
});

export function parseGenerateSummaryInput(input: unknown) {
  return generateSummaryInput.parse(input);
}