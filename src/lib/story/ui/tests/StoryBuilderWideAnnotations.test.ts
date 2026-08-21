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
    const select = target.querySelector(
      ".story-wide-annotations__select",
    ) as HTMLButtonElement;
    expect(select.getAttribute("aria-label")).toContain("A translated label");
    expect(
      target
        .querySelector(".story-wide-annotations__delete")
        ?.getAttribute("aria-label"),
    ).toContain("A translated label");
    select.click();
    expect(onEditDrawing).toHaveBeenCalledWith("rectangle-1");

    unmount(instance);
    target.remove();
  });

  it("keeps a busy chapter in one vertical inspector list", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const instance = mount(StoryBuilderWideAnnotations, {
      target,
      props: {
        story: writable({
          chapters: [
            {
              id: "busy-chapter",
              manifest: "https://example.org/manifest.json",
              canvasIndex: 0,
              drawingAnnotations: Array.from({ length: 7 }, (_, index) => ({
                id: `rectangle-${index + 1}`,
                type: "rectangle" as const,
                rect: { x: index * 10, y: index * 10, w: 30, h: 40 },
                label: { en: `Annotation ${index + 1}` },
              })),
            },
          ],
        }),
        selectedChapterId: writable("busy-chapter"),
        selectedAnnotationId: writable(null),
        layout: "inspector",
        onDeleteDrawing: vi.fn(),
        onEditDrawing: vi.fn(),
      },
    });

    expect(target.querySelector(".story-wide-annotations--inspector")).not.toBeNull();
    expect(target.querySelectorAll(".story-wide-annotations__item")).toHaveLength(7);
    expect(target.textContent).toContain("Annotation 7");

    unmount(instance);
    target.remove();
  });
});
