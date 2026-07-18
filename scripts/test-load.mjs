import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const javaHomes = [
  process.env.JAVA_HOME,
  "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
  "/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home",
  "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
  "/usr/local/opt/openjdk/libexec/openjdk.jdk/Contents/Home",
].filter(Boolean);
const javaHome = javaHomes.find((home) => existsSync(join(home, "bin", "java")));
const environment = {
  ...process.env,
  LOAD_USERS: process.env.LOAD_USERS || "20",
  LOAD_ROOM_SIZE: process.env.LOAD_ROOM_SIZE || "10",
  LOAD_TIMEOUT_MS: process.env.LOAD_TIMEOUT_MS || "120000",
};
if (javaHome) {
  environment.JAVA_HOME = javaHome;
  environment.PATH = `${join(javaHome, "bin")}:${environment.PATH || ""}`;
}

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, [
  "-y",
  "firebase-tools@15.24.0",
  "emulators:exec",
  "--only",
  "auth,firestore",
  "--project",
  "demo-youcat-loadtest",
  "node scripts/load-test.mjs",
], {
  cwd: new URL("..", import.meta.url),
  env: environment,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
