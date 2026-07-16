import { derived, type Readable } from "svelte/store";
import type { ResolvedAnnotation } from "../../iiif/annotationResolver";
import {
  resolveMedia,
  type MediaSource,
  type MediaType,
} from "../../iiif/mediaResolver";
import { pluginsStore } from "../../plugins/registry";
import type { ViewerPlugin } from "../../core/types/plugin";
import type { CanvasSummary, ManifestEntry } from "../../state/manifests";
import { manifestsStore } from "../../state/manifests";
import type { ViewBox } from "../../core/types/viewer";
import type { ViewerConfig } from "../../core/types/config";
import { createAnnotationDerivedStores } from "../annotations/derived";
import {
  getCanvasAnnotations,
  hasExternalAnnotationRefs,
} from "../../iiif/annotationResolver";
import {
  resolveManifestAttribution,
  resolveManifestDescription,
  resolveManifestLicence,
  resolveManifestTitle,
  resolveMetadataItems,
  resolveManifestProviders,
  resolveManifestGeoLocation,
  type ManifestAttribution,
  type ManifestMetadataItem,
  type ManifestProvider,
  type ManifestGeoLocation,
} from "../iiif/manifestMetadata";
import { resolveCanvasThumbnail } from "../iiif/thumbnails";
import type { ViewerStateStores } from "./viewerState";
import {
  createViewerAV,
  toViewerMediaSource,
  type ViewerAV,
} from "../av/viewerAV";
import type {
  ActiveLayoutImage,
  RendererComponent,
} from "../../core/types/renderer";
import type { ManifestoManifest } from "../iiif/manifestoAdapter";
import { getManifestCanvases } from "../iiif/manifestoAdapter";

type RendererModule = { default: RendererComponent };
const asRendererModule = (module: unknown): RendererModule =>
  module as RendererModule;

const rendererLoaders: Record<MediaType, () => Promise<RendererModule>> = {
  image: async () =>
    asRendererModule(await import("../../renderers/ImageRenderer.svelte")),
  video: async () =>
    asRendererModule(await import("../../renderers/AVRenderer.svelte")),
  audio: async () =>
    asRendererModule(await import("../../renderers/AVRenderer.svelte")),
  pdf: async () =>
    asRendererModule(await import("../../renderers/PdfRenderer.svelte")),
  model: async () =>
    asRendererModule(await import("../../renderers/ModelRenderer.svelte")),
};

export type PluginSlots = {
  left: ViewerPlugin[];
  right: ViewerPlugin[];
  bottom: ViewerPlugin[];
  overlay: ViewerPlugin[];
};

export type ViewerDerivedStores = {
  av: ViewerAV;
  manifestEntry: Readable<ManifestEntry | undefined>;
  collectionEntry: Readable<ManifestEntry | undefined>;
  canvases: Readable<CanvasSummary[]>;
  canvasThumbnails: Readable<Array<string | null>>;
  mediaSources: Readable<MediaSource[]>;
  mediaSource: Readable<MediaSource | null>;
  mediaType: Readable<MediaType | null>;
  rendererComponent: Readable<RendererComponent | null>;
  annotations: Readable<ResolvedAnnotation[]>;
  overlayAnnotations: Readable<ResolvedAnnotation[]>;
  searchHits: Readable<ResolvedAnnotation[]>;
  highlightIds: Readable<string[]>;
  avChaptersAvailable: Readable<boolean>;
  avTranscriptAvailable: Readable<boolean>;
  contentsAvailable: Readable<boolean>;
  contentsVisible: Readable<boolean>;
  searchAvailable: Readable<boolean>;
  annotationsAvailable: Readable<boolean>;
  galleryAvailable: Readable<boolean>;
  pluginSlots: Readable<PluginSlots>;
  leftVisible: Readable<boolean>;
  rightVisible: Readable<boolean>;
  manifestTitle: Readable<string>;
  manifestDescription: Readable<string>;
  manifestAttribution: Readable<ManifestAttribution>;
  manifestLicence: Readable<string>;
  manifestMetadata: Readable<ManifestMetadataItem[]>;
  manifestProviders: Readable<ManifestProvider[]>;
  manifestGeoLocation: Readable<ManifestGeoLocation | null>;
  uiLocale: Readable<string>;
  metadataLocale: Readable<string>;
  allowThumbnails: Readable<boolean>;
  allowCollection: Readable<boolean>;
  allowMetadata: Readable<boolean>;
  allowSearch: Readable<boolean>;
  allowAnnotations: Readable<boolean>;
  allowTools: Readable<boolean>;
  allowLayers: Readable<boolean>;
  viewBox: Readable<ViewBox | null>;
  activeLayoutImages: Readable<ActiveLayoutImage[]>;
};

