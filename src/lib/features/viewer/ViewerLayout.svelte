<script lang="ts">
  import { get } from 'svelte/store';
  import { onDestroy, onMount, setContext } from 'svelte';
  import { ChevronsRight, Expand, Shrink } from '@lucide/svelte';
  import { t } from '../../core/i18n';
  import { normaliseViewerConfig } from '../../core/config/normalise';
  import type { ViewerConfig } from '../../core/types/config';
  import type { ViewerEventMap } from '../../core/types/events';
  import type { ViewerPlugin } from '../../core/types/plugin';
  import type { ModelPose, ModelPoseOptions } from '../../core/types/model';
  import type { ContentSize, ViewBox } from '../../core/types/viewer';
  import type { ViewerApi } from '../../core/types/viewer-api';
  import { createAnnotationFocusPlugin } from '../../plugins/annotationFocus';
  import PluginSlot from '../../plugins/PluginSlot.svelte';
  import ViewerHeader from '../../viewer/ui/ViewerHeader.svelte';
  import ViewerDock from '../../viewer/ui/ViewerDock.svelte';
  import LeftPanelStack from '../../viewer/ui/LeftPanelStack.svelte';
  import Stage from '../../viewer/ui/Stage.svelte';
  import StageGalleryView from '../../viewer/ui/StageGalleryView.svelte';
  import StageToolbar from '../../viewer/ui/StageToolbar.svelte';
  import Gallery from '../../viewer/ui/Gallery.svelte';
  import ManifestManager from '../workspace/ManifestManager.svelte';
  import GridContainer from '../workspace/GridContainer.svelte';
  import { WorkspaceStore } from '../workspace/workspaceStore.svelte';
  import { createViewerState } from '../../viewer/state/viewerState';
  import { createViewerDerived } from '../../viewer/state/viewerDerived';
  import { createViewerController } from '../../viewer/state/viewerController';
  import type { RendererEventHandlers } from '../../viewer/types/rendererEvents';
  import { resolveInitialViewerState } from '../../viewer/initialization/viewerInitializer';
  import { parseURLHash } from '../../viewer/osd/URLStateManager';
  import { ViewportState, VIEWPORT_STATE_CONTEXT_KEY } from '../../core/state/viewportState.svelte';
  import { setViewerContext, type ViewerSettingsTheme } from '../../viewer/context';
  import { createViewerFullscreenController } from '../../viewer/lifecycle/fullscreen';
  import { findFirstManifestId } from '../../viewer/iiif/collectionNavigation';
  import { navigateMango } from '@mango-iiif/collection-navigator/mango';
  import type { CollectionSelection } from '@mango-iiif/collection-navigator';

  interface Props { manifestId?: string; config?: ViewerConfig; plugins?: ViewerPlugin[]; chrome?: boolean; canvasIndex?: number; oncanvaschange?: (detail:{canvasIndex:number})=>void; }
  let { manifestId=$bindable(''), config=undefined, plugins=[], chrome=false, canvasIndex=undefined, oncanvaschange=undefined }:Props=$props();
  const normaliseConfigForViewer=(value?:ViewerConfig):ViewerConfig=>{
    const next=normaliseViewerConfig(value);
    if(next.sidebar?.open!==undefined)return next;
    return {...next,sidebar:{...next.sidebar,open:false}};
  };
  const readInitialConfig=()=>normaliseConfigForViewer(config);
  const initialConfig=readInitialConfig();
  const initialViewState=resolveInitialViewerState(initialConfig,typeof window!=='undefined'?parseURLHash(window.location.hash):{});
  const corePlugins=[createAnnotationFocusPlugin()];
  const createInitialState=()=>createViewerState({manifestId,config:initialConfig,plugins:[...corePlugins,...plugins],...initialViewState,selectedCanvasIndex:canvasIndex??initialViewState.selectedCanvasIndex});
  const viewerState=createInitialState();
  const viewerDerived=createViewerDerived(viewerState);
  let stageRef:ReturnType<typeof Stage>|null=$state(null);
  const controller=createViewerController({state:viewerState,derived:viewerDerived,dispatch:()=>undefined,applyViewBox:(box)=>stageRef?.setViewBox?.(box)});
  const {manifestEntry,collectionEntry,canvases,canvasThumbnails,mediaSource,mediaType,rendererComponent,overlayAnnotations,highlightIds,pluginSlots,leftVisible,allowThumbnails,allowCollection,allowMetadata,allowSearch,allowAnnotations,allowTools,allowLayers,contentsAvailable,avChaptersAvailable,avTranscriptAvailable,mediaSources,activeLayoutImages}=viewerDerived;
  const {selectedCanvasIndex,zoom,showThumbnails,showCollection,showMetadata,showSearch,showAnnotations,showTools,showSettings,showContents,showLayers,layerOpacities,layoutMode,rotation,activeAnnotationId,hoverAnnotationId,imageFilters}=viewerState;
  const avController=viewerDerived.av.controller;
  setContext(VIEWPORT_STATE_CONTEXT_KEY,new ViewportState());
  let normalisedConfig:ViewerConfig=$state(initialConfig);
  let theme:ViewerSettingsTheme=$state(['dark','light','sepia','midnight','ringo'].includes(initialConfig.theme??'')?initialConfig.theme as ViewerSettingsTheme:'dark');
  let locale=$state(initialConfig.language??'en');
  let settingsLayout=$state<'1x1'|'1x2'|'2x1'|'1x2-panel'|'2x2'>('1x1');
  let workspace=$state<WorkspaceStore|null>(null);
  let contentsTab=$state<'toc'|'transcript'>('toc');
  let sidebarCollapsed=$state(false);
  let showManifestManager=$state(false);
  let canZoom=$state(false), viewerRoot:HTMLElement|null=$state(null), isFullscreen=$state(false), lastCanvasIndex=get(selectedCanvasIndex);
  let lastConfigInput:ViewerConfig|undefined;
  let lastPluginsInput:ViewerPlugin[]|undefined;
  let configInitialized=false;
  let pluginsInitialized=false;
  const fullscreenController=createViewerFullscreenController({getRoot:()=>viewerRoot,getShadowHost:()=>viewerRoot?.getRootNode() instanceof ShadowRoot?(viewerRoot.getRootNode() as ShadowRoot).host:null,onChange:(state)=>isFullscreen=state.active});
  const pluginContext={viewer:{} as ViewerApi,events:controller.events,get config(){return normalisedConfig;}};
  const rendererHandlers:RendererEventHandlers={onMediaPlay:controller.handleMediaPlay,onMediaPause:controller.handleMediaPause,onMediaTimeUpdate:controller.handleMediaTimeUpdate,onMediaSeek:controller.handleMediaSeek,onMediaSegmentEnd:controller.handleMediaSegmentEnd,onModelChange:controller.handleModelChange,onAnnotationHover:controller.handleAnnotationHover,onAnnotationSelect:controller.handleAnnotationSelect,onAnnotationClear:controller.handleAnnotationClear};

  const viewerApi:ViewerApi={
    getViewBox:()=>getViewBox(),setViewBox:(box)=>setViewBox(box),getContentSize:()=>getContentSize(),getZoom:()=>getZoom(),setZoom:(v)=>setZoom(v),zoomIn:()=>zoomIn(),zoomOut:()=>zoomOut(),panTo:(x,y)=>panTo(x,y),
    getMediaType:()=>get(mediaType),getState:controller.getStateSnapshot,getCanvasIndex:controller.getCanvasIndex,getCanvasId:controller.getCanvasId,getCanvasCount:controller.getCanvasCount,setCanvasByIndex:controller.setCanvasByIndex,setCanvasById:controller.setCanvasById,
    setManifest:(id)=>setManifest(id),getManifestId:()=>manifestId||null,start:()=>stageRef?.start?.(),play:()=>stageRef?.play?.(),pause:()=>stageRef?.pause?.(),stop:()=>stageRef?.stop?.(),seekBy:(v)=>stageRef?.seekBy?.(v),seekTo:(v)=>stageRef?.seekTo?.(v),setMediaSegment:(a,b)=>stageRef?.setMediaSegment?.(a,b),
    setModelOrbit:(v)=>stageRef?.setModelOrbit?.(v),setModelTarget:(v)=>stageRef?.setModelTarget?.(v),setModelOrientation:(v)=>stageRef?.setModelOrientation?.(v),setModelPose:(v,o)=>stageRef?.setModelPose?.(v,o),getModelOrbit:()=>stageRef?.getModelOrbit?.()??null,getModelTarget:()=>stageRef?.getModelTarget?.()??null,getModelOrientation:()=>stageRef?.getModelOrientation?.()??null,getModelPose:()=>stageRef?.getModelPose?.()??null,
    addAnnotation:controller.addAnnotation,getAnnotations:controller.getAnnotations,setAnnotations:controller.setAnnotations,updateAnnotation:(id,patch)=>controller.updateAnnotation(id,patch),removeAnnotation:controller.removeAnnotation,
    selectAnnotation:(id,preventZoom)=>controller.handleAnnotationSelect({id,preventZoom}),clearAnnotationSelection:controller.handleAnnotationClear,getSelectedAnnotationId:()=>get(activeAnnotationId),
    getRendererExtension:()=>stageRef?.getRendererExtension?.()??null,getStageSize:()=>stageRef?.getStageSize?.()??{width:0,height:0},canvasToScreen:(point)=>stageRef?.canvasToScreen?.(point)??null,screenToCanvas:(point)=>stageRef?.screenToCanvas?.(point)??null,
    updateLayerOpacity:controller.updateLayerOpacity,getLayerOpacities:()=>get(layerOpacities),getMediaSources:()=>get(mediaSources),on:controller.on,off:controller.off
  };
  pluginContext.viewer=viewerApi;
  setViewerContext({state:viewerState,derived:viewerDerived,controller,settings:{get layout(){return settingsLayout;},set layout(v){if(v===settingsLayout)return;settingsLayout=v;if(v==='1x1'){workspace=null;return;}showMetadata.set(false);showSearch.set(false);showAnnotations.set(false);showTools.set(false);showSettings.set(false);showContents.set(false);showLayers.set(false);workspace??=new WorkspaceStore(manifestId);workspace.setLayoutPreset(v);},get theme(){return theme;},set theme(v){theme=v;},get locale(){return locale;},set locale(v){locale=v;normalisedConfig={...normalisedConfig,language:v};viewerState.config.set(normalisedConfig);},get layoutMode(){return get(layoutMode);},set layoutMode(v){controller.setLayoutMode(v);}}});

  const panelToggle=(panel:Parameters<typeof controller.setPanelOpen>[0],open:boolean)=>controller.setPanelOpen(panel,open);
  const openContents=(tab:'toc'|'transcript')=>{contentsTab=tab;panelToggle('contents',true);};
  const previousCanvas=()=>{const index=get(selectedCanvasIndex);controller.setCanvasByIndex(get(layoutMode)==='two-page'?Math.max(0,Math.floor(index/2)*2-2):index-1);};
  const nextCanvas=()=>{const index=get(selectedCanvasIndex);controller.setCanvasByIndex(get(layoutMode)==='two-page'?Math.min(get(canvases).length-1,Math.floor(index/2)*2+2):index+1);};
  const handleCollectionSelect=async(selection:CollectionSelection)=>navigateMango({getManifestId:()=>manifestId||null,getCanvasCount:controller.getCanvasCount,setManifest:(id)=>manifestId=id,setCanvasById:controller.setCanvasById,on:controller.on},selection);

  export function getContentSize():ContentSize|null{return stageRef?.getContentSize?.()??null;}
  export function getViewBox():ViewBox|null{return stageRef?.getViewBox?.()??null;}
  export function setViewBox(box:ViewBox):void{stageRef?.setViewBox?.(box);}
  export function getZoom():number{return get(zoom)>0?Math.max(10,Math.round(get(zoom)*100)):100;}
  export function setZoom(percent:number):void{if(Number.isFinite(percent))stageRef?.setZoom?.(percent/100);}
  export function zoomIn():void{stageRef?.zoomBy?.(1.2);}
  export function zoomOut():void{stageRef?.zoomBy?.(.8);}
  export function panTo(x:number,y:number):void{const box=getViewBox();if(box)setViewBox({x:x-box.w/2,y:y-box.h/2,w:box.w,h:box.h});}
  export function getMediaType(){return get(mediaType);}
  export function setModelOrbit(v:string):void{stageRef?.setModelOrbit?.(v);} export function setModelTarget(v:string):void{stageRef?.setModelTarget?.(v);} export function setModelOrientation(v:string):void{stageRef?.setModelOrientation?.(v);}
  export function setModelPose(v:ModelPose,o?:ModelPoseOptions):void{stageRef?.setModelPose?.(v,o);} export function getModelOrbit():string|null{return stageRef?.getModelOrbit?.()??null;} export function getModelTarget():string|null{return stageRef?.getModelTarget?.()??null;} export function getModelOrientation():string|null{return stageRef?.getModelOrientation?.()??null;} export function getModelPose():ModelPose|null{return stageRef?.getModelPose?.()??null;}
  export function getState(){return controller.getStateSnapshot();} export function getCanvasIndex():number{return controller.getCanvasIndex();} export function getCanvasId():string|null{return controller.getCanvasId();} export function getCanvasCount():number{return controller.getCanvasCount();} export function setCanvasByIndex(v:number):void{controller.setCanvasByIndex(v);} export function setCanvasById(v:string):void{controller.setCanvasById(v);}
  export function setManifest(id:string):void{viewerState.collectionId.set('');manifestId=id;} export function getManifestId():string|null{return manifestId||null;}
  export function start():void{stageRef?.start?.();} export function play():void{stageRef?.play?.();} export function pause():void{stageRef?.pause?.();} export function stop():void{stageRef?.stop?.();} export function seekBy(v:number):void{stageRef?.seekBy?.(v);} export function seekTo(v:number):void{stageRef?.seekTo?.(v);} export function setMediaSegment(a:number,b:number):void{stageRef?.setMediaSegment?.(a,b);}
  export function addAnnotation(v:unknown):Promise<void>{return controller.addAnnotation(v);} export function getAnnotations(){return controller.getAnnotations();} export function setAnnotations(v:unknown[]){return controller.setAnnotations(v);} export function updateAnnotation(id:string,patch:Parameters<typeof controller.updateAnnotation>[1]){return controller.updateAnnotation(id,patch);} export function removeAnnotation(v:string):Promise<void>{return controller.removeAnnotation(v);}
  export function selectAnnotation(id:string,preventZoom=false){controller.handleAnnotationSelect({id,preventZoom});} export function clearAnnotationSelection(){controller.handleAnnotationClear();} export function getSelectedAnnotationId(){return get(activeAnnotationId);}
  export function getRendererExtension(){return stageRef?.getRendererExtension?.()??null;} export function getStageSize(){return stageRef?.getStageSize?.()??{width:0,height:0};} export function canvasToScreen(point:{x:number;y:number}){return stageRef?.canvasToScreen?.(point)??null;} export function screenToCanvas(point:{x:number;y:number}){return stageRef?.screenToCanvas?.(point)??null;}
  export function updateLayerOpacity(id:string,v:number):void{controller.updateLayerOpacity(id,v);} export function getLayerOpacities(){return get(layerOpacities);} export function getMediaSources(){return get(mediaSources);}
  export function on<K extends keyof ViewerEventMap>(e:K,h:(p:ViewerEventMap[K])=>void){return controller.on(e,h);} export function off<K extends keyof ViewerEventMap>(e:K,h:(p:ViewerEventMap[K])=>void){controller.off(e,h);} export function setEventTarget(v:EventTarget):void{controller.setEventTarget(v);}

  $effect.pre(()=>{if(configInitialized&&config===lastConfigInput)return;configInitialized=true;lastConfigInput=config;normalisedConfig=normaliseConfigForViewer(config);viewerState.config.set(normalisedConfig);});
  $effect.pre(()=>{if(pluginsInitialized&&plugins===lastPluginsInput)return;pluginsInitialized=true;lastPluginsInput=plugins;viewerState.plugins.set([...corePlugins,...plugins]);});
  $effect.pre(()=>viewerState.manifestId.set(manifestId??''));
  $effect(()=>{if(canvasIndex!==undefined&&canvasIndex!==get(selectedCanvasIndex))controller.setCanvasByIndex(canvasIndex);});
  $effect(()=>{const current=$selectedCanvasIndex;if(current!==lastCanvasIndex){lastCanvasIndex=current;oncanvaschange?.({canvasIndex:current});}});
  $effect(()=>{const collection=$collectionEntry;if(!collection?.json||manifestId!==collection.id)return;const first=findFirstManifestId(collection.json);if(first)manifestId=first;});
  onMount(()=>fullscreenController.attach()); onDestroy(()=>controller.destroy());
