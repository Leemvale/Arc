import 'dotenv/config';
import { z } from 'zod';
const env = z
  .object({
    DATABASE_URL: z.string().default('postgres://arc:arc-local-only@127.0.0.1:54329/arc'),
    PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
    OPENAI_API_KEY: z.string().default(''),
    OPENAI_MODEL: z.string().default('gpt-5.4-mini-2026-03-17'),
    OPENAI_INPUT_PRICE: z.coerce.number().positive().default(0.75),
    OPENAI_OUTPUT_PRICE: z.coerce.number().positive().default(4.5),
    OPENAI_PRICING_CONFIRMED: z.enum(['true', 'false']).default('false'),
    EXPERIMENT_BUDGET_USD: z.coerce.number().positive().max(5).default(5),
  })
  .parse(process.env);
export const config = env;
