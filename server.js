const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
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

const server = http.createServer((req, res) => {
  const reqPath = (req.url || "/").split("?")[0];
  const relPath = reqPath === "/" ? "index.html" : reqPath.replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_DIR, relPath);

  // Prevent directory traversal outside PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== path.join(PUBLIC_DIR, "index.html")) {
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

server.listen(PORT, HOST, () => {
  console.log(`\nBunkSmart Pro is running!`);
  console.log(`  Local:   http://localhost:${PORT}`);
  const lanUrls = getLanUrls(PORT);
  if (lanUrls.length > 0) {
    lanUrls.forEach((url) => console.log(`  Mobile:  ${url}  (same Wi-Fi)`));
  }
  console.log("");
});
