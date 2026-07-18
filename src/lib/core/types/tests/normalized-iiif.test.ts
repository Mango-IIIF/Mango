import { describe, expect, it } from "vitest";
import { normalizeManifest } from "../normalized-iiif";
import type { ManifestoManifest } from "../../../viewer/iiif/manifestoAdapter";

describe("normalizeManifest", () => {
  it("normalizes manifest, canvas, service, annotation, selector, and range boundaries", () => {
    const parsed: ManifestoManifest = {
      getLabel: () => ({ getValue: () => "Fallback title" }),
      getSequences: () => [
        {
          getCanvases: () => [
            {
              id: "https://example.org/canvas/1",
              getWidth: () => 1000,
              getHeight: () => 800,
              getType: () => "Canvas",
            },
          ],
        },
      ],
    };
    const raw = {
      id: "https://example.org/manifest",
      type: "Manifest",
      label: { en: ["Example"] },
      service: [{ id: "https://example.org/search", type: "SearchService2" }],
      items: [
        {
          id: "https://example.org/canvas/1",
          type: "Canvas",
          items: [
            {
              type: "AnnotationPage",
              items: [
                {
                  id: "https://example.org/annotation/1",
                  motivation: "painting",
                  body: {
                    id: "https://example.org/image.jpg",
                    type: "Image",
                    service: {
                      id: "https://example.org/image",
                      profile: "level2",
                    },
                  },
                  target: {
                    source: "https://example.org/canvas/1",
                    selector: {
                      type: "FragmentSelector",
                      value: "xywh=1,2,3,4",
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
      structures: [
        {
          id: "https://example.org/range/1",
          type: "Range",
          items: ["https://example.org/canvas/1"],
        },
      ],
    };

    const model = normalizeManifest(raw, parsed, "fallback");

    expect(model.id).toBe(raw.id);
    expect(model.label).toBe("Example");
    expect(model.services[0]?.type).toBe("SearchService2");
    expect(model.canvases[0]?.annotations[0]?.bodies[0]?.type).toBe("Image");
    expect(model.canvases[0]?.annotations[0]?.selectors[0]?.value).toBe(
      "xywh=1,2,3,4",
    );
    expect(model.ranges[0]?.items).toEqual(["https://example.org/canvas/1"]);
  });
});