const resolveUiLocale = (config?: ViewerConfig): string => {
  if (config?.language) return config.language;
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return "en";
};

const toMetadataLocale = (value: string): string =>
  value.split("-")[0] || value;

const normaliseArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const hasSearchProfile = (profile: unknown): boolean => {
  if (!profile) return false;
  const target = "http://iiif.io/api/search/0/search";
  if (typeof profile === "string") return profile === target;
  if (Array.isArray(profile)) {
    return profile.some((entry) => hasSearchProfile(entry));
  }
  if (typeof profile === "object") {
    const value =
      (profile as { id?: string; "@id"?: string }).id ??
      (profile as { "@id"?: string })["@id"];
    return value === target;
  }
  return false;
};

const hasSearchService = (manifestJson: unknown): boolean => {
  if (!manifestJson || typeof manifestJson !== "object") return false;
  const record = manifestJson as Record<string, unknown>;
  // Try to get services from manifesto object first
  let services;
  if (typeof record.getProperty === "function") {
    services = normaliseArray(
      record.getProperty.call(manifestJson, "service") ??
        record.getProperty.call(manifestJson, "services"),
    );
  } else {
    services = normaliseArray(record.service ?? record.services);
  }
  return services.some((service) => {
    if (!service || typeof service !== "object") return false;
    const serviceRecord = service as Record<string, unknown>;
    const profile = serviceRecord.profile ?? serviceRecord["@profile"];
    return hasSearchProfile(profile);
  });
};

const hasManifestAnnotations = (
  manifestoObject: ManifestoManifest | undefined,
  canvases: CanvasSummary[],
): boolean => {
  if (!manifestoObject || canvases.length === 0) return false;

  // Get the actual canvas objects from manifesto once (optimization)
  const manifestoCanvases = getManifestCanvases(manifestoObject);

  return canvases.some((canvas, index) => {
    // First check for inline annotations that are immediately available
    const items = getCanvasAnnotations(
      manifestoObject,
      canvas.id,
      canvas.index,
    );
    if (items.length > 0) return true;

    // Also check if this canvas has external annotation references
    // This is important for v2 manifests where annotations are often external
    const manifestoCanvas = manifestoCanvases[index];
    if (manifestoCanvas && hasExternalAnnotationRefs(manifestoCanvas)) {
      return true;
    }

    return false;
  });
};

const countImageCanvases = (
  manifestoObject: ManifestoManifest | undefined,
  canvases: CanvasSummary[],
): number => {
  if (!manifestoObject || canvases.length === 0) return 0;
  return canvases.filter((canvas) => {
    const resolved = resolveMedia(manifestoObject, canvas.id, canvas.index);
    return resolved.primary?.type === "image";
  }).length;
};

