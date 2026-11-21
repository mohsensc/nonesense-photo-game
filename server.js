const http = require("http");
const fs = require("fs");
const path = require("path");
const leaderboardHandler = require("./api/leaderboard");

const rootDirectory = __dirname;
const port = Number(process.env.PORT) || 5330;
const publicFiles = new Set(["/index.html", "/photos.json"]);
const publicDirectories = ["/photos/"];
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif"
};

function sendNotFound(res) {
  res.statusCode = 404;
  res.end("Not found");
}

function isPublicPath(urlPath) {
  return publicFiles.has(urlPath) || publicDirectories.some((directory) => urlPath.startsWith(directory));
}

function resolveFilePath(urlPath) {
  const filePath = path.resolve(rootDirectory, "." + urlPath);
  return filePath.startsWith(rootDirectory + path.sep) ? filePath : null;
}

function readUrlPath(requestUrl) {
  try {
    const decoded = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
    return decoded === "/" ? "/index.html" : decoded;
  } catch {
    return null;
  }
}

function serveStaticFile(req, res) {
  const urlPath = readUrlPath(req.url);
  const filePath = urlPath && isPublicPath(urlPath) ? resolveFilePath(urlPath) : null;
  if (!filePath) return sendNotFound(res);
  fs.readFile(filePath, (error, content) => {
    if (error) return sendNotFound(res);
    res.setHeader("Content-Type", contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream");
    res.end(content);
  });
}

function routeRequest(req, res) {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/api/leaderboard") return leaderboardHandler(req, res);
  return serveStaticFile(req, res);
}

http.createServer(routeRequest).listen(port, () => {
  console.log("http://localhost:" + port);
});
