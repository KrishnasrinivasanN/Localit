require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { GoogleGenAI } = require("@google/genai");
const rules = require("./rules.json");

const app = express();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("AUTH FAIL: no Bearer header");
    return { reason: "no login token sent by the browser" };
  }
  const token = authHeader.split(" ")[1];
  if (!token || token === "undefined" || token === "null") {
    console.log("AUTH FAIL: token is", token);
    return { reason: "browser session missing, sign out and sign in again" };
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    console.log("AUTH FAIL:", error?.message, "| status:", error?.status);
    return { reason: error?.message || "token rejected by Supabase" };
  }
  return { user: data.user };
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;
const aiRateLimits = new Map();
const waitlistRateLimits = new Map();

const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  "gemini-2.5-flash",
  "gemini-flash-latest",
].filter(Boolean);

let cachedModelName = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isModelNotFound(error) {
  return error?.status === 404;
}

function isRetryable(error) {
  return error?.status === 503 || error?.status === 429;
}

async function generateWithSupportedModel(prompt) {
  const modelNames = cachedModelName
    ? [cachedModelName, ...MODEL_CANDIDATES.filter((m) => m !== cachedModelName)]
    : MODEL_CANDIDATES;
  let lastError = null;

  for (const modelName of modelNames) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        cachedModelName = modelName;
        return result.text;
      } catch (error) {
        lastError = error;
        if (isModelNotFound(error)) {
          console.warn(`Gemini model ${modelName} not found, trying next.`);
        break;
        }
        if (isRetryable(error)) {
          if (attempt < 2) {
            await sleep(1500 * (attempt + 1));
          continue;
          }
        break;
        }
        throw error;
      }
    }
  }

  if (isRetryable(lastError)) throw lastError;

  const err = new Error(
    `No supported Gemini model found. Tried: ${modelNames.join(", ")}. Last error: ${lastError?.message || "unknown"}`
  );
  err.status = 500;
  throw err;
}

app.use(cors());
app.use(express.json());

app.get("/config.js", (req, res) => {
  res.type("application/javascript");
  res.send(
    `window.ENV = ${JSON.stringify({
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    })};`
  );
});

app.get("/rules", function (req, res) {
  res.json(rules);
});

app.post("/api/join-waitlist", async function (req, res) {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "A valid email is required." });
  }

  const ip = req.ip;
  const now = Date.now();
  const entry = waitlistRateLimits.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > 60 * 1000 * 5) { entry.count = 0; entry.windowStart = now; }
  if (entry.count >= 5) return res.status(429).json({ error: "Too many requests. Please try again later." });
  entry.count++;
  waitlistRateLimits.set(ip, entry);

  try {
    const { error: insertError } = await supabase
      .from("waitlist")
      .upsert({ email, plan: "pro" }, { onConflict: "email", ignoreDuplicates: true });
    if (insertError) throw insertError;
    res.status(200).json({ message: "Successfully joined the waitlist!" });
  } catch (error) {
    console.error("Waitlist error:", error);
    res.status(500).json({ error: "Could not join the waitlist. Please try again." });
  }
});

app.post("/analyze", async function (req, res) {
  const { user, reason } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: `Unauthorized: ${reason}` });

  let fileText = req.body.text;
  let fileType = req.body.fileType || "json";
  let filename = req.body.filename || "unknown";
  let clientId = user.id;
  let now = Date.now();
  let entry = aiRateLimits.get(clientId) || { count: 0, windowStart: now };

  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) { entry.count = 0; entry.windowStart = now; }
  if (entry.count >= RATE_LIMIT_MAX) {
    let retryAfter = Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return res.status(429).json({ error: `Rate limit exceeded. Try again in ${retryAfter} seconds.` });
  }
  entry.count += 1;
  aiRateLimits.set(clientId, entry);

  if (!fileText) return res.status(400).json({ error: "No file text provided" });

  const FREE_SCAN_LIMIT = 5;
  const today = new Date().toISOString().slice(0, 10);

  const { data: usageRow, error: usageReadError } = await supabase
    .from("usage").select("ai_scan_count, reset_date").eq("user_id", user.id).single();

  let currentCount = 0;
  if (usageReadError && usageReadError.code === "PGRST116") {
    await supabase.from("usage").insert({ user_id: user.id, ai_scan_count: 0, reset_date: today });
  } else if (usageRow) {
    if (usageRow.reset_date && usageRow.reset_date.slice(0, 7) !== today.slice(0, 7)) {
      await supabase.from("usage").update({ ai_scan_count: 0, reset_date: today }).eq("user_id", user.id);
    } else {
      currentCount = usageRow.ai_scan_count || 0;
    }
  }

  if (currentCount >= FREE_SCAN_LIMIT) {
    return res.status(403).json({
      error: "Free tier limit reached. You've used all 5 AI scans for this month.",
      limitReached: true,
      scansUsed: currentCount,
      scansLimit: FREE_SCAN_LIMIT,
    });
  }

  let promptRules = rules.map((rule) => `- ${rule.type}: ${rule.detail}`).join("\n");
  let prompt = `You are a localization QA expert. Analyze this translation file and find issues that automated checks would miss.

File format: ${fileType.toUpperCase()}

Use the following rule checks as guidance:
${promptRules}

Translation file:
${fileText}

Respond ONLY with a JSON array. No explanation, no markdown, just the raw array.
Each item must have exactly these fields:
- "key": the translation key with the issue (for PO files use the msgid string as the key)
- "type": a short issue label (max 4 words)
- "detail": one sentence explaining the issue
- "suggested_fix": the corrected translation value only (not the full entry, just the value string)

If you find no issues, return an empty array: []`;

  try {
    let rawText = await generateWithSupportedModel(prompt);
    let cleaned = rawText.replace(/```json|```/g, "").trim();
    let aiIssues = JSON.parse(cleaned);

    await supabase.from("usage")
      .upsert({ user_id: user.id, ai_scan_count: currentCount + 1, reset_date: today }, { onConflict: "user_id" });

    try {
      const { data: existing } = await supabase
        .from("scan_history").select("id, events").eq("user_id", user.id).eq("filename", filename).single();

      const newEvent = { type: "ai", issue_count: aiIssues.length, at: new Date().toISOString() };

      if (existing) {
        await supabase.from("scan_history")
          .update({
            file_type: fileType,
            issue_count: aiIssues.length,
            scan_type: "ai",
            updated_at: new Date().toISOString(),
            events: [...(existing.events || []), newEvent],
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("scan_history").insert({
          user_id: user.id, filename, file_type: fileType,
          issue_count: aiIssues.length, scan_type: "ai", events: [newEvent],
        });
      }
    } catch (e) { console.error("scan_history upsert failed:", e.message); }

    res.json({ issues: aiIssues, scansUsed: currentCount + 1, scansLimit: FREE_SCAN_LIMIT });
  } catch (error) {
    console.error("Gemini error:", error.status, error.message);
    const busy = error.status === 503 || error.status === 429;
    res.status(busy ? 503 : 500).json({
      error: busy
        ? "AI is busy right now. Please try again in a few minutes."
        : "AI analysis failed. Please try again.",
    });
  }
});

app.use(express.static("."));

const PORT = 3000;
app.listen(PORT, function () {
  console.log(`Localit running at http://localhost:${PORT} [server v3 - auth debug]`);
});