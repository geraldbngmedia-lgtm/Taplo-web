const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

fs.cpSync(
  path.join(root, ".next", "static"),
  path.join(root, ".next", "standalone", ".next", "static"),
  { recursive: true, force: true },
);

const publicDir = path.join(root, "public");
if (fs.existsSync(publicDir)) {
  fs.cpSync(
    publicDir,
    path.join(root, ".next", "standalone", "public"),
    { recursive: true, force: true },
  );
}

console.log("✓ Copied static assets into standalone build");
