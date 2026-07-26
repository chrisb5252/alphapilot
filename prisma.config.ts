import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js uses .env.local during local development; production injects values directly.
dotenv.config({ path: ".env.local" });
dotenv.config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // A placeholder keeps `npm install` and Prisma Client generation deterministic.
    // Migration and runtime commands still require a real connection string.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
