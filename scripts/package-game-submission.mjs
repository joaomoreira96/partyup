#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  packGameSubmission,
  parsePackCliArgs,
  printPackHelp,
} from "./lib/pack-submission.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const args = parsePackCliArgs(process.argv.slice(2));

if (args.help) {
  printPackHelp();
  process.exit(0);
}

const templateDir =
  args.templateDir ||
  path.join(repoRoot, "scripts", "game-submissions", "partyup-sandbox");

try {
  const result = await packGameSubmission({
    templateDir,
    outFile: args.outFile,
    sdkSource: args.sdkSource,
    repoRoot,
  });

  console.log("Pacote gerado com sucesso.\n");
  console.log(`  Jogo:     ${result.manifest.name} (${result.manifest.slug})`);
  console.log(`  Versão:   ${result.manifest.version}`);
  console.log(`  Ficheiros: ${result.fileCount}`);
  console.log(`  Tamanho:  ${(result.totalBytes / 1024).toFixed(1)} KB`);
  console.log(`  SHA-256:  ${result.checksum}`);
  console.log(`  Output:   ${result.outFile}\n`);
  console.log("Próximos passos:");
  console.log("  1. Admin → Submissões → Upload ZIP");
  console.log("  2. Aprovar → Publicar");
  console.log("  3. Abrir /games/" + result.manifest.slug + "/play");
} catch (err) {
  console.error("Erro:", err instanceof Error ? err.message : err);
  process.exit(1);
}
