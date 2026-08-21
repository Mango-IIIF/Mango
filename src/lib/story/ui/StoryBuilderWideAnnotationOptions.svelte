<script lang="ts">
  import { readable, type Readable } from "svelte/store";
  import LanguageTabs from "../../features/annotations/LanguageTabs.svelte";
  import {
    CHAPTER_ANNOTATION_MOTIVATIONS,
    type ChapterDrawingAnnotation,
    type StoryState,
  } from "../../core/types/story";
  import { t } from "../../core/i18n";

  export let story: Readable<StoryState>;
  export let selectedChapterId: Readable<string | null>;
  export let selectedAnnotationId: Readable<string | null> = readable(null);
  export let language = "en";
  export let languages: string[] = ["en"];
  export let onSetLabel: (
    annotationId: string,
    language: string,
    value: string,
  ) => void = () => {};
  export let onSetStyle: (
    annotationId: string,
    style: {
      color?: string | null;
      strokeWidth?: "thin" | "medium" | "thick";
      fillMode?: ChapterDrawingAnnotation["fillMode"];
      motivation?: ChapterDrawingAnnotation["motivation"] | null;
    },
  ) => void = () => {};

  const palette = [
    "#e07a3f",
    "#f6c343",
    "#39b57e",
    "#3aa0e0",
    "#a06eff",
    "#ef5f7a",
  ];

  let activeLanguage = language;
  $: if (!languages.includes(activeLanguage)) {
    activeLanguage = languages.includes(language) ? language : (languages[0] ?? "en");
  }
  $: chapter =
    $story.chapters.find((entry) => entry.id === $selectedChapterId) ?? null;
  $: selected =
    chapter?.drawingAnnotations?.find(
      (annotation) => annotation.id === $selectedAnnotationId,
    ) ?? null;
</script>

