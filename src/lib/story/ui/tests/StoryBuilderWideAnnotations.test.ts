import { describe, expect, it, vi } from "vitest";
import { mount, unmount } from "svelte";
import { writable } from "svelte/store";
import StoryBuilderWideAnnotations from "../StoryBuilderWideAnnotations.svelte";

describe("StoryBuilderWideAnnotations", () => {
  it("only lists annotations and selects one for sidebar editing", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const onEditDrawing = vi.fn();
    const instance = mount(StoryBuilderWideAnnotations, {
      target,
      props: {
        story: writable({
          chapters: [
            {
              id: "chapter-1",
              manifest: "https://example.org/manifest.json",
              canvasIndex: 0,
              drawingAnnotations: [
                {
                  id: "rectangle-1",
                  type: "rectangle",
                  rect: { x: 10, y: 20, w: 30, h: 40 },
                  label: { en: "A translated label" },
                  fillMode: "solid",
                },
              ],
            },
          ],
        }),
        selectedChapterId: writable("chapter-1"),
        selectedAnnotationId: writable(null),
        onDeleteDrawing: vi.fn(),
        onEditDrawing,
      },
    });

    expect(target.querySelector("input")).toBeNull();
    expect(target.textContent).toContain("A translated label");
    (
      target.querySelector(
        ".story-wide-annotations__select",
      ) as HTMLButtonElement
    ).click();
    expect(onEditDrawing).toHaveBeenCalledWith("rectangle-1");

    unmount(instance);
    target.remove();
  });
});
