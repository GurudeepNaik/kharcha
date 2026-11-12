// Copies the on-device text reader (tesseract.js worker, its WebAssembly core and the English data) into public/ocr,
// so receipts are read on the phone with nothing loaded from another site. Runs before every build.
import { copyFileSync, mkdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const out = join(process.cwd(), "public", "ocr");
mkdirSync(out, { recursive: true });
const tjs = dirname(require.resolve("tesseract.js/package.json"));
const core = dirname(realpathSync(require.resolve("tesseract.js-core/package.json", { paths: [realpathSync(tjs)] })));
const eng = dirname(require.resolve("@tesseract.js-data/eng/package.json"));
const files = [
  [join(tjs, "dist", "worker.min.js"), "worker.min.js"],
  // The worker picks one of these by what the phone's browser supports; LSTM-only builds are smaller.
  ...["tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-lstm.wasm.js"].map(f => [join(core, f), f]),
  [join(eng, "4.0.0_best_int", "eng.traineddata.gz"), "eng.traineddata.gz"],
];
for (const [from, to] of files) copyFileSync(from, join(out, to));
console.log(`ocr assets: ${files.length} files → public/ocr`);
