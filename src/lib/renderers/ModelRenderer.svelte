<script lang="ts" module>
  import type { RendererCapabilities } from '../core/types/renderer';
  
  /**
   * ModelRenderer capabilities
   * Supports rotation (orbital camera) and is highly interactive but not traditional zoom/filters
   */
  export const capabilities: RendererCapabilities = {
    supportsZoom: false,  // Uses camera orbit instead of traditional zoom
    supportsFilters: false,
    supportsPan: false,  // Uses camera orbit instead of traditional pan
    supportsViewBox: false,
    supportsRotation: true,  // Full 3D rotation via camera orbit
    isInteractive: true,
  };
</script>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { t } from '../i18n';
  import type { MediaSource } from '../iiif/mediaResolver';
  import type { ModelViewChange } from '../core/types/events';
  import type { ModelPose, ModelPoseOptions } from '../core/types/model';
  import '@google/model-viewer';
  import {
    formatCameraState,
    formatFovDeg,
    normaliseFovDeg,
    readCameraState,
  } from './modelCameraState';

  type ModelRendererProps = {
    source?: MediaSource | null;
    interpolationDecay?: number;
    onmodelchange?: ((payload: ModelViewChange) => void) | undefined;
  };

  let {
    source = null,
    interpolationDecay = $bindable(200),
    onmodelchange = undefined,
  }: ModelRendererProps = $props();

  type ModelViewerLike = HTMLElement & {
    cameraOrbit?: any;
    cameraTarget?: any;
    fieldOfView?: any;
    orientation?: any;
    getCameraOrbit?: () => any;
    getCameraTarget?: () => any;
    getFieldOfView?: () => any;
    jumpCameraToGoal?: () => void;
  };

  let modelViewerEl: ModelViewerLike | null = $state(null);
  let listenerTarget: ModelViewerLike | null = null;
  let raf: number | null = null;
  let lastPayload = '';
  let lastPose: ModelPose | null = null;
  let lastPoseOptions: ModelPoseOptions = {};

  const hasNumeric = (value?: string | null) => Boolean(value && /\d/.test(value));

  const formatOrbitValue = (value: any): string | undefined => {
    if (value == null) return undefined;
    if (typeof value === 'string') return hasNumeric(value) ? value : undefined;
    if (typeof value === 'object') {
      const text = value.toString?.();
      if (text && text !== '[object Object]' && hasNumeric(text)) return text;
      const theta = value?.theta ?? value?.x ?? value?.yaw;
      const phi = value?.phi ?? value?.y ?? value?.pitch;
      const radius = value?.radius ?? value?.z ?? value?.roll;
      if (
        typeof theta === 'number' ||
        typeof phi === 'number' ||
        typeof radius === 'number'
      ) {
        const parts = [theta, phi, radius].map((part, index) => {
          if (typeof part !== 'number') return '-';
          const unit = index < 2 ? 'rad' : 'm';
          return `${part.toFixed(3)}${unit}`;
        });
        return parts.join(' ');
      }
    }
    return undefined;
  };

  const formatTargetValue = (value: any): string | undefined => {
    if (value == null) return undefined;
    if (typeof value === 'string') return hasNumeric(value) ? value : undefined;
    if (typeof value === 'object') {
      const text = value.toString?.();
      if (text && text !== '[object Object]' && hasNumeric(text)) return text;
      const x = value?.x ?? value?.theta ?? value?.yaw;
      const y = value?.y ?? value?.phi ?? value?.pitch;
      const z = value?.z ?? value?.radius ?? value?.roll;
      if (typeof x === 'number' || typeof y === 'number' || typeof z === 'number') {
        const parts = [x, y, z].map((part) =>
          typeof part === 'number' ? `${part.toFixed(3)}m` : '-',
        );
        return parts.join(' ');
      }
    }
    return undefined;
  };

  const formatOrientationValue = (value: any): string | undefined => {
    if (value == null) return undefined;
    if (typeof value === 'string') return hasNumeric(value) ? value : undefined;
    if (typeof value === 'object') {
      const text = value.toString?.();
      if (text && text !== '[object Object]' && hasNumeric(text)) return text;
      const x = value?.x ?? value?.yaw ?? value?.theta;
      const y = value?.y ?? value?.pitch ?? value?.phi;
      const z = value?.z ?? value?.roll ?? value?.radius;
      if (typeof x === 'number' || typeof y === 'number' || typeof z === 'number') {
        const parts = [x, y, z].map((part) =>
          typeof part === 'number' ? `${part.toFixed(3)}deg` : '-',
        );
        return parts.join(' ');
      }
    }
    return undefined;
  };

  const formatFieldOfViewValue = (value: any): string | undefined => {
    const deg = normaliseFovDeg(value);
    return deg != null ? formatFovDeg(deg) : undefined;
  };

  const getFormattedPose = (): ModelPose => {
    if (!modelViewerEl) return {};
    const formatted = formatCameraState(readCameraState(modelViewerEl));
    const orbitFallback = formatOrbitValue(
      modelViewerEl.getCameraOrbit?.() ?? modelViewerEl.cameraOrbit,
    );
    const targetFallback = formatTargetValue(
      modelViewerEl.getCameraTarget?.() ?? modelViewerEl.cameraTarget,
    );
    const fovFallback = formatFieldOfViewValue(
      modelViewerEl.getFieldOfView?.() ?? modelViewerEl.fieldOfView,
    );
    const orientationValue = formatOrientationValue(modelViewerEl.orientation);
    return {
      cameraOrbit: formatted.cameraOrbit ?? orbitFallback,
      cameraTarget: formatted.cameraTarget ?? targetFallback,
      fieldOfView: formatted.fieldOfView ?? fovFallback,
      orientation: orientationValue ?? undefined,
    };
  };

  const updateLastPose = (pose: ModelPose) => {
    const next: ModelPose = {
      cameraOrbit: pose.cameraOrbit ?? lastPose?.cameraOrbit,
      cameraTarget: pose.cameraTarget ?? lastPose?.cameraTarget,
      fieldOfView: pose.fieldOfView ?? lastPose?.fieldOfView,
      orientation: pose.orientation ?? lastPose?.orientation,
    };
    if (!next.cameraOrbit && !next.cameraTarget && !next.fieldOfView && !next.orientation) {
      return;
    }
    lastPose = next;
  };

  const buildDetail = (pose: ModelPose, source?: string): ModelViewChange => ({
    source,
    ...pose,
  });

  const emitChange = (source?: string, poseOverride?: ModelPose) => {
    if (!modelViewerEl) return;
    const pose = poseOverride ?? getFormattedPose();
    updateLastPose(pose);
    const detail = buildDetail(pose, source);
    const payload = JSON.stringify(detail);
    if (payload === lastPayload) return;
    lastPayload = payload;
    onmodelchange?.(detail);
  };

  const scheduleEmit = (source?: string, poseOverride?: ModelPose) => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = null;
      emitChange(source, poseOverride);
    });
  };

  const handleCameraChange = (event: Event) => {
    const detail = (event as CustomEvent)?.detail as { source?: string } | undefined;
    scheduleEmit(detail?.source ?? undefined);
  };

  const handleLoad = () => {
    emitChange('load');
    if (lastPose) {
      applyPose(lastPose, lastPoseOptions, 'load');
    }
  };

  const applyPose = (
    pose: ModelPose,
    options: ModelPoseOptions,
    source: string,
  ): void => {
    if (!modelViewerEl) return;
    if (pose.cameraTarget) {
      modelViewerEl.cameraTarget = pose.cameraTarget;
    }
    if (pose.cameraOrbit) {
      modelViewerEl.cameraOrbit = pose.cameraOrbit;
    }
    if (pose.fieldOfView) {
      modelViewerEl.fieldOfView = pose.fieldOfView;
    }
    if (pose.orientation) {
      modelViewerEl.orientation = pose.orientation;
    }
    if (options.transition === 'jump') {
      modelViewerEl.jumpCameraToGoal?.();
    }
    scheduleEmit(source, pose);
  };


  export const setCameraOrbit = (orbit: string): void => {
    lastPose = { ...(lastPose ?? {}), cameraOrbit: orbit };
    if (!modelViewerEl) return;
    modelViewerEl.cameraOrbit = orbit;
    scheduleEmit('api', lastPose ?? { cameraOrbit: orbit });
  };

  export const setCameraTarget = (target: string): void => {
    lastPose = { ...(lastPose ?? {}), cameraTarget: target };
    if (!modelViewerEl) return;
    modelViewerEl.cameraTarget = target;
    scheduleEmit('api', lastPose ?? { cameraTarget: target });
  };

  export const setOrientation = (orientation: string): void => {
    lastPose = { ...(lastPose ?? {}), orientation };
    if (!modelViewerEl) return;
    modelViewerEl.orientation = orientation;
    scheduleEmit('api', lastPose ?? { orientation });
  };

  export const setModelPose = (pose: ModelPose, options: ModelPoseOptions = {}): void => {
    lastPose = { ...pose };
    lastPoseOptions = { ...options };
    if (options.interpolationDecay != null) {
      const next = Number(options.interpolationDecay);
      if (Number.isFinite(next)) {
        interpolationDecay = next;
      }
    }
    if (!modelViewerEl) return;
    applyPose(pose, options, 'api');
  };

  export const getCameraOrbit = (): string | null => {
    if (!modelViewerEl) return lastPose?.cameraOrbit ?? null;
    return getFormattedPose().cameraOrbit ?? lastPose?.cameraOrbit ?? null;
  };

  export const getCameraTarget = (): string | null => {
    if (!modelViewerEl) return lastPose?.cameraTarget ?? null;
    return getFormattedPose().cameraTarget ?? lastPose?.cameraTarget ?? null;
  };

  export const getOrientation = (): string | null => {
    if (!modelViewerEl) return lastPose?.orientation ?? null;
    return getFormattedPose().orientation ?? lastPose?.orientation ?? null;
  };

  export const getModelPose = (): ModelPose | null => {
    if (modelViewerEl && !lastPose) {
      updateLastPose(getFormattedPose());
    }
    return lastPose ?? null;
  };

  onMount(() => {
    if (!modelViewerEl) return;
    listenerTarget = modelViewerEl;
    listenerTarget.addEventListener('camera-change', handleCameraChange as EventListener);
    listenerTarget.addEventListener('load', handleLoad as EventListener);
  });

  onDestroy(() => {
    if (listenerTarget) {
      listenerTarget.removeEventListener('camera-change', handleCameraChange as EventListener);
      listenerTarget.removeEventListener('load', handleLoad as EventListener);
      listenerTarget = null;
    }
    if (raf) cancelAnimationFrame(raf);
  });
</script>

<div class="media media--model">
  {#if source}
    <model-viewer
      class="media__viewer"
      bind:this={modelViewerEl}
      src={source.src}
      camera-controls
      interpolation-decay={interpolationDecay}
      aria-label={$t('renderers.model.label')}
    ></model-viewer>
  {:else}
    <div class="media__placeholder">{$t('renderers.model.noSource')}</div>
  {/if}
</div>

<style>
  .media {
    width: 100%;
    height: 100%;
    display: grid;
  }

  .media__viewer {
    width: 100%;
    height: 100%;
    border-radius: 18px;
    background: var(--viewer-stage, #111720);
  }

  .media__placeholder {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
  }
</style>
