<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import { t } from '../../i18n';

  import 'ol/ol.css';
  import OlMap from 'ol/Map.js';
  import View from 'ol/View.js';
  import TileLayer from 'ol/layer/Tile.js';
  import OSM from 'ol/source/OSM.js';
  import Feature from 'ol/Feature.js';
  import Point from 'ol/geom/Point.js';
  import { Vector as VectorLayer } from 'ol/layer.js';
  import { Vector as VectorSource } from 'ol/source.js';
  import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style.js';
  import { fromLonLat } from 'ol/proj.js';

  interface Props {
    onclose?: () => void;
  }

  let { onclose = undefined }: Props = $props();

  const viewer = getContext<any>('viewer-context');
  const {
    manifestTitle,
    manifestDescription,
    manifestAttribution,
    manifestLicence,
    manifestMetadata,
    manifestProviders,
    manifestGeoLocation,
  } = viewer.derived;

  let mapElement: HTMLDivElement;
  let map: OlMap | undefined;

  const markerFeature = new Feature();
  markerFeature.setStyle(
    new Style({
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({ color: '#2563eb' }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
    }),
  );

  onMount(() => {
    const vectorLayer = new VectorLayer({
      source: new VectorSource({ features: [markerFeature] }),
    });

    map = new OlMap({
      target: mapElement,
      layers: [
        new TileLayer({ source: new OSM() }),
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2,
      }),
    });

    return () => {
      map?.setTarget(undefined);
      map = undefined;
    };
  });

  $effect(() => {
    const location = $manifestGeoLocation;

    if (!location) {
      markerFeature.setGeometry(undefined);
      return;
    }

    const markerCoords = fromLonLat([location.lng, location.lat]);
    markerFeature.setGeometry(new Point(markerCoords));
    map?.getView().setCenter(markerCoords);
    map?.getView().setZoom(12);

    requestAnimationFrame(() => map?.updateSize());
  });
</script>

<section
  class="panel panel--metadata"
  aria-label={$t('viewer.panels.metadata.label')}
>
  <div class="panel__header">
    <div class="panel__title">{$t('viewer.panels.metadata.title')}</div>
    <button
      class="panel__close"
      type="button"
      aria-label={$t('viewer.panels.metadata.close')}
      onclick={() => onclose?.()}
    >
      {$t('common.closeGlyph')}
    </button>
  </div>
  <div class="panel__body metadata">
    <div class="metadata__map" hidden={!$manifestGeoLocation}>
      <div class="metadata__map-target" bind:this={mapElement}></div>
    </div>

    {#if $manifestTitle}
      <div class="metadata__label">{$manifestTitle}</div>
    {/if}
    {#if $manifestDescription}
      <div class="metadata__description">
        {@html $manifestDescription}
      </div>
    {/if}
    {#if $manifestProviders.length > 0}
      <div class="metadata__block">
        <div class="metadata__block-title">
          {$t('viewer.panels.metadata.provider')}
        </div>

        {#each $manifestProviders as provider}
          <div class="metadata__provider">
            {#if provider.logo?.id}
              <img
                src={provider.logo.id}
                alt=""
                class="metadata__provider-logo"
              />
            {/if}

            <div class="metadata__provider-body">
              <div class="metadata__provider-name">{provider.label}</div>

              {#if provider.homepage?.id}
                <a
                  class="metadata__link"
                  href={provider.homepage.id}
                  target="_blank"
                  rel="noreferrer"
                >
                  {provider.homepage.label || provider.homepage.id}
                </a>
              {/if}

              {#if provider.seeAlso?.id}
                <a
                  class="metadata__link"
                  href={provider.seeAlso.id}
                  target="_blank"
                  rel="noreferrer"
                >
                  {provider.seeAlso.label || provider.seeAlso.id}
                </a>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
    {#if $manifestAttribution.value}
      <div class="metadata__block">
        <div class="metadata__block-title">
          {$manifestAttribution.label ||
            $t('viewer.panels.metadata.attribution')}
        </div>
        <div class="metadata__block-value">
          {@html $manifestAttribution.value}
        </div>
      </div>
    {/if}
    {#if $manifestLicence}
      <div class="metadata__block">
        <div class="metadata__block-title">
          {$t('viewer.panels.metadata.license')}
        </div>
        <div class="metadata__block-value">
          <a
            class="metadata__link"
            href={$manifestLicence}
            target="_blank"
            rel="noreferrer"
          >
            {$manifestLicence}
          </a>
        </div>
      </div>
    {/if}
    {#if $manifestMetadata.length > 0}
      <dl class="metadata__list">
        {#each $manifestMetadata as item}
          <dt class="metadata__term">{item.label}</dt>
          <dd class="metadata__value">{@html item.value}</dd>
        {/each}
      </dl>
    {:else if !$manifestDescription && !$manifestAttribution.value && !$manifestLicence}
      <div class="panel__empty">
        {$t('viewer.panels.metadata.empty')}
      </div>
    {/if}
  </div>
</section>

<style>
  .metadata {
    display: grid;
    gap: 10px;
  }

  .metadata__label {
    font-size: 14px;
    font-weight: 600;
    color: var(--viewer-text);
  }

  .metadata__map-target {
    width: 100%;
    height: 220px;
  }

  .metadata__description {
    font-size: 12px;
    color: var(--viewer-text);
    line-height: 1.5;
  }

  .metadata__block {
    display: grid;
    gap: 4px;
  }

  .metadata__block-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--viewer-muted);
  }

  .metadata__block-value {
    font-size: 12px;
    color: var(--viewer-text);
  }

  .metadata__link {
    color: inherit;
    word-break: break-all;
  }

  .metadata__list {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
    margin: 0;
  }

  .metadata__term {
    font-size: 12px;
    color: var(--viewer-muted);
    margin: 6px 0 0;
  }

  .metadata__term:first-child {
    margin-top: 0;
  }

  .metadata__value {
    font-size: 12px;
    color: var(--viewer-text);
    margin: 0 0 8px;
  }

  .metadata__value:last-child {
    margin-bottom: 0;
  }

  .metadata__provider-logo {
    display: block;
    width: auto;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .metadata__provider-body,
  .metadata__provider-name {
    line-height: 1.8em;
    font-weight: bold;
  }

  .metadata__provider-body a {
    display: block;
  }
</style>
