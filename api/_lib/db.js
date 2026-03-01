import { Pool } from "pg";

let pool;

export const getDb = () => {
  if (pool) {
    return pool;
  }

  const connectionString = String(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "").trim();
  if (!connectionString) {
    throw new Error("NEON_DATABASE_URL saknas.");
  }

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 4,
  });

  return pool;
};

export const query = async (text, values = []) => {
  const db = getDb();
  return db.query(text, values);
};
