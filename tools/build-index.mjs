import { promises as fs } from "node:fs";
import { glob } from "glob";

const OUT = "data/index.json";

const run = async () => {
  const files = await glob("data/attacks/*/*.json");
  const index = {};

  for (const file of files) {
    const json = JSON.parse(await fs.readFile(file, "utf-8"));
    const cc = file.split("/")[2]; // e.g., JP
    if (!index[cc]) index[cc] = [];
    index[cc].push(json.id);
  }

  // ソート（人間に優しい順）
  for (const k of Object.keys(index)) index[k].sort();

  await fs.writeFile(OUT, JSON.stringify(index, null, 2) + "\n");
  console.log(`✔ Wrote ${OUT}`);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
