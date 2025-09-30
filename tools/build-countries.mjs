import { promises as fs } from "node:fs";
import { glob } from "glob";

const OUT = "dist/countries.json";

// 最小の国メタ（必要なら将来別ファイル化）
const COUNTRY_META = {
  JP: { country_name_local: "日本", country_name_en: "Japan", regions: ["APAC"], language_codes: ["ja","en"], notes: "教育目的。一般化を意図しない注記。" },
  US: { country_name_local: "United States", country_name_en: "United States", regions: ["AMER"], language_codes: ["en"], notes: "Educational use; does not generalize culture." }
};

const today = () => new Date().toISOString().slice(0,10);

const run = async () => {
  const files = await glob("data/attacks/*/*.json");
  const grouped = {};

  for (const file of files) {
    const cc = file.split("/")[2]; // ISO2
    const obj = JSON.parse(await fs.readFile(file, "utf-8"));
    if (!grouped[cc]) grouped[cc] = [];
    grouped[cc].push(obj);
  }

  const countries = Object.keys(grouped).sort().map(cc => ({
    country_code: cc,
    country_name_local: COUNTRY_META[cc]?.country_name_local ?? cc,
    country_name_en: COUNTRY_META[cc]?.country_name_en ?? cc,
    regions: COUNTRY_META[cc]?.regions ?? [],
    language_codes: COUNTRY_META[cc]?.language_codes ?? ["en"],
    notes: COUNTRY_META[cc]?.notes ?? "",
    attacks: grouped[cc].sort((a,b)=>a.id.localeCompare(b.id))
  }));

  const out = {
    version: "1.0.0",
    last_updated: today(),
    countries
  };

  await fs.mkdir("dist", { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`✔ Wrote ${OUT}`);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