</script>

<div class="viewer" class:viewer--headless={!chrome} data-theme={theme} bind:this={viewerRoot}>
  {#if chrome}<div class="viewer__top-row"><ViewerHeader {manifestId} manifestEntry={$manifestEntry}/><div class="viewer__top-actions">{#if $pluginSlots.top.length}<PluginSlot slot="top" plugins={$pluginSlots.top} {pluginContext}/>{/if}<button class="viewer__fullscreen-btn viewer__fullscreen-btn--labelled" type="button" onclick={()=>fullscreenController.toggle()} aria-label={isFullscreen?$t('viewer.stage.controls.closeFullscreen'):$t('viewer.stage.controls.enterFullscreen')}>{#if isFullscreen}<Shrink aria-hidden="true"/>{:else}<Expand aria-hidden="true"/>{/if}<span>{isFullscreen?$t('viewer.stage.controls.closeFullscreen'):$t('viewer.stage.controls.fullscreen')}</span></button></div></div>{/if}
  {#if chrome&&normalisedConfig.sidebar?.enabled!==false&&sidebarCollapsed}<button class="viewer__expand-sidebar" type="button" onclick={()=>sidebarCollapsed=false} aria-label={$t('viewer.stage.controls.expandSidebar')} title={$t('viewer.stage.controls.expandSidebar')}><ChevronsRight aria-hidden="true"/></button>{/if}
  <div class="viewer__grid" class:viewer__grid--controls={chrome&&normalisedConfig.sidebar?.enabled!==false&&!sidebarCollapsed} class:viewer__grid--left={chrome&&$leftVisible&&!sidebarCollapsed} class:viewer__grid--nav-compact={chrome&&$leftVisible&&!sidebarCollapsed} class:viewer__grid--sidebar-right={chrome&&normalisedConfig.sidebar?.position==='right'}>
    {#if chrome&&normalisedConfig.sidebar?.enabled!==false&&!sidebarCollapsed}
      <aside class="viewer__control-rail" aria-label={$t('viewer.stage.controls.label')}><ViewerDock compact variant="sidebar" iconOnly={$leftVisible} galleryActive={$showThumbnails} allowThumbnails={$allowThumbnails} allowCollection={$allowCollection} allowContents={$contentsAvailable} allowChapters={$contentsAvailable&&$avChaptersAvailable} allowTranscript={$contentsAvailable&&$avTranscriptAvailable} allowSearch={$allowSearch} allowMetadata={$allowMetadata} allowAnnotations={$allowAnnotations} allowTools={$allowTools} allowLayers={$allowLayers} allowSettings={normalisedConfig.showSettings!==false} showThumbnails={$showThumbnails} showCollection={$showCollection} showContents={$showContents} showSearch={$showSearch} showMetadata={$showMetadata} showAnnotations={$showAnnotations} showTools={$showTools} showLayers={$showLayers} showSettings={$showSettings} {showManifestManager} {contentsTab} oncollapse={()=>sidebarCollapsed=true} onmanifesttoggle={()=>showManifestManager=!showManifestManager} ongalleryopen={()=>showThumbnails.set(!$showThumbnails)} oncontentsopen={openContents} onpanelToggle={(d)=>panelToggle(d.panel,d.open)}/></aside>
      <LeftPanelStack visible={$leftVisible} redesigned {contentsTab} showCollection={$showCollection} showAnnotations={$showAnnotations} showTools={$showTools} showContents={$showContents} showSearch={$showSearch} showMetadata={$showMetadata} showSettings={$showSettings} showLayers={$showLayers} leftPlugins={$pluginSlots.left} {pluginContext} onpanelToggle={(p,o)=>panelToggle(p,o)} oncollectionSelect={handleCollectionSelect}/>
    {/if}
    {#if showManifestManager}<div class="viewer__manifest-overlay"><ManifestManager {workspace} onclose={()=>showManifestManager=false} onsingleload={(id)=>setManifest(id)}/></div>{/if}
    <main class="stage stage--viewer" class:stage--joined-sidebar-left={chrome&&normalisedConfig.sidebar?.enabled!==false&&!sidebarCollapsed&&!$leftVisible&&normalisedConfig.sidebar?.position!=='right'} class:stage--joined-sidebar-right={chrome&&normalisedConfig.sidebar?.enabled!==false&&!sidebarCollapsed&&!$leftVisible&&normalisedConfig.sidebar?.position==='right'} aria-label={$t('viewer.stage.label')}>
      {#if settingsLayout==='1x1'}
      <div class="stage__primary stage__viewer-frame">
      {#if $layoutMode==='gallery'}<StageGalleryView canvases={$canvases} thumbnails={$canvasThumbnails} selectedCanvasIndex={$selectedCanvasIndex} onselect={(d)=>{controller.setCanvasByIndex(d.index);controller.setLayoutMode('single');}}/>
      {:else}<Stage bind:this={stageRef} bind:canZoom rendererComponent={$rendererComponent} {avController} mediaSource={$mediaSource} annotations={$overlayAnnotations} highlightIds={$highlightIds} activeAnnotationId={$activeAnnotationId} hoverAnnotationId={$hoverAnnotationId} overlayPlugins={$pluginSlots.overlay} {pluginContext} isFetching={$manifestEntry?.isFetching??false} error={$manifestEntry?.error??''} imageFilters={$imageFilters} mediaType={$mediaType} viewerConfig={normalisedConfig} showDock={false} allowThumbnails={$allowThumbnails} allowSearch={$allowSearch} allowMetadata={$allowMetadata} allowAnnotations={$allowAnnotations} allowTools={$allowTools} allowLayers={$allowLayers} allowSettings={normalisedConfig.showSettings!==false} allowContents={$contentsAvailable} showThumbnails={$showThumbnails} showContents={$showContents} showSearch={$showSearch} showMetadata={$showMetadata} showAnnotations={$showAnnotations} showTools={$showTools} showLayers={$showLayers} layers={$mediaSources} layerOpacities={$layerOpacities} {rendererHandlers} rotation={$rotation} initialViewBox={initialViewState.viewBox} layoutMode={$layoutMode} activeLayoutImages={$activeLayoutImages} onviewboxchange={controller.handleViewBoxChange} onzoomchange={controller.handleZoomChange} onrotationchange={controller.handleRotationChange} onpaneltoggle={(d)=>panelToggle(d.panel,d.open)} onrendererready={(d)=>controller.emitEvent('rendererReady',d)} onstageresize={(d)=>controller.emitEvent('stageResize',d)}/>{/if}
      {#if chrome&&$layoutMode!=='gallery'}<StageToolbar {canZoom} hasSource={Boolean($mediaSource)} placement="below" mediaType={$mediaType} selectedCanvasIndex={$selectedCanvasIndex} totalCanvases={$canvases.length} zoomPercent={getZoom()} rotation={$rotation} onhome={()=>stageRef?.goHome?.()} onzoomIn={zoomIn} onzoomOut={zoomOut} onsetZoomPercent={(d)=>setZoom(d.percent)} onrotate={controller.handleRotationChange} onsetCanvasIndex={(d)=>controller.setCanvasByIndex(d.index)} onprevCanvas={previousCanvas} onnextCanvas={nextCanvas}/>{/if}
      </div>
      {#if chrome&&$showThumbnails&&$layoutMode!=='gallery'}<Gallery redesigned canvases={$canvases} canvasThumbnails={$canvasThumbnails} selectedCanvasIndex={$selectedCanvasIndex} onpanelToggle={(d)=>panelToggle(d.panel,d.open)} oncanvasSelect={(d)=>controller.setCanvasByIndex(d.index)} onviewall={()=>controller.setLayoutMode('gallery')}/>{/if}
      {#if $pluginSlots.bottom.length}<div class="stage__bottom"><PluginSlot plugins={$pluginSlots.bottom} {pluginContext}/></div>{/if}
      {:else if workspace}
        <GridContainer node={workspace.layout} activeWindowId={workspace.activeWindowId} onfocuswindow={(id)=>workspace?.setActiveWindow(id)} onmovewindow={(d)=>workspace?.moveWindow(d.id,d.direction)} onclosewindow={(id)=>{workspace?.closeWindow(id);if(workspace?.layout.type==='window'){settingsLayout='1x1';workspace=null;}}} onloadmanifest={(d)=>{workspace?.setWindowManifest(d.id,d.manifestId);workspace?.setActiveWindow(d.id);}} oncanvaschange={(d)=>workspace?.setWindowCanvasIndex(d.id,d.canvasIndex)} onresizesplit={(d)=>workspace?.updateSplitSizes(d.targetId,d.sizes)} onopenmanifestmanager={(id)=>{workspace?.setActiveWindow(id);showManifestManager=true;}}/>
      {/if}
    </main>
    {#if chrome&&$pluginSlots.right.length}<aside class="panel-stack panel-stack--right"><PluginSlot plugins={$pluginSlots.right} {pluginContext}/></aside>{/if}
  </div>
</div>
<style>
  .viewer {
    --viewer-bg: #0f141b;
    --viewer-surface: #151d26;
    --viewer-panel: #121922;
    --viewer-panel-strong: #1b242e;
    --viewer-panel-border: rgba(255, 255, 255, 0.08);
    --viewer-text: #e8edf4;
    --viewer-muted: #9aa6b2;
    --viewer-accent: #ff4fa2;
    --viewer-accent-2: #2ac7ff;
    --viewer-accent-tools: #a3e635;
    --viewer-stage: #111720;
    --viewer-stage-glow: rgba(42, 199, 255, 0.12);
    --viewer-stage-tail: #0b0f14;
    --viewer-control-rail-bg: linear-gradient(180deg, rgba(20, 28, 37, 0.92), rgba(14, 20, 29, 0.92));
    --viewer-stage-bottom-bg: rgba(12, 16, 22, 0.72);
    --viewer-toolbar-separator: rgba(255, 255, 255, 0.14);
    --viewer-toolbar-group-border: rgba(255, 255, 255, 0.1);
    --viewer-toolbar-group-bg: transparent;
    --viewer-toolbar-button-bg: rgba(255, 255, 255, 0.03);
    --viewer-toolbar-button-hover-bg: rgba(255, 255, 255, 0.08);
    --viewer-toolbar-value-text: rgba(230, 236, 246, 0.96);
    --viewer-toolbar-value-bg: transparent;
    --viewer-close-button-border: rgba(255, 255, 255, 0.18);
    --viewer-close-button-bg: rgba(255, 255, 255, 0.1);
    --viewer-close-button-hover-bg: rgba(255, 255, 255, 0.16);
    --viewer-close-button-hover-border: rgba(255, 255, 255, 0.34);
    --viewer-close-button-color: var(--viewer-text);
    --viewer-focus-ring: rgba(42, 199, 255, 0.7);
    --viewer-chrome-radius: 0;
    --viewer-close-button-radius: 0;

    position: relative;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 16px;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    padding: 20px 0 0;
    border: 1px solid #1c2530;
    border-radius: 0;
    background: radial-gradient(120% 120% at 10% 0%, #1d2632 0%, #111720 55%, #0b0f14 100%);
    color: var(--viewer-text);
    font-family: sans-serif;
    font-size: 16px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
    text-align: left;
    container: mango-viewer / size;
  }

  .viewer__top-row {
    display: flex;
    align-items: flex-start;
    min-width: 0;
    gap: 12px;
    padding: 0 20px;
  }

  .viewer__top-row :global(.viewer-header) {
    flex: 1;
    min-width: 0;
  }

  .viewer__top-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .viewer__fullscreen-btn {
    z-index: 10;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 34px;
    height: 34px;
    border: 1px solid var(--viewer-panel-border);
    border-radius: 0;
    background: var(--viewer-panel);
    color: var(--viewer-text);
    cursor: pointer;
    font: inherit;
    font-size: 16px;
  }

  .viewer__fullscreen-btn--labelled {
    width: auto;
    padding-inline: 10px;
    border-color: transparent;
    background: transparent;
    font-size: 13px;
  }

  .viewer__fullscreen-btn :global(svg) {
    width: 18px;
    height: 18px;
  }

  .viewer__expand-sidebar {
    position: absolute;
    top: 50%;
    left: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    width: 38px;
    height: 58px;
    padding: 0;
    border: 1px solid var(--viewer-panel-border);
    border-left: 0;
    border-radius: 0;
    background: var(--viewer-panel-strong);
    color: var(--viewer-text);
    cursor: pointer;
    transform: translateY(-50%);
  }

  .viewer[data-theme='light'] {
    --viewer-bg: #f3f5f8;
    --viewer-surface: #f7f8fb;
    --viewer-panel: #e9edf3;
    --viewer-panel-strong: #dde4ed;
    --viewer-panel-border: rgba(34, 48, 65, 0.12);
    --viewer-text: #223041;
    --viewer-muted: #586576;
    --viewer-accent: #53719c;
    --viewer-accent-2: #357f99;
    --viewer-accent-tools: #53719c;
    --viewer-stage: #f3f5f8;
    --viewer-stage-glow: rgba(108, 174, 199, 0.16);
    --viewer-stage-tail: #fff;
    --viewer-control-rail-bg: linear-gradient(180deg, rgba(241, 245, 251, 0.95), rgba(229, 236, 245, 0.95));
    --viewer-stage-bottom-bg: rgba(241, 245, 251, 0.9);
    --viewer-toolbar-separator: rgba(34, 48, 65, 0.16);
    --viewer-toolbar-group-border: rgba(34, 48, 65, 0.16);
    --viewer-toolbar-button-bg: rgba(255, 255, 255, 0.84);
    --viewer-toolbar-button-hover-bg: rgba(124, 150, 190, 0.2);
    --viewer-toolbar-value-text: #223041;
    --viewer-close-button-border: rgba(34, 48, 65, 0.2);
    --viewer-close-button-bg: rgba(255, 255, 255, 0.92);
    --viewer-close-button-hover-bg: rgba(233, 240, 248, 0.96);
    --viewer-close-button-hover-border: rgba(34, 48, 65, 0.3);
    --viewer-close-button-color: #223041;
    --viewer-search-input-bg: rgba(255, 255, 255, 0.92);
    --viewer-search-clear-bg: rgba(124, 150, 190, 0.2);
    --viewer-search-item-bg: rgba(255, 255, 255, 0.78);
    --viewer-search-item-hover-bg: rgba(124, 150, 190, 0.22);
    --viewer-well-bg: rgba(34, 48, 65, 0.07);
    --viewer-focus-ring: #0b6fa4;
    border-color: #dbe2eb;
    background: radial-gradient(135% 135% at 10% 0%, #e6f1ff 0%, #f5faff 45%, #fff 100%);
  }

  .viewer[data-theme='sepia'] {
    --viewer-bg: #eee4d2;
    --viewer-surface: #f7f0e3;
    --viewer-panel: #e8dcc6;
    --viewer-panel-strong: #dac9aa;
    --viewer-panel-border: rgba(76, 58, 35, 0.16);
    --viewer-text: #3d3023;
    --viewer-muted: #67563f;
    --viewer-accent: #a86f46;
    --viewer-accent-2: #2f858b;
    --viewer-accent-tools: #66864a;
    --viewer-stage: #f4ecde;
    --viewer-stage-glow: rgba(47, 133, 139, 0.13);
    --viewer-stage-tail: #fffaf0;
    --viewer-control-rail-bg: linear-gradient(180deg, rgba(241, 231, 212, 0.96), rgba(229, 214, 188, 0.96));
    --viewer-stage-bottom-bg: rgba(241, 231, 212, 0.9);
    --viewer-toolbar-separator: rgba(76, 58, 35, 0.16);
    --viewer-toolbar-group-border: rgba(76, 58, 35, 0.16);
    --viewer-toolbar-button-bg: rgba(255, 250, 240, 0.86);
    --viewer-toolbar-button-hover-bg: rgba(47, 133, 139, 0.15);
    --viewer-toolbar-value-text: #3d3023;
    --viewer-close-button-border: rgba(76, 58, 35, 0.2);
    --viewer-close-button-bg: rgba(255, 250, 240, 0.94);
    --viewer-close-button-hover-bg: rgba(239, 227, 207, 0.96);
    --viewer-close-button-hover-border: rgba(76, 58, 35, 0.32);
    --viewer-close-button-color: #3d3023;
    --viewer-search-input-bg: rgba(255, 250, 240, 0.94);
    --viewer-search-clear-bg: rgba(47, 133, 139, 0.14);
    --viewer-search-item-bg: rgba(255, 250, 240, 0.78);
    --viewer-search-item-hover-bg: rgba(47, 133, 139, 0.16);
    --viewer-well-bg: rgba(76, 58, 35, 0.09);
    --viewer-focus-ring: #1b6b70;
    border-color: #d8c7aa;
    background: radial-gradient(135% 135% at 10% 0%, #f5ead7 0%, #eee4d2 48%, #e5d7bf 100%);
  }

  .viewer[data-theme='midnight'] {
    --viewer-bg: #07111f;
    --viewer-surface: #0a1728;
    --viewer-panel: #0c192a;
    --viewer-panel-strong: #13263d;
    --viewer-panel-border: rgba(126, 180, 235, 0.15);
    --viewer-text: #edf6ff;
    --viewer-muted: #91a7bf;
    --viewer-accent: #a78bfa;
    --viewer-accent-2: #38bdf8;
    --viewer-accent-tools: #5eead4;
    --viewer-stage: #050d18;
    --viewer-stage-glow: rgba(56, 189, 248, 0.15);
    --viewer-stage-tail: #020711;
    --viewer-control-rail-bg: linear-gradient(180deg, rgba(12, 29, 48, 0.96), rgba(5, 15, 28, 0.96));
    --viewer-stage-bottom-bg: rgba(5, 15, 28, 0.88);
    --viewer-toolbar-button-bg: rgba(126, 180, 235, 0.08);
    --viewer-toolbar-button-hover-bg: rgba(126, 180, 235, 0.16);
    --viewer-toolbar-value-text: #edf6ff;
    --viewer-well-bg: rgba(3, 8, 16, 0.45);
    --viewer-focus-ring: #38bdf8;
    border-color: #142b46;
    background: radial-gradient(130% 130% at 8% 0%, #142a46 0%, #07111f 50%, #020711 100%);
  }

  .viewer[data-theme='ringo'] {
    --viewer-bg: #ffd60a;
    --viewer-surface: #ffe987;
    --viewer-panel: #ffe15c;
    --viewer-panel-strong: #ffcf1f;
    --viewer-panel-border: rgba(74, 48, 0, 0.24);
    --viewer-text: #2e2000;
    --viewer-muted: #6d5200;
    --viewer-accent: #a8232b;
    --viewer-accent-2: #0072c6;
    --viewer-accent-tools: #00875a;
    --viewer-stage: #fff6c2;
    --viewer-stage-glow: rgba(168, 35, 43, 0.1);
    --viewer-stage-tail: #fffdf0;
    --viewer-control-rail-bg: rgba(255, 225, 92, 0.96);
    --viewer-stage-bottom-bg: rgba(255, 244, 184, 0.92);
    --viewer-toolbar-separator: rgba(74, 48, 0, 0.2);
    --viewer-toolbar-group-border: rgba(74, 48, 0, 0.2);
    --viewer-toolbar-button-bg: rgba(156, 43, 34, 0.94);
    --viewer-toolbar-button-hover-bg: rgba(124, 32, 25, 0.98);
    --viewer-toolbar-button-color: #fff4b8;
    --viewer-toolbar-value-text: #2e2000;
    --viewer-nav-button-bg: rgba(156, 43, 34, 0.94);
    --viewer-nav-button-hover-bg: rgba(124, 32, 25, 0.98);
    --viewer-nav-button-border: rgba(74, 48, 0, 0.28);
    --viewer-nav-button-color: #fff4b8;
    --viewer-nav-button-active-bg: rgba(124, 32, 25, 0.98);
    --viewer-nav-button-active-border: #fff4b8;
    --viewer-close-button-border: rgba(74, 48, 0, 0.24);
    --viewer-close-button-bg: rgba(255, 252, 226, 0.94);
    --viewer-close-button-hover-bg: rgba(255, 238, 160, 0.96);
    --viewer-close-button-hover-border: rgba(74, 48, 0, 0.36);
    --viewer-close-button-color: #2e2000;
    --viewer-search-input-bg: rgba(255, 252, 226, 0.94);
    --viewer-search-clear-bg: rgba(168, 35, 43, 0.16);
    --viewer-search-item-bg: rgba(255, 252, 226, 0.78);
    --viewer-search-item-hover-bg: rgba(168, 35, 43, 0.18);
    --viewer-well-bg: rgba(74, 48, 0, 0.1);
    --viewer-focus-ring: #0056a3;
    border-color: #e0a800;
    background: var(--viewer-bg);
  }

  .viewer__grid {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    width: 100%;
    height: 100%;
    max-height: 100%;
    min-height: 0;
    row-gap: 18px;
    column-gap: 18px;
  }

  .viewer__manifest-overlay {
    position: absolute;
    z-index: 30;
    inset: 0;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .viewer__grid--controls {
    grid-template-columns: 220px minmax(0, 1fr);
    column-gap: 0;
  }

  .viewer__grid--left {
    grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  }

  .viewer__grid.viewer__grid--controls.viewer__grid--left {
    grid-template-columns: 220px minmax(320px, 410px) minmax(0, 1fr);
  }

  .viewer__grid.viewer__grid--controls.viewer__grid--left.viewer__grid--nav-compact {
    grid-template-columns: 72px minmax(320px, 410px) minmax(0, 1fr);
  }

  .viewer--headless .viewer__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .viewer__grid.viewer__grid--sidebar-right.viewer__grid--controls:not(.viewer__grid--left) {
    grid-template-columns: minmax(0, 1fr) 220px;
  }

  .viewer__grid.viewer__grid--sidebar-right.viewer__grid--controls.viewer__grid--left {
    grid-template-columns: minmax(0, 1fr) minmax(320px, 410px) 220px;
  }

  .viewer__grid.viewer__grid--sidebar-right.viewer__grid--controls.viewer__grid--left.viewer__grid--nav-compact {
    grid-template-columns: minmax(0, 1fr) minmax(320px, 410px) 72px;
  }

  .viewer__grid--sidebar-right > .stage {
    grid-column: 1;
    grid-row: 1;
  }

  .viewer__grid--sidebar-right > :global(.panel-stack--left) {
    grid-column: 2;
    grid-row: 1;
  }

  .viewer__grid--sidebar-right > .viewer__control-rail {
    grid-column: 3;
    grid-row: 1;
  }

  .viewer__grid--sidebar-right:not(.viewer__grid--left) > .viewer__control-rail {
    grid-column: 2;
  }

  .viewer__control-rail {
    position: relative;
    z-index: 4;
    display: grid;
    align-content: start;
    justify-items: stretch;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 0;
    padding: 24px 14px 18px;
    overflow: hidden;
    border: 1px solid var(--viewer-panel-border);
    border-right: 0;
    border-radius: var(--viewer-chrome-radius) 0 0 var(--viewer-chrome-radius);
    background: var(--viewer-control-rail-bg);
  }

  .viewer__grid--nav-compact > .viewer__control-rail {
    width: 72px;
    padding-inline: 10px;
  }

  .viewer__grid--sidebar-right > .viewer__control-rail {
    border-right: 0;
    border-left: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
  }

  .stage {
    position: relative;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    grid-auto-rows: auto;
    gap: 12px;
    align-content: start;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .stage__primary {
    position: relative;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border-radius: var(--viewer-chrome-radius);
  }

  .stage__primary :global(.stage__container),
  .stage__primary :global(.stage__media) {
    min-width: 0;
    min-height: 0;
    height: 100%;
  }

  .stage__primary :global(.stage__media) {
    border: 0;
    border-radius: var(--viewer-chrome-radius);
  }

  .stage__primary :global(.stage__toolbar--below) {
    position: absolute;
    z-index: 12;
    left: 50%;
    bottom: 14px;
    width: min(calc(100% - 24px), 560px);
    margin: 0;
    padding: 6px;
    border: 1px solid var(--viewer-panel-border);
    border-radius: 0;
    background: var(--viewer-stage-bottom-bg);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.34);
    backdrop-filter: blur(12px);
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, 8px);
    transition: opacity 220ms ease, transform 220ms ease;
  }

  .stage__primary:hover :global(.stage__toolbar--below),
  .stage__primary:focus-within :global(.stage__toolbar--below) {
    opacity: 1;
    pointer-events: auto;
    transform: translate(-50%, 0);
  }

  .stage--joined-sidebar-left .stage__primary,
  .stage--joined-sidebar-left .stage__primary :global(.stage__media) {
    border-radius: 0 var(--viewer-chrome-radius) var(--viewer-chrome-radius) 0;
  }

  .stage--joined-sidebar-right .stage__primary,
  .stage--joined-sidebar-right .stage__primary :global(.stage__media) {
    border-radius: var(--viewer-chrome-radius) 0 0 var(--viewer-chrome-radius);
  }

  .stage__bottom {
    display: grid;
    gap: 12px;
  }

  .viewer :global(button),
  .viewer :global(input),
  .viewer :global(select),
  .viewer :global(textarea),
  .viewer :global(.viewer-sidebar__button),
  .viewer :global(.viewer-sidebar__collapse),
  .viewer :global(.viewer-mobile-nav__button),
  .viewer :global(.viewer__dock-button),
  .viewer :global(.stage__toolbar-button),
  .viewer :global(.stage__toolbar-group),
  .viewer :global(.stage__toolbar-input),
  .viewer :global(.panel__close),
  .viewer :global(.gallery__close),
  .viewer :global(.gallery__button),
  .viewer :global(.plugin-panel__panel) {
    border-radius: 0;
  }

  .viewer :global(.viewer-sidebar__button) {
    border-radius: 10px;
  }

  .panel-stack--right {
    min-width: 260px;
  }

  @media (max-width: 1024px) {
    .viewer__grid,
    .viewer__grid--left,
    .viewer__grid--sidebar-right:not(.viewer__grid--left),
    .viewer__grid--sidebar-right.viewer__grid--left {
      grid-template-columns: 56px minmax(0, 1fr);
    }

    .viewer__grid--sidebar-right > .stage {
      grid-column: 2;
    }

    .viewer__grid--sidebar-right > .viewer__control-rail {
      grid-column: 1;
      border-right: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
      border-left: 0;
    }

    .viewer__grid :global(.panel-stack--left) {
      position: absolute;
      z-index: 20;
      inset: 0 auto 0 56px;
      width: min(360px, calc(100% - 56px));
    }
  }
</style>