<section class="annotation-options" aria-label={$t("storyBuilder.annotations.edit")}>
  {#if selected}
    <div class="annotation-options__grid">
      <section class="annotation-options__field annotation-options__field--translation">
        <span>{$t("storyBuilder.annotations.translations")}</span>
        <LanguageTabs
          {languages}
          {activeLanguage}
          ariaLabel={$t("storyBuilder.annotations.translations")}
          testIdPrefix="drawing-language"
          onchange={(nextLanguage) => (activeLanguage = nextLanguage)}
        />
        <label class="annotation-options__translation">
          <small>{activeLanguage.toUpperCase()}</small>
          <textarea
            rows="2"
            value={selected.label?.[activeLanguage] ?? ""}
            placeholder={$t("storyBuilder.annotations.textPlaceholder", {
              language: activeLanguage.toUpperCase(),
            })}
            on:input={(event) =>
              onSetLabel(
                selected!.id,
                activeLanguage,
                (event.currentTarget as HTMLTextAreaElement).value,
              )}
          ></textarea>
        </label>
      </section>

      <section class="annotation-options__field">
        <span>{$t("storyBuilder.annotations.colour")}</span>
        <div class="annotation-options__palette">
          {#each palette as color}
            <button
              type="button"
              style={`--annotation-color:${color}`}
              class:annotation-options__swatch--active={(selected.color ?? "#e07a3f") === color}
              aria-label={$t("storyBuilder.annotations.setColour", { colour: color })}
              aria-pressed={(selected.color ?? "#e07a3f") === color}
              on:click={() => onSetStyle(selected!.id, { color })}
            ></button>
          {/each}
          <input
            type="color"
            value={selected.color ?? "#e07a3f"}
            aria-label={$t("storyBuilder.annotations.customColour")}
            on:input={(event) =>
              onSetStyle(selected!.id, {
                color: (event.currentTarget as HTMLInputElement).value,
              })}
          />
        </div>
      </section>

      <div class="annotation-options__appearance">
        {#if selected.type === "rectangle" || selected.type === "polygon"}
          <section class="annotation-options__field annotation-options__field--nested">
            <span>{$t("storyBuilder.annotations.background")}</span>
            <div class="annotation-options__segments annotation-options__segments--two">
              <button
                type="button"
                class:annotation-options__segment--active={selected.fillMode !== "solid"}
                on:click={() =>
                  onSetStyle(selected!.id, { fillMode: "transparent" })}
                >{$t("storyBuilder.annotations.transparent")}</button
              >
              <button
                type="button"
                class:annotation-options__segment--active={selected.fillMode === "solid"}
                on:click={() => onSetStyle(selected!.id, { fillMode: "solid" })}
                >{$t("storyBuilder.annotations.solid")}</button
              >
            </div>
          </section>
        {/if}

        <section class="annotation-options__field annotation-options__field--nested">
          <span>{$t("storyBuilder.annotations.stroke")}</span>
          <div class="annotation-options__segments">
            {#each ["thin", "medium", "thick"] as width}
              <button
                type="button"
                class:annotation-options__segment--active={(selected.strokeWidth ?? "medium") === width}
                on:click={() =>
                  onSetStyle(selected!.id, {
                    strokeWidth: width as "thin" | "medium" | "thick",
                  })}
                >{$t(`storyBuilder.annotations.strokeWidth.${width}`)}</button
              >
            {/each}
          </div>
        </section>
      </div>

      <section class="annotation-options__field">
        <label for="wide-drawing-motivation">
          {$t("storyBuilder.annotations.motivation")}
        </label>
        <select
          id="wide-drawing-motivation"
          value={selected.motivation ?? ""}
          on:change={(event) =>
            onSetStyle(selected!.id, {
              motivation: (event.currentTarget.value ||
                null) as ChapterDrawingAnnotation["motivation"] | null,
            })}
        >
          <option value="">{$t("storyBuilder.annotations.motivationAuto")}</option>
          {#each CHAPTER_ANNOTATION_MOTIVATIONS as motivation}
            <option value={motivation}>
              {$t(`storyBuilder.annotations.motivations.${motivation}`)}
            </option>
          {/each}
        </select>
      </section>
    </div>
  {:else}
    <p class="annotation-options__empty">
      {$t("storyBuilder.annotations.emptySelection")}
    </p>
  {/if}
</section>

<style>
  .annotation-options {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .annotation-options__empty {
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
  }
  .annotation-options__grid {
    display: grid;
    grid-template-columns: minmax(280px, 2fr) minmax(180px, 1fr) minmax(250px, 1.35fr) minmax(190px, 1fr);
    align-items: start;
    min-width: 0;
  }
  .annotation-options__field {
    display: grid;
    align-content: start;
    gap: 6px;
    min-width: 0;
    padding: 0 12px;
    border-left: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
  }
  .annotation-options__field:first-child {
    padding-left: 0;
    border-left: 0;
  }
  .annotation-options__appearance {
    display: grid;
    align-content: start;
    gap: 9px;
    min-width: 0;
    padding: 0 12px;
    border-left: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
  }
  .annotation-options__field--nested {
    padding: 0;
    border-left: 0;
  }
  .annotation-options__field--nested + .annotation-options__field--nested {
    padding-top: 9px;
    border-top: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
  }
  .annotation-options__field > span,
  .annotation-options__field > label {
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .annotation-options__translation {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px;
    align-items: start;
  }
  .annotation-options__translation small {
    padding-top: 9px;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
    font-weight: 700;
  }
  .annotation-options textarea,
  .annotation-options select {
    min-width: 0;
    box-sizing: border-box;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 7px;
    background: var(--viewer-panel, #121922);
    color: inherit;
    font: inherit;
  }
  .annotation-options textarea {
    width: 100%;
    resize: vertical;
  }
  .annotation-options__palette {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }
  .annotation-options__palette button,
  .annotation-options__palette input {
    width: 28px;
    height: 28px;
    box-sizing: border-box;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 50%;
    background: var(--annotation-color);
    cursor: pointer;
  }
  .annotation-options__palette input {
    border-radius: 7px;
    background: transparent;
  }
  .annotation-options__palette .annotation-options__swatch--active {
    border-color: white;
    box-shadow: 0 0 0 2px var(--annotation-color);
  }
  .annotation-options__segments {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .annotation-options__segments--two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .annotation-options__segments button {
    min-width: 0;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 7px 6px;
    background: transparent;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
    cursor: pointer;
  }
  .annotation-options__segments .annotation-options__segment--active {
    border-color: var(--accent, var(--story-builder-accent, #e07a3f));
    background: color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 12%, transparent);
    color: var(--viewer-text, #e8edf4);
  }
  .annotation-options__empty {
    margin: 12px 0;
    text-align: center;
  }
  @media (max-width: 960px) {
    .annotation-options__grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .annotation-options__field {
      padding: 0;
      border-left: 0;
    }
    .annotation-options__appearance {
      padding: 0;
      border-left: 0;
    }
    .annotation-options__field--translation {
      grid-column: 1 / -1;
    }
  }
</style>
