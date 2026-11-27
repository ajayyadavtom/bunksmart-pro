const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const healthHandler = require("./api/health");
const loginHandler = require("./api/auth/login");
const stateHandler = require("./api/state");
const { getMongoStatus } = require("./lib/mongoStore");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = __dirname;

const PUBLIC_FILES = new Set([
  "index.html",
  "styles.css",
  "app.js",
  "README.md"
]);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon"
};

function getLanUrls(port) {
  const urls = [];
  const ifaces = os.networkInterfaces();
  for (const entries of Object.values(ifaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal) {
        urls.push(`http://${entry.address}:${port}`);
      }
    }
  }
  return urls;
}

const server = http.createServer(async (req, res) => {
  const reqPath = (req.url || "/").split("?")[0];

  if (reqPath === "/api/health") {
    return healthHandler(req, res);
  }
  if (reqPath === "/api/auth/login") {
    return loginHandler(req, res);
  }
  if (reqPath === "/api/state") {
    return stateHandler(req, res);
  }

  const relPath = reqPath === "/" ? "index.html" : reqPath.replace(/^\/+/, "");
  if (!PUBLIC_FILES.has(relPath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }

  const filePath = path.resolve(PUBLIC_DIR, relPath);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(err.code === "ENOENT" ? "Not Found" : "Server Error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, async () => {
  console.log(`\nBunkSmart Pro is running!`);
  console.log(`  Local:   http://localhost:${PORT}`);
  const lanUrls = getLanUrls(PORT);
  if (lanUrls.length > 0) {
    lanUrls.forEach((url) => console.log(`  Mobile:  ${url}  (same Wi-Fi)`));
  }
  const mongo = await getMongoStatus();
  if (mongo.connected) {
    console.log(`  MongoDB: Connected (${mongo.dbName})`);
  } else if (!mongo.mongoConfigured) {
    console.log(`  MongoDB: Not configured yet (set MONGODB_URI in .env for cross-device sync)`);
  } else {
    console.log(`  MongoDB: Configured (${mongo.error || "driver pending npm install"})`);
  }
  console.log("");
});
