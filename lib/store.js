const fs = require("fs");
const path = require("path");

const scorePathPrefix = "scores/";
const listPageSize = 1000;
const dataFilePath = path.join(__dirname, "..", "data", "leaderboard.json");

function addToPlayers(players, name, correct, total) {
  const playerKey = name.toLowerCase();
  const player = players[playerKey] || { name, correct: 0, total: 0, games: 0 };
  player.correct += correct;
  player.total += total;
  player.games += 1;
  players[playerKey] = player;
}

function buildScorePath(name, correct, total) {
  return scorePathPrefix + Buffer.from(name).toString("base64url") + "/" + correct + "-" + total;
}

function parseScorePath(pathname) {
  const [encodedName, scorePart] = pathname.slice(scorePathPrefix.length).split("/");
  const [correct, total] = (scorePart || "").split("-").map(Number);
  const name = Buffer.from(encodedName || "", "base64url").toString("utf8");
  const isValid = name && Number.isInteger(correct) && Number.isInteger(total) && total > 0;
  return isValid ? { name, correct, total } : null;
}

function createBlobStore(token) {
  const { put, list } = require("@vercel/blob");

  async function addResult(name, correct, total) {
    await put(buildScorePath(name, correct, total), "1", {
      access: "private",
      addRandomSuffix: true,
      contentType: "text/plain",
      token
    });
  }

  async function listScoreBlobs() {
    const blobs = [];
    let cursor;
    do {
      const page = await list({ prefix: scorePathPrefix, limit: listPageSize, cursor, token });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return blobs;
  }

  async function getPlayers() {
    const blobs = await listScoreBlobs();
    const players = {};
    blobs
      .sort((first, second) => new Date(first.uploadedAt) - new Date(second.uploadedAt))
      .map((blob) => parseScorePath(blob.pathname))
      .filter(Boolean)
      .forEach((score) => addToPlayers(players, score.name, score.correct, score.total));
    return Object.values(players);
  }

  return { addResult, getPlayers };
}

function createFileStore(filePath) {
  let pendingWrite = Promise.resolve();

  function readPlayers() {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      return {};
    }
  }

  function applyResult(name, correct, total) {
    const players = readPlayers();
    addToPlayers(players, name, correct, total);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(players, null, 2));
  }

  function addResult(name, correct, total) {
    pendingWrite = pendingWrite.then(() => applyResult(name, correct, total));
    return pendingWrite;
  }

  async function getPlayers() {
    await pendingWrite;
    return Object.values(readPlayers());
  }

  return { addResult, getPlayers };
}

function createStore() {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  return blobToken ? createBlobStore(blobToken) : createFileStore(dataFilePath);
}

module.exports = { createStore };
