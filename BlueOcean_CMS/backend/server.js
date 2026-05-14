import express from "express";
import multer from "multer";
import cors from "cors";
import pg from "pg";
import dotenv from "dotenv";

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

app.post("/api/upload", upload.single("data"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("File received:", req.file.originalname);

    const response = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: "POST",
      body: req.file.buffer,
      headers: {
        "Content-Type": req.file.mimetype,
        "Content-Disposition": `attachment; filename="${req.file.originalname}"`,
      },
    });

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
