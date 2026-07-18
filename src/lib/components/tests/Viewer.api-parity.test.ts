import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const exportedFunctions = (source: string): string[] =>
  [...source.matchAll(/export (?:async )?function\s+(\w+)/g)]
    .map((match) => match[1])
    .filter((name) => name !== "setEventTarget")
    .sort();

describe("viewer entrypoint API parity", () => {
  it("keeps the Svelte component and custom element capabilities aligned", () => {
    const component = readFileSync(
      resolve("src/lib/components/Viewer.svelte"),
      "utf8",
    );
    const element = readFileSync(
      resolve("src/lib/components/ViewerElement.svelte"),
      "utf8",
    );

    expect(exportedFunctions(element)).toEqual(exportedFunctions(component));
  });
});
