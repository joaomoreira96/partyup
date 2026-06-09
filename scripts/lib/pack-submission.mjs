import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { createSolidPng } from "./create-solid-png.mjs";

const REQUIRED_FILES = [
  "manifest.json",
  "thumbnail.png",
  "banner.png",
  "build/index.html",
  "build/partyup-sdk.js",
];

const FORBIDDEN_PATH_RE =
  /(^|\/)(migrations|__MACOSX|node_modules|\.git)(\/|$)|\.DS_Store$/i;

function parseArgs(argv) {
  const opts = {
    templateDir: "",
    outFile: "",
    sdkSource: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--template" || arg === "-t") {
      opts.templateDir = argv[++i] ?? "";
    } else if (arg === "--out" || arg === "-o") {
      opts.outFile = argv[++i] ?? "";
    } else if (arg === "--sdk" || arg === "-s") {
      opts.sdkSource = argv[++i] ?? "";
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else if (!arg.startsWith("-") && !opts.templateDir) {
      opts.templateDir = arg;
    }
  }

  return opts;
}

function walkFiles(dir, base = dir) {
  /** @type {{ relativePath: string, absolutePath: string }[]} */
  const entries = [];

  for (const name of fs.readdirSync(dir)) {
    const absolutePath = path.join(dir, name);
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      entries.push(...walkFiles(absolutePath, base));
      continue;
    }
    const relativePath = path.relative(base, absolutePath).replace(/\\/g, "/");
    entries.push({ relativePath, absolutePath });
  }

  return entries;
}

function validateManifest(manifest) {
  const required = [
    "name",
    "slug",
    "version",
    "author",
    "sdkVersion",
    "minPlayers",
    "maxPlayers",
    "supportsDesktop",
    "supportsTablet",
    "supportsMobile",
  ];
  for (const key of required) {
    if (manifest[key] === undefined || manifest[key] === null || manifest[key] === "") {
      throw new Error(`manifest.json: campo em falta "${key}"`);
    }
  }
  if (manifest.sdkVersion !== "1.0") {
    throw new Error(`manifest.json: sdkVersion "${manifest.sdkVersion}" não suportada (use 1.0)`);
  }
  return manifest;
}

function ensurePlaceholderAssets(templateDir) {
  const thumbPath = path.join(templateDir, "thumbnail.png");
  const bannerPath = path.join(templateDir, "banner.png");

  if (!fs.existsSync(thumbPath)) {
    fs.writeFileSync(thumbPath, createSolidPng(512, 512, [99, 102, 241, 255]));
  }
  if (!fs.existsSync(bannerPath)) {
    fs.writeFileSync(bannerPath, createSolidPng(1200, 630, [79, 70, 229, 255]));
  }
}

function syncPartyUpSdk(templateDir, sdkSource) {
  const dest = path.join(templateDir, "build", "partyup-sdk.js");
  if (!fs.existsSync(sdkSource)) {
    throw new Error(`partyup-sdk.js não encontrado: ${sdkSource}`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(sdkSource, dest);
}

export async function packGameSubmission(options) {
  const templateDir = path.resolve(options.templateDir);
  const sdkSource = path.resolve(
    options.sdkSource || path.join(options.repoRoot, "public", "partyup-sdk.js")
  );

  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template não encontrado: ${templateDir}`);
  }

  syncPartyUpSdk(templateDir, sdkSource);
  ensurePlaceholderAssets(templateDir);

  const manifestPath = path.join(templateDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error("manifest.json em falta no template");
  }

  const manifest = validateManifest(
    JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  );

  const files = walkFiles(templateDir).filter(({ relativePath }) => {
    if (FORBIDDEN_PATH_RE.test(relativePath)) return false;
    return !relativePath.startsWith(".");
  });

  const relativePaths = new Set(files.map((f) => f.relativePath));
  for (const required of REQUIRED_FILES) {
    if (!relativePaths.has(required)) {
      throw new Error(`Ficheiro obrigatório em falta: ${required}`);
    }
  }

  const zip = new JSZip();
  let totalBytes = 0;

  for (const { relativePath, absolutePath } of files) {
    const content = fs.readFileSync(absolutePath);
    totalBytes += content.length;
    zip.file(relativePath, content);
  }

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const checksum = createHash("sha256").update(zipBuffer).digest("hex");
  const defaultOut = path.join(
    options.repoRoot,
    "dist",
    "submissions",
    `${manifest.slug}-${manifest.version}.zip`
  );
  const outFile = path.resolve(options.outFile || defaultOut);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, zipBuffer);

  return {
    outFile,
    manifest,
    checksum,
    totalBytes: zipBuffer.length,
    fileCount: files.length,
  };
}

export function printPackHelp() {
  console.log(`
Empacota um template V2 num ZIP pronto para upload no admin PartyUp.

Uso:
  node scripts/package-game-submission.mjs [opções] [pasta-template]

Opções:
  -t, --template <dir>   Pasta do jogo (default: scripts/game-submissions/partyup-sandbox)
  -o, --out <ficheiro>   Caminho do ZIP de saída
  -s, --sdk <ficheiro>   Origem do partyup-sdk.js (default: public/partyup-sdk.js)
  -h, --help             Ajuda

Exemplos:
  npm run package:sandbox
  node scripts/package-game-submission.mjs -t scripts/game-submissions/partyup-sandbox
`);
}

export function parsePackCliArgs(argv) {
  return parseArgs(argv);
}
