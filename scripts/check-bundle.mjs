import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const limits = {
  total: 8 * 1024 * 1024,
  application: 500 * 1024,
  phaser: 1_300 * 1024,
  image: 180 * 1024,
};

async function filesAt(directory, result = []) {
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    const details = await stat(path);
    if (details.isDirectory()) await filesAt(path, result);
    else result.push({ path, name, size: details.size });
  }
  return result;
}

const files = await filesAt(root);
const total = files.reduce((sum, file) => sum + file.size, 0);
const errors = [];
if (total > limits.total) errors.push(`production output is ${(total / 1024 / 1024).toFixed(1)} MB (limit 8 MB)`);
files.forEach((file) => {
  if (/^index-[^.]+\.js$/.test(file.name) && file.size > limits.application) errors.push(`${file.name} exceeds the 500 KB application limit`);
  if (/^phaser-.*\.js$/.test(file.name) && file.size > limits.phaser) errors.push(`${file.name} exceeds the 1.3 MB Phaser limit`);
  if (/\.(?:png|webp|avif|jpe?g)$/i.test(file.name) && file.size > limits.image) errors.push(`${file.name} exceeds the 180 KB image limit`);
});

if (errors.length) {
  console.error(`Bundle budget failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`Bundle budget passed: ${(total / 1024 / 1024).toFixed(1)} MB total, ${files.length} files.`);
