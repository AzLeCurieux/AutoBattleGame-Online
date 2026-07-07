import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_PATH: z.string().default('./data/autobattle.db'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** Directory of the built web app, served in production. */
  WEB_DIST: z.string().optional(),
});

export type Config = z.infer<typeof EnvSchema> & { isProd: boolean; secureOrigin: boolean };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:\n' + z.prettifyError(parsed.error));
    process.exit(1);
  }
  return {
    ...parsed.data,
    isProd: parsed.data.NODE_ENV === 'production',
    // Secure cookies / HTTPS upgrades only make sense when the app is really served over TLS.
    secureOrigin: parsed.data.APP_ORIGIN.startsWith('https://'),
  };
}
