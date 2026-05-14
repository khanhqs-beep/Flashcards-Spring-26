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

    res.json({
      success: true,
      message: "File uploaded and sent for processing",
      originalFilename: req.file.originalname,
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
      "SELECT word, category, definition, example_sentence, label, media_link, pos, source FROM vocab_flashcards ORDER BY created_at DESC"
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
      "SELECT word, category, definition, example_sentence, label, media_link, pos, source FROM vocab_flashcards WHERE word = $1",
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

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
