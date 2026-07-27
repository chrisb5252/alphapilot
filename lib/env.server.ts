import { z } from "zod";

const databaseUrl = z
  .string()
  .trim()
  .url()
  .refine(
    (value) =>
      value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "must be a PostgreSQL connection URL beginning with postgresql:// or postgres://",
  );

export function getRuntimeDatabaseUrl() {
  const result = databaseUrl.safeParse(process.env.DATABASE_URL);
  if (!result.success) {
    throw new Error(
      `Invalid DATABASE_URL: ${result.error.issues[0]?.message ?? "missing value"}. Set the pooled Neon URL in this environment.`,
    );
  }
  return result.data;
}

export function getEnvironmentStatus() {
  return {
    databaseConfigured: databaseUrl.safeParse(process.env.DATABASE_URL).success,
    clerkConfigured: Boolean(
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
    ),
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
  };
}
