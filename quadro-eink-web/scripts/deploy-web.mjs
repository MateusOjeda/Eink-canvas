import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = new Date().toISOString();
const env = {
  ...process.env,
  EXPO_PUBLIC_EINKCANVAS_BUILD_ID: version,
};

console.log(`EinkCanvas: exportando build ${version}`);
execSync("npx expo export --platform web", {
  cwd: root,
  env,
  stdio: "inherit",
});

const dist = join(root, "dist");
if (!existsSync(join(dist, "index.html"))) {
  throw new Error("O export do Expo nao gerou dist/index.html");
}

writeFileSync(
  join(dist, "version.json"),
  `${JSON.stringify({ version })}\n`,
  "utf8",
);

console.log("EinkCanvas: version.json gerado; publicando Hosting...");
execSync("firebase deploy --only hosting", {
  cwd: root,
  stdio: "inherit",
});
console.log(`EinkCanvas: build ${version} publicado.`);