export const createViewerDerived = (
  state: ViewerStateStores,
): ViewerDerivedStores => {
  const av = createViewerAV(state);
  const manifestEntry = derived(
    [manifestsStore, state.manifestId],
    ([$manifestsStore, manifestId]) =>
      manifestId ? $manifestsStore[manifestId] : undefined,
  );

  const collectionEntry = derived(
    [manifestsStore, state.collectionId],
    ([$manifestsStore, collectionId]) =>
      collectionId ? $manifestsStore[collectionId] : undefined,
  );

  const canvases = derived(manifestEntry, (entry) => entry?.canvases ?? []);

  const uiLocale = derived(state.config, (config) => resolveUiLocale(config));
  const metadataLocale = derived(uiLocale, (locale) =>
    toMetadataLocale(locale),
  );

  const canvasThumbnails = derived(
    [manifestEntry, canvases],
    ([entry, list]) => {
      if (!entry?.manifesto || list.length === 0) return [];
      return list.map((canvas) =>
        resolveCanvasThumbnail(entry.manifesto, canvas.id, canvas.index),
      );
    },
  );

  const mediaSources = derived(
    [manifestEntry, canvases, state.selectedCanvasIndex, av.manifest],
    ([entry, list, index, avManifest]) => {
      if (!entry?.manifesto || list.length === 0) return [];
      const canvas = list[index];
      const avCanvas = avManifest?.canvases.find(
        (item) => item.id === canvas?.id,
      );
      if (avCanvas?.sources.length) {
        return avCanvas.sources.map((source) =>
          toViewerMediaSource(source, avCanvas),
        );
      }
      const resolved = resolveMedia(entry.manifesto, canvas?.id, index);
      if (
        resolved.primary?.type === "audio" ||
        resolved.primary?.type === "video"
      ) {
        return [];
      }
      return resolved.primary ? [resolved.primary, ...resolved.alternates] : [];
    },
  );

  const activeLayoutImages = derived(
    [manifestEntry, canvases, state.selectedCanvasIndex, state.layoutMode],
    ([entry, list, index, layoutMode]) => {
      if (!entry?.manifesto || list.length === 0) return [];

      const getCanvasImage = (canvasIndex: number) => {
        const canvas = list[canvasIndex];
        if (!canvas) return null;
        const resolved = resolveMedia(entry.manifesto, canvas.id, canvasIndex);
        if (!resolved.primary) return null;
        return {
          source: resolved.primary,
          layers: resolved.alternates,
          index: canvasIndex,
          id: canvas.id,
          width: canvas.width || resolved.primary.width || 1000,
          height: canvas.height || resolved.primary.height || 1500,
        };
      };

      if (layoutMode === "two-page") {
        if (index === 0) {
          // Cover page
          const cover = getCanvasImage(0);
          return cover ? [cover] : [];
        }
        // Pairing subsequent pages: (1, 2), (3, 4), (5, 6), etc.
        const leftIndex = index % 2 === 1 ? index : index - 1;
        const rightIndex = leftIndex + 1;

        const leftImg = getCanvasImage(leftIndex);
        const rightImg = getCanvasImage(rightIndex);

        const result = [];
        if (leftImg) result.push(leftImg);
        if (rightImg) result.push(rightImg);
        return result;
      }

      if (layoutMode === "continuous") {
        const result = [];
        for (let i = 0; i < list.length; i++) {
          const img = getCanvasImage(i);
          if (img) result.push(img);
        }
        return result;
      }

      // Default/single mode
      const primary = getCanvasImage(index);
      return primary ? [primary] : [];
    },
  );

  const mediaSource = derived(
    [mediaSources, state.selectedMediaIndex],
    ([sources, index]) => sources[index] ?? null,
  );

  const mediaType = derived(mediaSource, (source) => source?.type ?? null);

  const rendererComponent = derived<
    Readable<MediaType | null>,
    RendererComponent | null
  >(
    mediaType,
    (type, set) => {
      let cancelled = false;
      set(null);
      if (!type)
        return () => {
          cancelled = true;
        };
      void rendererLoaders[type]().then((module) => {
        if (!cancelled) set(module.default);
      });
      return () => {
        cancelled = true;
      };
    },
    null,
  );

  const { annotations, searchHits, overlayAnnotations, highlightIds } =
    createAnnotationDerivedStores({ manifestEntry, canvases, state });

  const avChaptersAvailable = derived(
    av.manifest,
    (manifest) => (manifest?.chapters.length ?? 0) > 0,
  );

  const avTranscriptAvailable = derived(
    [av.manifest, canvases, state.selectedCanvasIndex],
    ([manifest, list, index]) => {
      const canvasId = list[index]?.id;
      if (!manifest || !canvasId) return false;
      return Boolean(
        manifest.canvases.find((canvas) => canvas.id === canvasId)?.transcripts
          .length,
      );
    },
  );

  const contentsAvailable = derived(
    [avChaptersAvailable, avTranscriptAvailable, mediaType],
    ([chapters, transcript, type]) =>
      (type === "audio" || type === "video") && (chapters || transcript),
  );

  const contentsVisible = derived(
    [state.showContents, contentsAvailable],
    ([show, available]) => show && available,
  );

  const searchAvailable = derived(manifestEntry, (entry) =>
    hasSearchService(entry?.manifesto ?? entry?.json),
  );

  const annotationsAvailable = derived(
    [manifestEntry, canvases],
    ([entry, list]) => hasManifestAnnotations(entry?.manifesto, list),
  );

  const imageCanvasCount = derived([manifestEntry, canvases], ([entry, list]) =>
    countImageCanvases(entry?.manifesto, list),
  );

  const galleryAvailable = derived(
    [mediaType, imageCanvasCount],
    ([type, count]) => type === "image" && count > 1,
  );

  const allowThumbnails = derived(
    [state.config, galleryAvailable],
    ([config, available]) => config?.showThumbnails !== false && available,
  );
  const allowCollection = derived(
    [state.config, collectionEntry],
    ([config, entry]) =>
      config?.showCollection !== false &&
      entry?.resourceType === "collection" &&
      Boolean(entry.json),
  );
  const allowMetadata = derived(
    state.config,
    (config) => config?.showMetadata !== false,
  );
  const allowSearch = derived(
    [state.config, searchAvailable],
    ([config, available]) => config?.showSearch !== false && available,
  );
  const allowAnnotations = derived(
    [state.config, annotationsAvailable],
    ([config, available]) =>
      config?.showAnnotations !== false &&
      (available || config?.allowCreateMode === true),
  );
  const allowTools = derived(
    [state.config, mediaType],
    ([config, type]) => config?.showTools !== false && type === "image",
  );

  const allowLayers = derived(
    [state.config, mediaSources],
    ([config, sources]) => {
      return (
        config?.showLayers !== false &&
        sources.length > 1 &&
        sources.every((src) => src.type === "image")
      );
    },
  );

  const pluginSlots = derived(
    [pluginsStore, state.plugins],
    ([$pluginsStore, plugins]) => {
      const deduped = new Map<string, ViewerPlugin>();
      for (const plugin of [...$pluginsStore, ...plugins]) {
        if (!plugin?.id) continue;
        deduped.set(plugin.id, plugin);
      }
      const allPlugins = Array.from(deduped.values());
      return {
        left: allPlugins.filter((plugin) => plugin.slot === "left"),
        right: allPlugins.filter((plugin) => plugin.slot === "right"),
        bottom: allPlugins.filter((plugin) => plugin.slot === "bottom"),
        overlay: allPlugins.filter((plugin) => plugin.slot === "overlay"),
      };
    },
  );

  const leftVisible = derived(
    [
      state.showCollection,
      allowCollection,
      state.showSearch,
      allowSearch,
      state.showAnnotations,
      allowAnnotations,
      contentsVisible,
      state.showMetadata,
      state.showTools,
      state.showSettings,
      allowTools,
      state.showLayers,
      allowLayers,
      pluginSlots,
    ],
    ([
      showCollection,
      allowCollectionValue,
      showSearch,
      allowSearchValue,
      showAnnotations,
      allowAnnotationsValue,
      showContents,
      showMetadata,
      showTools,
      showSettings,
      allowToolsValue,
      showLayersValue,
      allowLayersValue,
      slots,
    ]) =>
      (showCollection && allowCollectionValue) ||
      (showSearch && allowSearchValue) ||
      (showAnnotations && allowAnnotationsValue) ||
      showContents ||
      showMetadata ||
      showSettings ||
      (showTools && allowToolsValue) ||
      (showLayersValue && allowLayersValue) ||
      slots.left.length > 0,
  );

  const rightVisible = derived(pluginSlots, (slots) => slots.right.length > 0);

  const manifestTitle = derived(
    [manifestEntry, metadataLocale],
    ([entry, locale]) =>
      resolveManifestTitle(entry?.manifesto, entry?.json, locale),
  );

  const manifestDescription = derived(
    [manifestEntry, metadataLocale],
    ([entry, locale]) =>
      resolveManifestDescription(entry?.manifesto, entry?.json, locale),
  );

  const manifestAttribution = derived(
    [manifestEntry, metadataLocale],
    ([entry, locale]) =>
      resolveManifestAttribution(entry?.manifesto, entry?.json, locale),
  );

  const manifestLicence = derived(
    [manifestEntry, metadataLocale],
    ([entry, locale]) =>
      resolveManifestLicence(entry?.manifesto, entry?.json, locale),
  );

  const manifestMetadata = derived(
    [manifestEntry, metadataLocale],
    ([entry, locale]) =>
      resolveMetadataItems(entry?.manifesto, entry?.json, locale),
  );

  const manifestProviders = derived(
    [manifestEntry, metadataLocale],
    ([entry, locale]) => {
      const providers = resolveManifestProviders(
        entry?.manifesto,
        entry?.json,
        locale,
      );
      return providers;
    },
  );

  const manifestGeoLocation = derived(
    [manifestEntry, metadataLocale],
    ([entry, locale]) =>
      resolveManifestGeoLocation(entry?.manifesto, entry?.json, locale),
  );

  const viewBox = derived(state.viewBox, (value) => value);

  return {
    av,
    manifestEntry,
    collectionEntry,
    canvases,
    canvasThumbnails,
    mediaSources,
    mediaSource,
    mediaType,
    rendererComponent,
    annotations,
    overlayAnnotations,
    searchHits,
    highlightIds,
    avChaptersAvailable,
    avTranscriptAvailable,
    contentsAvailable,
    contentsVisible,
    searchAvailable,
    annotationsAvailable,
    galleryAvailable,
    pluginSlots,
    leftVisible,
    rightVisible,
    manifestTitle,
    manifestDescription,
    manifestAttribution,
    manifestLicence,
    manifestMetadata,
    manifestProviders,
    manifestGeoLocation,
    uiLocale,
    metadataLocale,
    allowThumbnails,
    allowCollection,
    allowMetadata,
    allowSearch,
    allowAnnotations,
    allowTools,
    allowLayers,
    viewBox,
    activeLayoutImages,
  };
};
