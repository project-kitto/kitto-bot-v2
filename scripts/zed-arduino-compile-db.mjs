import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const buildDir = path.join(root, "build", "arduino-sesame-s2-mini");
const inputPath = path.join(buildDir, "compile_commands.json");
const outputPath = path.join(root, "compile_commands.json");
const sketchDir = path.join(root, "firmware", "sesame-firmware-main");
const sketchSource = path.join(sketchDir, "sesame-firmware-main.ino");

const db = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const generatedSketch = path.join(
  buildDir,
  "sketch",
  "sesame-firmware-main.ino.cpp",
);

const sketchEntry = db.find((entry) => entry.file === generatedSketch);

if (!sketchEntry) {
  throw new Error(`Unable to find generated sketch entry: ${generatedSketch}`);
}

function entryForSource(sourceFile, language) {
  const args = [...sketchEntry.arguments];
  const sourceIndex = args.indexOf(generatedSketch);

  if (sourceIndex === -1) {
    throw new Error(`Unable to find source argument: ${generatedSketch}`);
  }

  args.splice(sourceIndex, 1, "-x", language, sourceFile);

  const outputIndex = args.indexOf("-o");
  if (outputIndex !== -1 && outputIndex + 1 < args.length) {
    const outputName = `${path.basename(sourceFile)}.o`;
    args[outputIndex + 1] = path.join(buildDir, "sketch", outputName);
  }

  return {
    directory: root,
    arguments: args,
    file: sourceFile,
  };
}

const localHeaders = fs
  .readdirSync(sketchDir)
  .filter((fileName) => fileName.endsWith(".h"))
  .map((fileName) => path.join(sketchDir, fileName));

const augmentedFiles = new Set([sketchSource, ...localHeaders]);
const filteredDb = db.filter((entry) => !augmentedFiles.has(entry.file));
const augmentedDb = [
  ...filteredDb,
  entryForSource(sketchSource, "c++"),
  ...localHeaders.map((header) => entryForSource(header, "c++-header")),
];

fs.writeFileSync(outputPath, `${JSON.stringify(augmentedDb, null, 2)}\n`);
console.log(`Wrote ${outputPath} with ${augmentedDb.length} entries`);
