import 'dotenv/config'
import 'ts-node/register'
import type { RunnerOption } from 'node-pg-migrate'

const config: RunnerOption = {
  databaseUrl: process.env.DATABASE_URL!,
  dir: 'migrations',
  migrationsTable: 'pgmigrations',
  direction: 'up',
}

export default config
