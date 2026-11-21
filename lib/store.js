const fs = require("fs");
const path = require("path");

const playersSetKey = "bvs:players";
const playerKeyPrefix = "bvs:player:";
const dataFilePath = path.join(__dirname, "..", "data", "leaderboard.json");

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

async function sendRedisRequest(config, endpoint, commands) {
  const response = await fetch(config.url + endpoint, {
    method: "POST",
    headers: { Authorization: "Bearer " + config.token, "Content-Type": "application/json" },
    body: JSON.stringify(commands)
  });
  if (!response.ok) throw new Error("Redis request failed with status " + response.status);
  const results = await response.json();
  const failure = results.find((entry) => entry.error);
  if (failure) throw new Error(failure.error);
  return results.map((entry) => entry.result);
}

function hashArrayToPlayer(flatFields) {
  const fields = {};
  for (let index = 0; index < flatFields.length; index += 2) {
    fields[flatFields[index]] = flatFields[index + 1];
  }
  return {
    name: fields.name,
    correct: Number(fields.correct),
    total: Number(fields.total),
    games: Number(fields.games)
  };
}

function createRedisStore(config) {
  async function addResult(name, correct, total) {
    const playerKey = playerKeyPrefix + name.toLowerCase();
    await sendRedisRequest(config, "/multi-exec", [
      ["HSETNX", playerKey, "name", name],
      ["HINCRBY", playerKey, "correct", correct],
      ["HINCRBY", playerKey, "total", total],
      ["HINCRBY", playerKey, "games", 1],
      ["SADD", playersSetKey, playerKey]
    ]);
  }

  async function getPlayers() {
    const [playerKeys] = await sendRedisRequest(config, "/pipeline", [["SMEMBERS", playersSetKey]]);
    if (playerKeys.length === 0) return [];
    const hashes = await sendRedisRequest(
      config,
      "/pipeline",
      playerKeys.map((playerKey) => ["HGETALL", playerKey])
    );
    return hashes.map(hashArrayToPlayer);
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

  function writePlayers(players) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(players, null, 2));
  }

  function applyResult(name, correct, total) {
    const players = readPlayers();
    const playerKey = name.toLowerCase();
    const player = players[playerKey] || { name, correct: 0, total: 0, games: 0 };
    player.correct += correct;
    player.total += total;
    player.games += 1;
    players[playerKey] = player;
    writePlayers(players);
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
  const redisConfig = getRedisConfig();
  return redisConfig ? createRedisStore(redisConfig) : createFileStore(dataFilePath);
}

module.exports = { createStore };
