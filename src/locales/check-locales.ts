import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "svelte/compiler";

type MessageTree =
  string | number | boolean | null | { [key: string]: MessageTree };
type FlatMessages = Map<string, MessageTree>;

type HardcodedIssue = {
  file: string;
  line: number;
  column: number;
  kind: "attribute" | "message" | "text";
  value: string;
};

const localeDirectory = dirname(fileURLToPath(import.meta.url));
const sourceDirectory = resolve(localeDirectory, "../lib");
const projectDirectory = resolve(localeDirectory, "../..");
const reportOnly = process.argv.includes("--report-only");

const translatableAttributes = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "label",
  "placeholder",
  "title",
]);

const localeNeutralText = new Set(["i", "T"]);

const normaliseText = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const isLocaleNeutral = (value: string): boolean => {
  const text = normaliseText(value);
  if (!text || localeNeutralText.has(text)) return true;
  if (/^(?:https?:\/\/|mailto:|urn:)/i.test(text)) return true;
  if (/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(text)) return true;
  return !/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(text);
};

const locationFor = (source: string, offset: number) => {
  const before = source.slice(0, offset);
  const lines = before.split("\n");
  return { line: lines.length, column: lines.at(-1)!.length + 1 };
};

const staticAttributeValue = (
  attribute: Record<string, unknown>,
): string | null => {
  const value = attribute.value;
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    (value as { type?: string }).type === "Text"
  ) {
    return String((value as { data?: unknown }).data ?? "");
  }
  if (Array.isArray(value) && value.length === 1 && value[0]?.type === "Text") {
    return String(value[0].data ?? "");
  }
  return null;
};

const directMessageSink =
  /\b(?:alert|confirm|setError)\s*\(\s*(['"`])([^'"`]*[A-Za-zÀ-ÖØ-öø-ÿ][^'"`]*)\1/g;

const scanScriptFile = (file: string, source: string): HardcodedIssue[] => {
  const issues: HardcodedIssue[] = [];
  const addMatches = (pattern: RegExp) => {
    for (const match of source.matchAll(pattern)) {
      const value = normaliseText(match[2]);
      if (isLocaleNeutral(value)) continue;
      issues.push({
        file: relative(projectDirectory, file),
        ...locationFor(source, (match.index ?? 0) + match[0].indexOf(match[2])),
        kind: "message",
        value,
      });
    }
  };

  addMatches(directMessageSink);
  addMatches(
    /\b(?:label|title|description|placeholder|message|reason|action)\s*:\s*(['"`])([^'"`]*[A-Za-zÀ-ÖØ-öø-ÿ][^'"`]*)\1/g,
  );
  return issues;
};

const scanSvelteFile = (file: string, source: string): HardcodedIssue[] => {
  const issues: HardcodedIssue[] = [];
  const addIssue = (
    kind: HardcodedIssue["kind"],
    value: string,
    offset: number,
  ) => {
    const text = normaliseText(value);
    if (isLocaleNeutral(text)) return;
    issues.push({
      file: relative(projectDirectory, file),
      ...locationFor(source, offset),
      kind,
      value: text,
    });
  };

  const ast = parse(source, { modern: true }) as unknown as {
    fragment: Record<string, unknown>;
  };

  const scanMarkup = (node: unknown, insideAttribute = false): void => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.type === "Text" && !insideAttribute) {
      addIssue("text", String(record.data ?? ""), Number(record.start ?? 0));
      return;
    }
    for (const [key, child] of Object.entries(record)) {
      if (key === "expression" || key === "metadata") continue;
      const childInsideAttribute = insideAttribute || key === "attributes";
      if (Array.isArray(child)) {
        child.forEach((entry) => scanMarkup(entry, childInsideAttribute));
      } else if (child && typeof child === "object") {
        scanMarkup(child, childInsideAttribute);
      }
    }
  };

  const scanAttributes = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (
      record.type === "Attribute" &&
      translatableAttributes.has(String(record.name))
    ) {
      const value = staticAttributeValue(record);
      if (value !== null)
        addIssue("attribute", value, Number(record.start ?? 0));
    }
    for (const [key, child] of Object.entries(record)) {
      if (key === "metadata") continue;
      if (Array.isArray(child)) child.forEach(scanAttributes);
      else if (child && typeof child === "object") scanAttributes(child);
    }
  };

  scanMarkup(ast.fragment);
  scanAttributes(ast.fragment);

  // These calls feed text directly into the rendered UI. Broader string-literal
  // scanning produces class names, event names, IDs, and IIIF vocabulary rather
  // than useful localization findings.
  for (const match of source.matchAll(directMessageSink)) {
    addIssue(
      "message",
      match[2],
      (match.index ?? 0) + match[0].indexOf(match[2]),
    );
  }

  return issues;
};

const applicationFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "tests") return [];
        return applicationFiles(path);
      }
      if (/\.(?:test|spec)\.[cm]?[jt]s$/.test(entry.name)) return [];
      return extname(entry.name) === ".svelte" ||
        (extname(entry.name) === ".ts" && !entry.name.endsWith(".d.ts"))
        ? [path]
        : [];
    }),
  );
  return files.flat();
};

const flatten = (
  tree: MessageTree,
  prefix = "",
  result: FlatMessages = new Map(),
): FlatMessages => {
  if (tree !== null && typeof tree === "object" && !Array.isArray(tree)) {
    for (const [key, value] of Object.entries(tree)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, result);
    }
  } else {
    result.set(prefix, tree);
  }
  return result;
};

const placeholders = (value: MessageTree): string[] => {
  if (typeof value !== "string") return [];
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
};

const valueType = (value: MessageTree | undefined): string =>
  value === null ? "null" : Array.isArray(value) ? "array" : typeof value;

const printList = (heading: string, entries: string[]) => {
  if (entries.length === 0) return;
  console.log(`\n  ${heading} (${entries.length})`);
  entries.forEach((entry) => console.log(`    - ${entry}`));
};

const run = async () => {
  const files = await applicationFiles(sourceDirectory);
  const hardcoded: HardcodedIssue[] = [];
  for (const file of files.sort()) {
    const source = await readFile(file, "utf8");
    if (extname(file) === ".ts") {
      hardcoded.push(...scanScriptFile(file, source));
      continue;
    }
    try {
      hardcoded.push(...scanSvelteFile(file, source));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `Unable to parse ${relative(projectDirectory, file)}: ${message}`,
      );
      process.exitCode = 1;
    }
  }

  console.log("Hard-coded interface text");
  if (hardcoded.length === 0) {
    console.log("  No hard-coded interface strings found.");
  } else {
    hardcoded.forEach((issue) => {
      console.log(
        `  ${issue.file}:${issue.line}:${issue.column} [${issue.kind}] ${JSON.stringify(issue.value)}`,
      );
    });
  }

  const localeFiles = (await readdir(localeDirectory))
    .filter((file) => file.endsWith(".json"))
    .sort();
  if (!localeFiles.includes("en.json"))
    throw new Error("src/locales/en.json is required");

  const catalogues = new Map<string, FlatMessages>();
  for (const file of localeFiles) {
    const contents = JSON.parse(
      await readFile(resolve(localeDirectory, file), "utf8"),
    ) as MessageTree;
    catalogues.set(file.replace(/\.json$/, ""), flatten(contents));
  }

  const english = catalogues.get("en")!;
  let localeIssueCount = 0;
  console.log("\nLocale catalogue synchronization");
  for (const [locale, messages] of catalogues) {
    if (locale === "en") continue;
    const missing = [...english.keys()]
      .filter((key) => !messages.has(key))
      .sort();
    const extra = [...messages.keys()]
      .filter((key) => !english.has(key))
      .sort();
    const typeMismatches = [...english.keys()]
      .filter(
        (key) =>
          messages.has(key) &&
          valueType(messages.get(key)) !== valueType(english.get(key)),
      )
      .map(
        (key) =>
          `${key} (English: ${valueType(english.get(key))}, ${locale}: ${valueType(messages.get(key))})`,
      );
    const placeholderMismatches = [...english.keys()]
      .filter((key) => messages.has(key))
      .filter(
        (key) =>
          placeholders(messages.get(key)).join(",") !==
          placeholders(english.get(key)).join(","),
      )
      .map(
        (key) =>
          `${key} (English: {${placeholders(english.get(key)).join("}, {")}}, ${locale}: {${placeholders(messages.get(key)).join("}, {")}})`,
      );

    const count =
      missing.length +
      extra.length +
      typeMismatches.length +
      placeholderMismatches.length;
    localeIssueCount += count;
    console.log(
      `\n${locale}: ${count === 0 ? "in sync" : `${count} issue(s)`}`,
    );
    printList("Missing translations", missing);
    printList("Keys not present in English", extra);
    printList("Value type mismatches", typeMismatches);
    printList("Placeholder mismatches", placeholderMismatches);
  }

  const totalIssues =
    hardcoded.length + localeIssueCount + (process.exitCode ?? 0);
  console.log(
    `\nSummary: ${hardcoded.length} hard-coded string(s), ${localeIssueCount} locale issue(s).`,
  );
  if (totalIssues > 0 && !reportOnly) process.exitCode = 1;
};

await run();
