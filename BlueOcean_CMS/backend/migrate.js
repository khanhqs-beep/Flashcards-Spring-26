import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS vocab_flashcards (
        word TEXT PRIMARY KEY,
        category TEXT,
        definition TEXT,
        example_sentence TEXT,
        label TEXT,
        media_link TEXT,
        pos TEXT,
        source TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_flashcards_source ON vocab_flashcards(source);
    `);
    console.log("Migration complete: vocab_flashcards table ready");
  } finally {
    client.release();
  }
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
