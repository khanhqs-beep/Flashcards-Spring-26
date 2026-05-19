import express from "express";
import multer from "multer";
import cors from "cors";
import pg from "pg";
import dotenv from "dotenv";
import XLSX from "xlsx";
import path from "path";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Run migration on startup: add media_updated_at column + trigger
(async () => {
  try {
    await pool.query(`
      ALTER TABLE vocab_flashcards
        ADD COLUMN IF NOT EXISTS media_updated_at timestamptz DEFAULT now();
    `);
    await pool.query(`
      CREATE OR REPLACE FUNCTION bump_media_updated_at()
      RETURNS trigger AS $$
      BEGIN
        NEW.media_updated_at = now();
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;
    `);
    await pool.query(`
      DROP TRIGGER IF EXISTS tr_bump_media_updated_at ON vocab_flashcards;
      CREATE TRIGGER tr_bump_media_updated_at
        BEFORE UPDATE ON vocab_flashcards
        FOR EACH ROW EXECUTE FUNCTION bump_media_updated_at();
    `);
    console.log("Migration: media_updated_at column + trigger ready");
  } catch (err) {
    console.error("Migration warning:", err.message);
  }
})();

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Backend server is running" });
});

function extractWordsFromSpreadsheet(buffer, filename) {
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const words = [];
  for (const row of rows) {
    for (const cell of row) {
      if (typeof cell === "string" && cell.trim()) {
        const cleaned = cell.trim().toLowerCase();
        if (cleaned.length > 0 && cleaned.length < 100 && !/^\d+$/.test(cleaned)) {
          words.push(cleaned);
        }
      }
    }
  }

  // Remove likely header rows (common headers)
  const headers = ["word", "words", "vocabulary", "vocab", "term", "terms"];
  if (words.length > 0 && headers.includes(words[0])) {
    words.shift();
  }

  return [...new Set(words)];
}

app.post("/api/upload", upload.single("data"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("File received:", req.file.originalname);

    const ext = path.extname(req.file.originalname).toLowerCase();
    let response;

    if (ext === ".csv" || ext === ".xls" || ext === ".xlsx") {
      const words = extractWordsFromSpreadsheet(req.file.buffer, req.file.originalname);
      console.log(`Parsed ${words.length} words from ${ext} file`);

      response = await fetch(process.env.N8N_WEBHOOK_URL, {
        method: "POST",
        body: JSON.stringify({ words, source: req.file.originalname }),
        headers: { "Content-Type": "application/json" },
      });
    } else {
      response = await fetch(process.env.N8N_WEBHOOK_URL, {
        method: "POST",
        body: req.file.buffer,
        headers: {
          "Content-Type": req.file.mimetype,
          "Content-Disposition": `attachment; filename="${req.file.originalname}"`,
        },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`n8n returned status ${response.status}: ${errorText}`);
    }

    console.log("File sent to n8n for processing");

    const isPdf = ext === ".pdf";
    res.json({
      success: true,
      message: isPdf
        ? "PDF sent for processing — check Bulk Review shortly"
        : "File uploaded and sent for processing",
      originalFilename: req.file.originalname,
      data: isPdf ? [] : words,
      wordCount: isPdf ? null : words.length,
    });
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({
      error: "Failed to process file",
      message: error.message,
    });
  }
});

app.get("/api/flashcards", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT word, category, definition, example_sentence, label, media_link, pos, source, media_updated_at FROM vocab_flashcards ORDER BY created_at DESC"
    );

    const flashcards = result.rows.map((row) => ({
      id: row.word,
      word: row.word,
      category: row.category,
      definition: row.definition,
      exampleSentence: row.example_sentence,
      label: row.label,
      mediaLink: row.media_link,
      partOfSpeech: row.pos,
      source: row.source,
      mediaUpdatedAt: row.media_updated_at,
    }));

    console.log(`Fetched ${flashcards.length} flashcards`);
    res.json({
      success: true,
      data: flashcards,
      count: flashcards.length,
    });
  } catch (error) {
    console.error("Error fetching flashcards:", error);
    res.status(500).json({
      error: "Failed to fetch flashcards",
      message: error.message,
    });
  }
});

app.get("/api/flashcards/:word", async (req, res) => {
  try {
    const { word } = req.params;
    const result = await pool.query(
      "SELECT word, category, definition, example_sentence, label, media_link, pos, source, media_updated_at FROM vocab_flashcards WHERE word = $1",
      [word]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Flashcard not found", word });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        id: row.word,
        word: row.word,
        category: row.category,
        definition: row.definition,
        exampleSentence: row.example_sentence,
        label: row.label,
        mediaLink: row.media_link,
        partOfSpeech: row.pos,
        source: row.source,
        mediaUpdatedAt: row.media_updated_at,
      },
    });
  } catch (error) {
    console.error("Error fetching flashcard:", error);
    res.status(500).json({
      error: "Failed to fetch flashcard",
      message: error.message,
    });
  }
});

app.put("/api/flashcards/:word", async (req, res) => {
  try {
    const { word } = req.params;
    const { definition, exampleSentence, partOfSpeech, label, category } = req.body;

    const result = await pool.query(
      `UPDATE vocab_flashcards
       SET definition = COALESCE($1, definition),
           example_sentence = COALESCE($2, example_sentence),
           pos = COALESCE($3, pos),
           label = COALESCE($4, label),
           category = COALESCE($5, category)
       WHERE word = $6
       RETURNING word, category, definition, example_sentence, label, media_link, pos, source, media_updated_at`,
      [definition, exampleSentence, partOfSpeech, label, category, word]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Flashcard not found", word });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        id: row.word,
        word: row.word,
        category: row.category,
        definition: row.definition,
        exampleSentence: row.example_sentence,
        label: row.label,
        mediaLink: row.media_link,
        partOfSpeech: row.pos,
        source: row.source,
        mediaUpdatedAt: row.media_updated_at,
      },
    });
  } catch (error) {
    console.error("Error updating flashcard:", error);
    res.status(500).json({
      error: "Failed to update flashcard",
      message: error.message,
    });
  }
});

app.delete("/api/flashcards/:word", async (req, res) => {
  try {
    const { word } = req.params;
    const result = await pool.query(
      "DELETE FROM vocab_flashcards WHERE word = $1 RETURNING word",
      [word]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Flashcard not found", word });
    }

    res.json({ success: true, message: `Deleted flashcard: ${word}` });
  } catch (error) {
    console.error("Error deleting flashcard:", error);
    res.status(500).json({
      error: "Failed to delete flashcard",
      message: error.message,
    });
  }
});

app.post("/api/flashcards/:word/regenerate-image", async (req, res) => {
  try {
    const { word } = req.params;

    const result = await pool.query(
      "SELECT word, example_sentence, category FROM vocab_flashcards WHERE word = $1",
      [word]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Flashcard not found", word });
    }

    const row = result.rows[0];
    const response = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: "POST",
      body: JSON.stringify({
        regenerateImage: true,
        word: row.word,
        exampleSentence: row.example_sentence,
        category: row.category || "",
      }),
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`n8n returned status ${response.status}: ${errorText}`);
    }

    res.json({
      success: true,
      message: `Image regeneration triggered for: ${word}`,
    });
  } catch (error) {
    console.error("Error regenerating image:", error);
    res.status(500).json({
      error: "Failed to regenerate image",
      message: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
