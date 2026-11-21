const { createStore } = require("../lib/store");

const store = createStore();
const maxNameLength = 24;
const gameLength = 10;

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  if (req.body !== undefined) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  return JSON.parse(await readRawBody(req));
}

function parseResult(body) {
  if (!body || typeof body.name !== "string") return null;
  const name = body.name.trim().slice(0, maxNameLength).trim();
  const { correct, total } = body;
  const isValidScore = Number.isInteger(correct) && correct >= 0 && correct <= total;
  if (!name || total !== gameLength || !isValidScore) return null;
  return { name, correct, total };
}

function buildRows(players) {
  return players
    .map((player) => ({
      name: player.name,
      accuracy: Math.round((player.correct / player.total) * 100),
      ratio: player.correct / player.total,
      games: player.games
    }))
    .sort((first, second) => second.ratio - first.ratio || second.games - first.games)
    .map(({ name, accuracy, games }, index) => ({ rank: index + 1, name, accuracy, games }));
}

async function getRows() {
  return buildRows(await store.getPlayers());
}

async function handlePost(req, res) {
  let result;
  try {
    result = parseResult(await readJsonBody(req));
  } catch {
    result = null;
  }
  if (!result) return sendJson(res, 400, { error: "Invalid result" });
  await store.addResult(result.name, result.correct, result.total);
  return sendJson(res, 200, await getRows());
}

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") return sendJson(res, 200, await getRows());
    if (req.method === "POST") return await handlePost(req, res);
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch {
    return sendJson(res, 500, { error: "Server error" });
  }
};
