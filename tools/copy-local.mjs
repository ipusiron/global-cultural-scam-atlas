/* Copy dist/countries.json into docs/dist/ so that a local HTTP server
 * rooted at docs/ can serve it the same way GitHub Pages does. */
import { promises as fs } from "node:fs";
import path from "node:path";

const SRC = "dist/countries.json";
const DEST_DIR = "docs/dist";
const DEST = path.join(DEST_DIR, "countries.json");

const run = async () => {
  await fs.mkdir(DEST_DIR, { recursive: true });
  await fs.copyFile(SRC, DEST);
  console.log(`✔ Copied ${SRC} → ${DEST}`);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
