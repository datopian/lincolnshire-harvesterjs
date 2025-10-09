import { config } from "dotenv";

config(); // loads .env

import { z } from "zod";

const EnvSchema = z.object({
  HARVESTER_NAME: z.string().min(1),
  SOURCE_API_URL: z.string().min(1),
  SOURCE_API_KEY: z.string().optional(),

  PORTALJS_CLOUD_API_URL: z
    .string()
    .url()
    .default("https://api.cloud.portaljs.com"),
  PORTALJS_CLOUD_API_KEY: z.string().min(1),
  PORTALJS_CLOUD_MAIN_ORG: z.string().min(1),
  PORTALJS_CLOUD_MAIN_GROUP: z.string().min(1),
  PORTALJS_CLOUD_MAIN_USER: z.string().min(1),
  CONCURRENCY: z.coerce.number().default(4),
  RATE_LIMIT_RPS: z.coerce.number().default(2),
  RETRY_MAX_ATTEMPTS: z.coerce.number().default(2),
  RETRY_BASE_MS: z.coerce.number().default(500),
  DRY_RUN: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((val) => val === "true"),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_KEY_ID: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  NEXT_PUBLIC_R2_PUBLIC_URL: z.string().url().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
});

export type Env = z.infer<typeof EnvSchema>;
export const env = EnvSchema.parse(process.env);
