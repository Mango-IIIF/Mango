<script lang="ts">
  import { stopPropagation } from 'svelte/legacy';

  import { onMount } from 'svelte';
  import type OpenSeadragon from 'openseadragon';
  import { t } from '../i18n';
  import type { ResolvedAnnotation } from '../iiif/annotationResolver';
  import type { TileSource, MediaSource } from '../iiif/mediaResolver';
  import type { ImageFilters } from '../core/types/filters';
  import type { ViewBox } from '../core/types/viewer';
  import type { ViewerConfig } from '../core/types/config';
  import { applyIIIFExactTileLevelWorkaround } from '../viewer/osd/iiifTileSourceWorkaround';
  import type { ActiveLayoutImage } from '../core/types/renderer';

  interface Props {
    tileSource?: TileSource | null;
    layers?: MediaSource[];
    layerOpacities?: Record<string, number>;
    annotations?: ResolvedAnnotation[];
    highlightIds?: string[];
    activeAnnotationId?: string | null;
    hoverAnnotationId?: string | null;
    layoutMode?: 'single' | 'two-page' | 'continuous';
    activeLayoutImages?: ActiveLayoutImage[];
    osdConfig?: Record<string, unknown>;
    legacyOsdConfig?: ViewerConfig['osd'];
    rotation?: number;
    initialViewBox?: ViewBox | null;
    onzoomchange?:
      | ((payload: { zoom: number; viewBox: ViewBox; homeZoom?: number }) => void)
      | undefined;
    onviewboxchange?: ((payload: { viewBox: ViewBox }) => void) | undefined;
    onannotationhover?: ((payload: { id: string | null }) => void) | undefined;
    onannotationselect?: ((payload: { id: string }) => void) | undefined;
    onannotationclear?: (() => void) | undefined;
    onrotationchange?: ((payload: { rotation: number }) => void) | undefined;
    onviewerready?: ((payload: { viewer: OpenSeadragon.Viewer }) => void) | undefined;
  }

  let {
    tileSource = null,
    layers = [],
    layerOpacities = {},
    annotations = [],
    highlightIds = [],
    activeAnnotationId = null,
    hoverAnnotationId = null,
    layoutMode = 'single',
    activeLayoutImages = [],
    osdConfig = {},
    legacyOsdConfig = undefined,
    rotation = 0,
    initialViewBox = null,
    onzoomchange = undefined,
    onviewboxchange = undefined,
    onannotationhover = undefined,
    onannotationselect = undefined,
    onannotationclear = undefined,
    onrotationchange = undefined,
    onviewerready = undefined,
  }: Props = $props();

  type Bounds = { x: number; y: number; width: number; height: number };

  type RenderedAnnotation = {
    id: string;
    type: 'rect' | 'point' | 'polygon' | 'polyline';
    rect?: { x: number; y: number; width: number; height: number };
    point?: { x: number; y: number };
    points?: string;
    bounds: Bounds;
    isHighlight: boolean;
    text?: string;
    label?: string;
    className?: string;
    style?: string;
  };

  let container: HTMLDivElement | null = $state(null);
  let viewer: OpenSeadragon.Viewer | null = $state(null);
  let OpenSeadragonClass: typeof OpenSeadragon | null = null;
  const tiledImageLayerIds = new WeakMap<OpenSeadragon.TiledImage, string>();
  let baseImageLoaded = $state(false);
  let rendered: RenderedAnnotation[] = $state([]);
  let lastViewBox: ViewBox | null = null;
  let lastZoom = 0;
  let initialViewBoxApplied = false;
  let filterCss = $state('none');
  let tooltip: {
    id: string;
    text: string;
    x: number;
    y: number;
    maxWidth: number;
  } | null = $state(null);
  let fallbackText = $derived($t('viewer.panels.annotations.fallback'));
  let renderFrameId: number | null = null;

  const buildFilterCss = (filters: ImageFilters): string => {
    const parts: string[] = [];
    if (filters.brightness !== 100) {
      parts.push(`brightness(${filters.brightness / 100})`);
    }
    if (filters.contrast !== 100) {
      parts.push(`contrast(${filters.contrast / 100})`);
    }
    if (filters.saturation !== 100) {
      parts.push(`saturate(${filters.saturation / 100})`);
    }
    if (filters.invert) {
      parts.push('invert(1)');
    }
    if (filters.grayscale) {
      parts.push('grayscale(1)');
    }
    return parts.length > 0 ? parts.join(' ') : 'none';
  };

  const LAYER_COLORS: Record<string, string> = {
    research: '#facc15',
    transcription: '#60a5fa',
    highlights: '#34d399',
    mine: '#a78bfa',
  };
  const DEFAULT_LAYER_COLOR = '#a78bfa';
  const DEFAULT_LAYER_FILL_OPACITY = 0.18;

  const styleForLayerClass = (styleClass?: string): string => {
    const color = styleClass
      ? (LAYER_COLORS[styleClass] ?? DEFAULT_LAYER_COLOR)
      : DEFAULT_LAYER_COLOR;
    const r = parseInt(color.slice(1, 3), 16) || 0;
    const g = parseInt(color.slice(3, 5), 16) || 0;
    const b = parseInt(color.slice(5, 7), 16) || 0;
    return `stroke: ${color}; fill: rgba(${r}, ${g}, ${b}, ${DEFAULT_LAYER_FILL_OPACITY});`;
  };

  const resolveAnnotationStyle = (annotation: ResolvedAnnotation): string =>
    annotation.targetStyle?.trim() || styleForLayerClass(annotation.targetStyleClass);

  const labelText = (annotation: ResolvedAnnotation): string =>
    annotation.label?.trim() || '';

  const labelPosition = (annotation: RenderedAnnotation): { x: number; y: number } => ({
    x: annotation.bounds.x + annotation.bounds.width / 2,
    y: annotation.bounds.y + annotation.bounds.height + 12,
  });

  const parseStyleDeclarations = (style: string): Record<string, string> => {
    const entries = style
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf(':');
        if (separator < 0) return null;
        const key = part.slice(0, separator).trim().toLowerCase();
        const value = part.slice(separator + 1).trim();
        if (!key || !value) return null;
        return [key, value] as const;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry));
    return Object.fromEntries(entries);
  };

  const toHtmlAnnotationStyle = (style: string): string => {
    const declarations = parseStyleDeclarations(style);
    const stroke = declarations.stroke;
    const fill = declarations.fill;
    const extra = Object.entries(declarations)
      .filter(([key]) => key !== 'stroke' && key !== 'fill')
      .map(([key, value]) => `${key}: ${value};`);
    const mapped: string[] = [];
    if (stroke) mapped.push(`border-color: ${stroke};`);
    if (fill) mapped.push(`background: ${fill};`);
    return [...mapped, ...extra].join(' ');
  };

  const handleAnnotationEnter = (id: string) => {
    onannotationhover?.({ id });
  };

  const handleAnnotationLeave = (id: string) => {
    if (hoverAnnotationId === id) {
      onannotationhover?.({ id: null });
    }
  };

  const handleAnnotationSelect = (id: string) => {
    onannotationselect?.({ id });
  };

  const handleClearSelection = () => {
    onannotationclear?.();
  };

  const handleAnnotationKeydown = (event: KeyboardEvent, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleAnnotationSelect(id);
    }
  };

  const handleClearKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClearSelection();
    }
  };

  const isDimmed = (id: string): boolean => {
    if (!hoverAnnotationId && !activeAnnotationId) return false;
    if (hoverAnnotationId && id === hoverAnnotationId) return false;
    if (activeAnnotationId && id === activeAnnotationId) return false;
    return true;
  };

  const updateTooltip = () => {
    if (!activeAnnotationId) {
      tooltip = null;
      return;
    }
    const target = rendered.find((item) => item.id === activeAnnotationId);
    if (!target) {
      tooltip = null;
      return;
    }
    const text = target.text?.trim() || fallbackText;
    if (!text) {
      tooltip = null;
      return;
    }
    const containerWidth = container?.clientWidth ?? 0;
    const anchorX = target.bounds.x + target.bounds.width / 2;
    const anchorY = target.bounds.y + target.bounds.height + 10;
    const minX = 12;
    const maxX = containerWidth > 0 ? Math.max(minX, containerWidth - 12) : minX;
    const x = Math.min(Math.max(anchorX, minX), maxX);
    const maxWidth = containerWidth
      ? Math.min(320, Math.max(180, containerWidth * 0.6))
      : 240;
    tooltip = { id: target.id, text, x, y: anchorY, maxWidth };
  };

  const updateRendered = () => {
    const spatial = annotations.filter(
      (annotation) => annotation.rect || annotation.point || annotation.polygon,
    );
    if (!viewer || spatial.length === 0) {
      rendered = [];
      return;
    }
    const activeBaseLayerId = layers[0]?.id;
    let tiledImage = viewer.world?.getItemAt(0);
    if (activeBaseLayerId) {
      const itemCount = viewer.world.getItemCount();
      for (let i = 0; i < itemCount; i++) {
        const item = viewer.world.getItemAt(i);
        const cid = tiledImageLayerIds.get(item) ?? '';
        if (cid === activeBaseLayerId || cid.endsWith(':' + activeBaseLayerId)) {
          tiledImage = item;
          break;
        }
      }
    }
    if (!tiledImage) {
      rendered = [];
      return;
    }
    const highlightSet = new Set(highlightIds);
    const toViewerPoint = (x: number, y: number) => {
      const viewportRect = tiledImage.imageToViewportRectangle(x, y, 0, 0);
      const pixelRect = viewer.viewport.viewportToViewerElementRectangle(viewportRect);
      return { x: pixelRect.x, y: pixelRect.y };
    };

    rendered = spatial
      .map((annotation) => {
        const className = annotation.targetStyleClass;
        const style = resolveAnnotationStyle(annotation);
        if (annotation.polygon?.points?.length) {
          const pixelPoints = annotation.polygon.points.map((point) =>
            toViewerPoint(point.x, point.y),
          );
          const points = pixelPoints.map((pixel) => `${pixel.x},${pixel.y}`).join(' ');
          const xs = pixelPoints.map((point) => point.x);
          const ys = pixelPoints.map((point) => point.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          const isPolyline =
            annotation.polygon.svg &&
            (annotation.polygon.svg.includes('<polyline') ||
              annotation.polygon.svg.includes('<line'));
          return {
            id: annotation.id,
            type: isPolyline ? 'polyline' : 'polygon',
            points,
            bounds: {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            },
            isHighlight: highlightSet.has(annotation.id),
            text: annotation.text,
            label: labelText(annotation),
            className,
            style,
          };
        }
        if (annotation.point) {
          const pixel = toViewerPoint(annotation.point.x, annotation.point.y);
          return {
            id: annotation.id,
            type: 'point',
            point: pixel,
            bounds: { x: pixel.x, y: pixel.y, width: 0, height: 0 },
            isHighlight: highlightSet.has(annotation.id),
            text: annotation.text,
            label: labelText(annotation),
            className,
            style: toHtmlAnnotationStyle(style),
          };
        }
        if (!annotation.rect) {
          return null;
        }
        const viewportRect = tiledImage.imageToViewportRectangle(
          annotation.rect.x,
          annotation.rect.y,
          annotation.rect.w,
          annotation.rect.h,
        );
        const pixelRect = viewer.viewport.viewportToViewerElementRectangle(viewportRect);
        return {
          id: annotation.id,
          type: 'rect',
          rect: {
            x: pixelRect.x,
            y: pixelRect.y,
            width: pixelRect.width,
            height: pixelRect.height,
          },
          bounds: {
            x: pixelRect.x,
            y: pixelRect.y,
            width: pixelRect.width,
            height: pixelRect.height,
          },
          isHighlight: highlightSet.has(annotation.id),
          text: annotation.text,
          label: labelText(annotation),
          className,
          style: toHtmlAnnotationStyle(style),
        };
      })
      .filter((value): value is RenderedAnnotation => Boolean(value));
    updateTooltip();
  };

  const scheduleRenderedUpdate = () => {
    if (renderFrameId !== null) return;
    renderFrameId = requestAnimationFrame(() => {
      renderFrameId = null;
      updateRendered();
    });
  };

  const emitViewBox = () => {
    if (!viewer?.viewport) return;
    const baseItem = viewer.world?.getItemAt(0);
    if (!baseItem) return;

    const bounds = viewer.viewport.getBounds(true);
    const imageRect = baseItem.viewportToImageRectangle(bounds);
    const viewBox: ViewBox = {
      x: imageRect.x,
      y: imageRect.y,
      w: imageRect.width,
      h: imageRect.height,
    };
    const zoom = viewer.viewport.getZoom(true);
    const homeZoom = viewer.viewport.getHomeZoom?.();

    lastViewBox = viewBox;
    lastZoom = zoom;
    onviewboxchange?.({ viewBox });
    onzoomchange?.({
      zoom,
      viewBox,
      ...(Number.isFinite(homeZoom) && homeZoom > 0 ? { homeZoom } : {}),
    });
  };

  export const getViewBox = (): ViewBox | null => {
    return lastViewBox;
  };

  export const getZoom = (): number => {
    return lastZoom;
  };

  export const setViewBox = (box: ViewBox): void => {
    if (!viewer?.viewport || !viewer?.world?.getItemAt(0)) {
      return;
    }
    const tiledImage = viewer.world.getItemAt(0);

    // Ensure tiledImage has valid dimensions before converting coordinates
    // This is critical on mobile where layout timing can vary
    // The contentSize represents the actual image dimensions in pixels
    const contentSize = tiledImage.getContentSize?.();

    if (!contentSize || contentSize.x <= 0 || contentSize.y <= 0) {
      // Content size not ready yet - this can happen if setViewBox is called
      // before the tile source metadata is fully loaded
      // The viewBox animation will retry on the next frame
      return;
    }

    // CRITICAL FIX: Clamp viewBox to image bounds to prevent zoom-out issue
    // If the viewBox is wider/taller than the image, it causes fitBounds() to zoom way out
    // This can happen when viewBox is saved from desktop and applied to mobile
    const imageWidth = contentSize.x;
    const imageHeight = contentSize.y;

    // Clamp the viewBox dimensions to not exceed image dimensions
    let clampedBox = { ...box };

    // If viewBox is wider than image, clamp it
    if (clampedBox.w > imageWidth) {
      clampedBox.w = imageWidth;
      // Center the x position
      clampedBox.x = 0;
    }

    // If viewBox is taller than image, clamp it
    if (clampedBox.h > imageHeight) {
      clampedBox.h = imageHeight;
      // Center the y position
      clampedBox.y = 0;
    }

    // Ensure the viewBox is within image bounds
    if (clampedBox.x < 0) {
      clampedBox.x = Math.max(0, clampedBox.x);
    }
    if (clampedBox.y < 0) {
      clampedBox.y = Math.max(0, clampedBox.y);
    }
    if (clampedBox.x + clampedBox.w > imageWidth) {
      clampedBox.x = Math.max(0, imageWidth - clampedBox.w);
    }
    if (clampedBox.y + clampedBox.h > imageHeight) {
      clampedBox.y = Math.max(0, imageHeight - clampedBox.h);
    }

    // Convert image coordinates (xywh in canvas pixels) to viewport coordinates
    // This is the correct IIIF approach used by Universal Viewer and Mirador
    const viewportRect = tiledImage.imageToViewportRectangle(
      clampedBox.x,
      clampedBox.y,
      clampedBox.w,
      clampedBox.h,
    );

    // Use fitBounds to zoom and pan to show the specified region
    // This ensures the region is visible, though aspect ratio differences
    // between desktop and mobile may result in different zoom levels
    viewer.viewport.fitBounds(viewportRect, true);
  };

  export const zoomBy = (factor: number): void => {
    if (!viewer?.viewport) return;
    viewer.viewport.zoomBy(factor, undefined, true);
    viewer.viewport.applyConstraints();
  };

  export const goHome = (): void => {
    if (!viewer?.viewport) return;
    viewer.viewport.goHome?.(true);
    viewer.viewport.applyConstraints?.();
  };

  export const rotateBy = (delta: number): void => {
    if (!viewer?.viewport) return;
    const getRotation =
      typeof viewer.viewport.getRotation === 'function'
        ? viewer.viewport.getRotation()
        : 0;
    if (typeof viewer.viewport.setRotation === 'function') {
      const nextRotation = getRotation + delta;
      viewer.viewport.setRotation(nextRotation);
      viewer.viewport.applyConstraints?.();
      onrotationchange?.({ rotation: nextRotation });
    }
  };

  export const setRotation = (nextRotation: number): void => {
    if (!viewer?.viewport || !Number.isFinite(nextRotation)) return;
    if (typeof viewer.viewport.setRotation === 'function') {
      viewer.viewport.setRotation(nextRotation);
      viewer.viewport.applyConstraints?.();
    }
  };

  export const setFilters = (filters: ImageFilters): void => {
    filterCss = buildFilterCss(filters);
  };

  onMount(() => {
    let cancelled = false;

    const init = async () => {
      if (!container) return;

      const module = await import('openseadragon');
      if (cancelled) {
        return;
      }
      const OSD = (module.default || module) as typeof OpenSeadragon;
      applyIIIFExactTileLevelWorkaround(OSD);
      OpenSeadragonClass = OSD;

      viewer = OSD({
        prefixUrl: '',
        showNavigationControl: false,
        showHomeControl: false,
        showFullPageControl: false,
        showSequenceControl: false,
        showZoomControl: false,
        // OSD 6 prefers WebGL by default. Large cookbook runs can exhaust or
        // reject texture allocation and leave otherwise valid IIIF images
        // blank, so use the Canvas2D drawer unless a host explicitly opts in.
        drawer: 'canvas',
        animationTime: 0.5,
        minZoomImageRatio: 0.1,
        // Ensure consistent viewport behavior across devices
        homeFillsViewer: false,
        visibilityRatio: 0.5,
        constrainDuringPan: false,
        gestureSettingsMouse: {
          clickToZoom: legacyOsdConfig?.clickToZoomEnabled ?? false,
        },
        preserveViewport: legacyOsdConfig?.preserveViewport ?? false,
        showNavigator: legacyOsdConfig?.showNavigator ?? false,
        showRotationControl: legacyOsdConfig?.showRotationControl ?? false,
        ...osdConfig,
        // These are managed by the renderer and cannot be overridden by pass-through config.
        element: container,
        tileSources: null,
      });

      const handleViewportChange = () => {
        emitViewBox();
        scheduleRenderedUpdate();
      };

      const handleAnimation = () => {
        scheduleRenderedUpdate();
      };

      viewer.addHandler('open', () => {
        if (openPendingBaseTarget()) return;
        baseImageLoaded = true;
        openingBaseCustomId = '';
        onviewerready?.({ viewer: viewer as OpenSeadragon.Viewer });
        setRotation(rotation);
        if (initialViewBox && !initialViewBoxApplied) {
          initialViewBoxApplied = true;
          requestAnimationFrame(() => setViewBox(initialViewBox));
        }
        handleViewportChange();
      });
      viewer.addHandler('zoom', handleViewportChange);
      viewer.addHandler('pan', handleViewportChange);
      viewer.addHandler('animation', handleAnimation);
      viewer.addHandler('animation-finish', handleViewportChange);
      viewer.addHandler('resize', handleViewportChange);
      viewer.addHandler('open-failed', () => {
        openingBaseCustomId = '';
        baseImageLoaded = false;
        openPendingBaseTarget();
      });

      // The editor needs the viewer instance before the first image-open event.
      // The open handler calls this again once intrinsic canvas dimensions exist.
      onviewerready?.({ viewer });
    };

    init();

    return () => {
      if (renderFrameId !== null) {
        cancelAnimationFrame(renderFrameId);
        renderFrameId = null;
      }
      cancelled = true;
      viewer?.destroy();
    };
  });

  type TargetItem = {
    customLayerId: string;
    canvasIndex: number;
    layerId: string;
    tileSource: TileSource;
    x: number;
    y: number;
    width: number;
    isPrimary: boolean;
    opacity: number;
  };

  const compileTargetItems = (): TargetItem[] => {
    const targets: TargetItem[] = [];

    if (activeLayoutImages && activeLayoutImages.length > 0) {
      let currentY = 0;
      for (const img of activeLayoutImages) {
        let x = 0;
        let y = 0;
        let w = 1.0;
        const h = img.height / img.width;

        if (layoutMode === 'two-page') {
          if (img.index === 0) {
            x = 0;
            y = 0;
            w = 1.0;
          } else if (img.index % 2 === 1) {
            // Left page
            x = 0;
            y = 0;
            w = 1.0;
          } else {
            // Right page
            x = 1.02;
            y = 0;
            w = 1.0;
          }
        } else if (layoutMode === 'continuous') {
          x = 0;
          y = currentY;
          w = 1.0;
          currentY += h + 0.05;
        } else {
          // Single
          x = 0;
          y = 0;
          w = 1.0;
        }

        // Add primary layer
        const primarySource = img.source.src.endsWith('info.json') ? img.source.src : { type: 'image', url: img.source.src };
        const primaryOpacity = layerOpacities[img.source.id] !== undefined ? layerOpacities[img.source.id] : 1.0;
        targets.push({
          customLayerId: `${img.id}:${img.source.id}`,
          canvasIndex: img.index,
          layerId: img.source.id,
          tileSource: primarySource,
          x,
          y,
          width: w,
          isPrimary: true,
          opacity: primaryOpacity
        });

        // Add alternative layers
        if (img.layers && img.layers.length > 0) {
          for (const layer of img.layers) {
            const layerSource = layer.src.endsWith('info.json') ? layer.src : { type: 'image', url: layer.src };
            const layerOpacity = layerOpacities[layer.id] !== undefined ? layerOpacities[layer.id] : 0.0;
            targets.push({
              customLayerId: `${img.id}:${layer.id}`,
              canvasIndex: img.index,
              layerId: layer.id,
              tileSource: layerSource,
              x,
              y,
              width: w,
              isPrimary: false,
              opacity: layerOpacity
            });
          }
        }
      }
    } else {
      // Legacy fallback
      if (layers && layers.length > 0) {
        for (let i = 0; i < layers.length; i++) {
          const layer = layers[i];
          const layerSource = layer.src.endsWith('info.json') ? layer.src : { type: 'image', url: layer.src };
          const opacity = layerOpacities[layer.id] !== undefined ? layerOpacities[layer.id] : (i === 0 ? 1.0 : 0.0);
          targets.push({
            customLayerId: layer.id,
            canvasIndex: 0,
            layerId: layer.id,
            tileSource: layerSource,
            x: 0,
            y: 0,
            width: 1.0,
            isPrimary: i === 0,
            opacity
          });
        }
      } else if (tileSource) {
        targets.push({
          customLayerId: 'base',
          canvasIndex: 0,
          layerId: 'base',
          tileSource,
          x: 0,
          y: 0,
          width: 1.0,
          isPrimary: true,
          opacity: 1.0
        });
      }
    }

    return targets;
  };

  let targetItems = $derived.by(() => {
    return compileTargetItems();
  });

  let loadedBaseCustomId = $state('');
  let openingBaseCustomId = '';
  let pendingBaseTarget: TargetItem | null = null;
  const loadingLayerIds = new Set<string>();

  const openBaseTarget = (target: TargetItem): void => {
    if (!viewer) return;
    if ((viewer as OpenSeadragon.Viewer & { _opening?: boolean })._opening) {
      pendingBaseTarget = target;
      return;
    }
    pendingBaseTarget = null;
    openingBaseCustomId = target.customLayerId;
    baseImageLoaded = false;
    viewer.open(target.tileSource);
  };

  const openPendingBaseTarget = (): boolean => {
    const pending = pendingBaseTarget;
    if (!pending || pending.customLayerId === openingBaseCustomId) {
      pendingBaseTarget = null;
      return false;
    }
    pendingBaseTarget = null;
    openingBaseCustomId = '';
    openBaseTarget(pending);
    return true;
  };

  $effect(() => {
    if (!viewer) return;

    const baseTarget = targetItems[0];
    if (baseTarget) {
      const baseId = baseTarget.customLayerId;
      if (baseId !== loadedBaseCustomId) {
        loadedBaseCustomId = baseId;
        loadingLayerIds.clear();
        openBaseTarget(baseTarget);
      }
    } else {
      loadedBaseCustomId = '';
      openingBaseCustomId = '';
      pendingBaseTarget = null;
      baseImageLoaded = false;
      loadingLayerIds.clear();
      viewer.close();
    }
  });

  $effect(() => {
    if (!viewer) return;
    if (!baseImageLoaded) return;
    if (!OpenSeadragonClass) return;

    const items = targetItems;
    // Get all items currently in the world
    const itemCount = viewer.world.getItemCount();
    const loadedItems: OpenSeadragon.TiledImage[] = [];
    for (let i = 0; i < itemCount; i++) {
      loadedItems.push(viewer.world.getItemAt(i));
    }

    const baseTarget = items[0];
    const baseItem = loadedItems[0];
    if (baseItem && baseTarget) {
      tiledImageLayerIds.set(baseItem, baseTarget.customLayerId);
      baseItem.setOpacity(baseTarget.opacity);
      
      const bounds = baseItem.getBounds();
      if (bounds.x !== baseTarget.x || bounds.y !== baseTarget.y) {
        baseItem.setPosition(new OpenSeadragonClass.Point(baseTarget.x, baseTarget.y));
      }
      if (bounds.width !== baseTarget.width) {
        baseItem.setWidth(baseTarget.width);
      }
    }

    const secondaryTargets = items.slice(1);

    // 1. Remove loaded secondary items that are not in secondaryTargets
    loadedItems.slice(1).forEach((item) => {
      const customId = tiledImageLayerIds.get(item);
      if (!customId) return; // Keep loading items
      const exists = secondaryTargets.some((target) => target.customLayerId === customId);
      if (!exists) {
        viewer.world.removeItem(item);
      }
    });

    // 2. Add or update secondary targets
    secondaryTargets.forEach((target) => {
      const loadedItem = loadedItems.find(
        (item) => tiledImageLayerIds.get(item) === target.customLayerId,
      );

      if (loadedItem) {
        loadedItem.setOpacity(target.opacity);
        const bounds = loadedItem.getBounds();
        if (bounds.x !== target.x || bounds.y !== target.y) {
          loadedItem.setPosition(new OpenSeadragonClass.Point(target.x, target.y));
        }
        if (bounds.width !== target.width) {
          loadedItem.setWidth(target.width);
        }
      } else {
        if (loadingLayerIds.has(target.customLayerId)) {
          return;
        }

        loadingLayerIds.add(target.customLayerId);

        const options = {
          tileSource: target.tileSource,
          x: target.x,
          y: target.y,
          width: target.width,
          opacity: target.opacity,
          success: (event) => {
            loadingLayerIds.delete(target.customLayerId);
            const item = event.item;
            tiledImageLayerIds.set(item, target.customLayerId);

            // Check if this layer is still in the targetItems list and get latest properties
            const currentTargets = compileTargetItems();
            const matchingTarget = currentTargets.find((t) => t.customLayerId === target.customLayerId);
            if (!matchingTarget) {
              viewer.world.removeItem(item);
              return;
            }

            item.setOpacity(matchingTarget.opacity);
            const pos = new OpenSeadragonClass.Point(matchingTarget.x, matchingTarget.y);
            item.setPosition(pos);
            item.setWidth(matchingTarget.width);
          },
          error: (err) => {
            console.error(`Failed to load tile source for layer ${target.customLayerId}:`, err);
            loadingLayerIds.delete(target.customLayerId);
          },
          failure: (err) => {
            console.error(`Failed to load tile source for layer ${target.customLayerId}:`, err);
            loadingLayerIds.delete(target.customLayerId);
          }
        } as unknown as Parameters<OpenSeadragon.Viewer['addTiledImage']>[0];
        viewer.addTiledImage(options);
      }
    });
  });

  $effect(() => {
    if (viewer) {
      void tileSource;
      void annotations;
      void highlightIds;
      scheduleRenderedUpdate();
    }
  });

  $effect(() => {
    if (viewer) {
      void activeAnnotationId;
      void fallbackText;
      void rendered;
      updateTooltip();
    }
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="osd"
  style="--osd-canvas-filter: {filterCss};"
  role="application"
  aria-label={$t('renderers.osd.label')}
  tabindex="0"
  onclick={handleClearSelection}
  onkeydown={handleClearKeydown}
>
  <div class="osd__viewport" bind:this={container}></div>
  <div class="osd__overlays" aria-hidden="true">
    <svg class="annotation-svg" aria-hidden="true">
      {#each rendered as annotation (annotation.id)}
        {#if annotation.type === 'polygon' && annotation.points}
          <polygon
            class="annotation-shape {annotation.isHighlight
              ? 'annotation--hit'
              : ''} {annotation.className ?? ''}"
            class:annotation--dimmed={isDimmed(annotation.id)}
            class:annotation--active={annotation.id === activeAnnotationId}
            points={annotation.points}
            style={annotation.style}
            data-annotation-id={annotation.id}
            onmouseenter={() => handleAnnotationEnter(annotation.id)}
            onmouseleave={() => handleAnnotationLeave(annotation.id)}
            role="button"
            tabindex="0"
            onclick={stopPropagation(() => handleAnnotationSelect(annotation.id))}
            onkeydown={(event) => handleAnnotationKeydown(event, annotation.id)}
          >
            {#if annotation.text}
              <title>{annotation.text}</title>
            {/if}
          </polygon>
        {:else if annotation.type === 'polyline' && annotation.points}
          <polyline
            class="annotation-shape annotation-shape--polyline {annotation.isHighlight
              ? 'annotation--hit'
              : ''} {annotation.className ?? ''}"
            class:annotation--dimmed={isDimmed(annotation.id)}
            class:annotation--active={annotation.id === activeAnnotationId}
            points={annotation.points}
            style={annotation.style}
            data-annotation-id={annotation.id}
            onmouseenter={() => handleAnnotationEnter(annotation.id)}
            onmouseleave={() => handleAnnotationLeave(annotation.id)}
            role="button"
            tabindex="0"
            onclick={stopPropagation(() => handleAnnotationSelect(annotation.id))}
            onkeydown={(event) => handleAnnotationKeydown(event, annotation.id)}
          >
            {#if annotation.text}
              <title>{annotation.text}</title>
            {/if}
          </polyline>
        {/if}
      {/each}
    </svg>
    {#each rendered as annotation (annotation.id)}
      {#if annotation.type === 'rect' && annotation.rect}
        <div
          class="annotation {annotation.isHighlight
            ? 'annotation--hit'
            : ''} {annotation.className ?? ''}"
          class:annotation--dimmed={isDimmed(annotation.id)}
          class:annotation--active={annotation.id === activeAnnotationId}
          style="
            left: {annotation.rect.x}px;
            top: {annotation.rect.y}px;
            width: {annotation.rect.width}px;
            height: {annotation.rect.height}px;
            {annotation.style ?? ''}
          "
          title={annotation.text}
          data-annotation-id={annotation.id}
          onmouseenter={() => handleAnnotationEnter(annotation.id)}
          onmouseleave={() => handleAnnotationLeave(annotation.id)}
          role="button"
          tabindex="0"
          onclick={stopPropagation(() => handleAnnotationSelect(annotation.id))}
          onkeydown={(event) => handleAnnotationKeydown(event, annotation.id)}
        ></div>
      {:else if annotation.type === 'point' && annotation.point}
        <div
          class="annotation annotation--point {annotation.isHighlight
            ? 'annotation--hit'
            : ''} {annotation.className ?? ''}"
          class:annotation--dimmed={isDimmed(annotation.id)}
          class:annotation--active={annotation.id === activeAnnotationId}
          style="
            left: {annotation.point.x}px;
            top: {annotation.point.y}px;
            {annotation.style ?? ''}
          "
          title={annotation.text}
          data-annotation-id={annotation.id}
          onmouseenter={() => handleAnnotationEnter(annotation.id)}
          onmouseleave={() => handleAnnotationLeave(annotation.id)}
          role="button"
          tabindex="0"
          onclick={stopPropagation(() => handleAnnotationSelect(annotation.id))}
          onkeydown={(event) => handleAnnotationKeydown(event, annotation.id)}
        ></div>
      {/if}
    {/each}
    {#each rendered as annotation (annotation.id)}
      {#if annotation.label}
        {@const position = labelPosition(annotation)}
        <div
          class="annotation-label"
          class:annotation-label--dimmed={isDimmed(annotation.id)}
          style="left: {position.x}px; top: {position.y}px;"
        >
          {annotation.label}
        </div>
      {/if}
    {/each}
    {#if tooltip}
      <div
        class="annotation-tooltip"
        style="left: {tooltip.x}px; top: {tooltip.y}px; max-width: {tooltip.maxWidth}px;"
        role="tooltip"
      >
        {tooltip.text}
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.osd__viewport .openseadragon-canvas) {
    filter: var(--osd-canvas-filter) !important;
  }

  .osd {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 18px;
    background: radial-gradient(
      120% 120% at 10% 0%,
      var(--viewer-stage-glow, rgba(42, 199, 255, 0.12)),
      var(--viewer-stage, #111720) 55%,
      var(--viewer-stage-tail, #0b0f14) 100%
    );
    overflow: hidden;
  }

  .osd__viewport,
  .osd__overlays {
    position: absolute;
    inset: 0;
  }

  .osd__viewport {
    touch-action: none;
  }

  .osd__overlays {
    pointer-events: none;
  }

  .annotation-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .annotation-shape {
    fill: rgba(255, 79, 162, 0.2);
    stroke: rgba(255, 79, 162, 0.85);
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
    transition:
      stroke 0.2s ease,
      fill 0.2s ease,
      opacity 0.2s ease;
    pointer-events: auto;
    cursor: pointer;
  }

  .annotation-shape--polyline {
    fill: none !important;
  }

  .annotation-shape.annotation--hit {
    fill: rgba(42, 199, 255, 0.25);
    stroke: rgba(42, 199, 255, 0.95);
  }

  .annotation-shape.annotation--active {
    stroke-width: 3px;
  }

  .annotation {
    position: absolute;
    border: 2px solid rgba(255, 79, 162, 0.85);
    background: rgba(255, 79, 162, 0.2);
    border-radius: 6px;
    transition:
      border-color 0.2s ease,
      background 0.2s ease,
      opacity 0.2s ease;
    pointer-events: auto;
    cursor: pointer;
  }

  .annotation--point {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    transform: translate(-50%, -50%);
  }

  .annotation--hit {
    border-color: rgba(42, 199, 255, 0.95);
    background: rgba(42, 199, 255, 0.25);
    animation: pulse 1.6s ease-in-out infinite;
  }

  .annotation--active {
    border-width: 3px;
  }

  .annotation--dimmed {
    opacity: 0.18;
  }

  .annotation-label {
    position: absolute;
    transform: translateX(-50%);
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(12, 16, 22, 0.84);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #f1f5f9;
    font-size: 11px;
    line-height: 1.2;
    max-width: min(220px, 60vw);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
  }

  .annotation-label--dimmed {
    opacity: 0.3;
  }

  .annotation-tooltip {
    position: absolute;
    transform: translateX(-50%);
    padding: 8px 10px;
    border-radius: 10px;
    background: rgba(12, 16, 22, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--viewer-text, #e8edf4);
    font-size: 12px;
    line-height: 1.4;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
    pointer-events: auto;
    z-index: 2;
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(42, 199, 255, 0.35);
    }
    70% {
      box-shadow: 0 0 0 12px rgba(42, 199, 255, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(42, 199, 255, 0);
    }
  }
</style>
