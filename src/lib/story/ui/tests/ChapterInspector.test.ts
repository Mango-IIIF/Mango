import { describe, expect, it, vi } from "vitest";
import { mount, unmount } from "svelte";
import { tick } from "svelte";
import { writable } from "svelte/store";
import ChapterOverlay from "../ChapterOverlay.svelte";
import type { ChapterTaskId } from "../../chapterTasks";
import type { StoryState } from "../../../core/types/story";

/*
 * The inspector is one surface in three groups. There is no dashboard to
 * drill into and nothing to come back from: every section about the selected
 * chapter is stacked under About, Timing or Source, and the sections that
 * work on the stage open their tool in place.
 */
const mountInspector = (
  props: Record<string, unknown> = {},
  storyOverrides: Partial<StoryState> = {},
) => {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const story = writable<StoryState>({
    chapters: [
      {
        id: "chapter-one",
        manifest: "https://example.org/manifest",
        canvasIndex: 0,
        viewBox: { x: 0, y: 0, w: 100, h: 100 },
      },
    ],
    ...storyOverrides,
  });
  const instance = mount(ChapterOverlay, {
    target,
    props: {
      story,
      open: true,
      docked: true,
      chapterId: "chapter-one",
      languages: ["en", "cy"],
      ...props,
    },
  });
  const cleanup = () => {
    unmount(instance);
    target.remove();
  };
  const group = (name: string) =>
    target.querySelector(`[data-testid="inspector-group-${name}"]`) as HTMLButtonElement;
  const section = (id: string) =>
    target.querySelector(`[data-testid="inspector-section-${id}"]`) as HTMLElement | null;
  return { target, story, group, section, cleanup };
};

describe("Chapter inspector", () => {
  it("stacks the chapter's sections under three groups with no back button", async () => {
    const { target, group, section, cleanup } = mountInspector();

    // About is open by default and holds details, the frame and annotations.
    expect(group("about").getAttribute("aria-selected")).toBe("true");
    expect(section("details")?.textContent).toContain("Details");
    expect(section("details")?.textContent).toContain("0/2 languages");
    expect(section("position")?.textContent).toContain("Frame");
    expect(section("focus")?.textContent).toContain("Annotations");
    expect(section("transition-timing")).toBeNull();
    expect(target.querySelector('[data-testid="chapter-title"]')).toBeTruthy();
    expect(target.textContent).not.toContain("Back to chapter tools");

    group("timing").click();
    await tick();
    expect(section("details")).toBeNull();
    expect(section("transition-timing")?.textContent).toContain("Chapter transition time");
    expect(section("audio-timing")?.textContent).toContain("Narration");
    expect(section("audio-timing")?.textContent).toContain("Not configured");
    expect(section("motion")?.textContent).toContain("Motion");
    // An image chapter has no source media to time.
    expect(section("media-timing")).toBeNull();

    group("source").click();
    await tick();
    expect(section("source")?.textContent).toContain("Source");
    expect(target.querySelector('[data-testid="chapter-manifest"]')).toBeTruthy();
    expect(section("layers")?.textContent).toContain("Layers");
    expect(section("comparison")).toBeNull();

    cleanup();
  });

  it("opens a stage tool in place and follows an open tool into its group", async () => {
    const activeChapterTask = writable<ChapterTaskId | null>(null);
    const onChapterTaskChange = vi.fn((task: ChapterTaskId | null) =>
      activeChapterTask.set(task),
    );
    const { group, section, cleanup } = mountInspector({
      activeChapterTask,
      onChapterTaskChange,
    });

    // Closed: a summary and an Edit control, no tools.
    const annotations = section("focus")!;
    expect(annotations.textContent).toContain("0 annotations");
    expect(annotations.querySelector(".chapter-overlay__annotation-tools")).toBeNull();

    (
      annotations.querySelector('[data-testid="inspector-activate-focus"]') as HTMLButtonElement
    ).click();
    await tick();
    expect(onChapterTaskChange).toHaveBeenCalledWith("focus");
    expect(section("focus")?.classList.contains("inspector-section--active")).toBe(true);
    expect(section("focus")?.querySelector(".chapter-overlay__annotation-tools")).toBeNull();
    expect(section("focus")?.textContent).toContain("0 annotations");
    expect(section("focus")?.textContent).toContain("Done");
    // Annotation editing becomes a focused inspector instead of squeezing its
    // properties beneath unrelated chapter sections.
    expect(section("details")).toBeNull();
    expect(group("about")).toBeNull();

    // A tool opened from elsewhere — the annotation list, a keyboard shortcut —
    // pulls the inspector to its group.
    activeChapterTask.set("motion");
    await tick();
    expect(group("timing").getAttribute("aria-selected")).toBe("true");
    expect(section("motion")?.classList.contains("inspector-section--active")).toBe(true);
    expect(section("motion")?.textContent).toContain("Done");

    activeChapterTask.set(null);
    await tick();
    expect(section("motion")?.classList.contains("inspector-section--active")).toBe(false);
    expect(section("motion")?.textContent).toContain("No camera movement");

    cleanup();
  });

  it("summarizes existing annotations before the editor is opened", async () => {
    const { section, cleanup } = mountInspector(
      {},
      {
        chapters: [
          {
            id: "chapter-one",
            manifest: "https://example.org/manifest",
            canvasIndex: 0,
            viewBox: { x: 0, y: 0, w: 100, h: 100 },
            drawingAnnotations: [
              {
                id: "existing-annotation",
                type: "rectangle",
                rect: { x: 10, y: 10, w: 30, h: 20 },
                label: { en: "Existing note" },
              },
            ],
          },
        ],
      },
    );

    const annotations = section("focus")!;
    expect(annotations.textContent).toContain("1 annotations");
    expect(annotations.textContent).toContain("Open");
    expect(annotations.textContent).not.toContain("Draw to add or edit");
    expect(annotations.querySelector(".story-wide-annotations__delete")).toBeNull();
    expect(annotations.querySelector(".story-wide-annotations__select")).toBeNull();

    cleanup();
  });

  it("shows Layers guidance only when expanded and keeps Comparison hidden", async () => {
    const { group, section, cleanup } = mountInspector();
    group("source").click();
    await tick();

    const sections = [
      {
        id: "layers",
        title: "Layers",
        reason: "This source does not currently expose multiple image layers.",
        action: "Choose a layered Manifest in Source.",
      },
    ] as const;

    for (const item of sections) {
      const target = section(item.id)!;
      const toggle = target.querySelector(
        `[data-testid="inspector-toggle-${item.id}"]`,
      ) as HTMLButtonElement;

      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(target.textContent?.trim()).toBe(item.title);

      toggle.click();
      await tick();
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(target.textContent).toContain(item.reason);
      expect(target.textContent).toContain(item.action);
    }
    expect(section("comparison")).toBeNull();
    cleanup();
  });

  it("leaves an open stage tool by Escape without closing the inspector", async () => {
    const activeChapterTask = writable<ChapterTaskId | null>(null);
    const onChapterTaskChange = vi.fn((task: ChapterTaskId | null) =>
      activeChapterTask.set(task),
    );
    const onClose = vi.fn();
    const { cleanup } = mountInspector({ activeChapterTask, onChapterTaskChange, onClose });
    await tick();
    activeChapterTask.set("motion");
    await tick();
    onChapterTaskChange.mockClear();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await tick();
    expect(onChapterTaskChange).toHaveBeenCalledWith(null);
    expect(onClose).not.toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledOnce();
    cleanup();
  });
});
