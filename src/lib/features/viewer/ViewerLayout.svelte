<script lang="ts">
  import { get } from 'svelte/store';
  import { onDestroy, onMount, setContext } from 'svelte';
  import { ChevronsRight, Expand, Shrink } from '@lucide/svelte';
  import { setLocale, t } from '../../core/i18n';
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
  import GalleryStrip from '../../viewer/ui/GalleryStrip.svelte';
  import ManifestManager from '../workspace/ManifestManager.svelte';
  import GridContainer from '../workspace/GridContainer.svelte';
  import { WorkspaceStore } from '../workspace/workspaceStore.svelte';
  import { createViewerState } from '../../viewer/state/viewerState';
  import { createViewerDerived } from '../../viewer/state/viewerDerived';
  import { createViewerController } from '../../viewer/state/viewerController';
  import type { RendererEventHandlers } from '../../viewer/types/rendererEvents';
  import type { AnnotationPatchOptions } from '../../viewer/state/controllers/AnnotationController';
  import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
  import { resolveInitialViewerState } from '../../viewer/initialization/viewerInitializer';
  import { parseURLHash } from '../../viewer/osd/URLStateManager';
  import { ViewportState, VIEWPORT_STATE_CONTEXT_KEY } from '../../core/state/viewportState.svelte';
  import { isViewerSettingsTheme, setViewerContext, type ViewerSettingsTheme } from '../../viewer/context';
  import { resolveViewerTheme } from '../../core/themes';
  import '../../core/themes.css';
  import { createViewerFullscreenController } from '../../viewer/lifecycle/fullscreen';
  import { findFirstManifestId } from '../../viewer/iiif/collectionNavigation';
  import { navigateMango } from '@mango-iiif/collection-navigator/mango';
  import type { CollectionSelection } from '@mango-iiif/collection-navigator';

  interface Props { manifestId?: string; config?: ViewerConfig; plugins?: ViewerPlugin[]; chrome?: boolean; toolbar?: boolean; canvasIndex?: number; oncanvaschange?: (detail:{canvasIndex:number})=>void; /** Draw annotations on the stage. Off for hosts that draw their own, such as an editor. */ annotationOverlay?: boolean; /** Asked before the viewer's own controls turn the page. Return false to stay. */ onbeforecanvaschange?: (detail:{canvasIndex:number})=>boolean|void; }
  let { manifestId=$bindable(''), config=undefined, plugins=[], chrome=false, toolbar=undefined, canvasIndex=undefined, oncanvaschange=undefined, annotationOverlay=true, onbeforecanvaschange=undefined }:Props=$props();
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
  const {manifestEntry,collectionEntry,canvases,canvasThumbnails,mediaSource,mediaType,rendererComponent,annotations,overlayAnnotations,highlightIds,pluginSlots,leftVisible,allowThumbnails,thumbnailsInSidebar,allowCollection,allowMetadata,allowSearch,allowAnnotations,allowTools,allowLayers,contentsAvailable,avChaptersAvailable,avTranscriptAvailable,mediaSources,activeLayoutImages}=viewerDerived;
  const {userAnnotations,selectedCanvasIndex,zoom,showThumbnails,showCollection,showMetadata,showSearch,showAnnotations,showTools,showSettings,showContents,showLayers,layerOpacities,layoutMode,rotation,activeAnnotationId,hoverAnnotationId,imageFilters}=viewerState;
  const avController=viewerDerived.av.controller;
  const viewportState=setContext(VIEWPORT_STATE_CONTEXT_KEY,new ViewportState({selectedCanvasIndex:get(selectedCanvasIndex)}));
  let normalisedConfig:ViewerConfig=$state(initialConfig);
  let theme:ViewerSettingsTheme=$state(resolveViewerTheme(initialConfig.theme));
  let locale=$state(initialConfig.language??'en');
  let settingsLayout=$state<'1x1'|'1x2'|'2x1'|'1x2-panel'|'2x2'>('1x1');
  let workspace=$state<WorkspaceStore|null>(null);
  let contentsTab=$state<'toc'|'transcript'>('toc');
  let sidebarCollapsed=$state(false);
  let showControls=$state(true);
  let narrow=$state(false);
  let mobile=$state(false);
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
    getViewBox:()=>getViewBox(),setViewBox:(box)=>setViewBox(box),getContentSize:()=>getContentSize(),getZoom:()=>getZoom(),setZoom:(v)=>setZoom(v),goHome:()=>goHome(),zoomIn:()=>zoomIn(),zoomOut:()=>zoomOut(),panTo:(x,y)=>panTo(x,y),
    getMediaType:()=>get(mediaType),getState:controller.getStateSnapshot,getCanvasIndex:controller.getCanvasIndex,getCanvasId:controller.getCanvasId,getCanvasCount:controller.getCanvasCount,setCanvasByIndex:controller.setCanvasByIndex,setCanvasById:controller.setCanvasById,
    setManifest:(id)=>setManifest(id),getManifestId:()=>manifestId||null,start:()=>stageRef?.start?.(),play:()=>stageRef?.play?.(),pause:()=>stageRef?.pause?.(),stop:()=>stageRef?.stop?.(),seekBy:(v)=>stageRef?.seekBy?.(v),seekTo:(v)=>stageRef?.seekTo?.(v),setMediaSegment:(a,b)=>stageRef?.setMediaSegment?.(a,b),
    setModelOrbit:(v)=>stageRef?.setModelOrbit?.(v),setModelTarget:(v)=>stageRef?.setModelTarget?.(v),setModelOrientation:(v)=>stageRef?.setModelOrientation?.(v),setModelPose:(v,o)=>stageRef?.setModelPose?.(v,o),getModelOrbit:()=>stageRef?.getModelOrbit?.()??null,getModelTarget:()=>stageRef?.getModelTarget?.()??null,getModelOrientation:()=>stageRef?.getModelOrientation?.()??null,getModelPose:()=>stageRef?.getModelPose?.()??null,
    addAnnotation:controller.addAnnotation,getAnnotations:controller.getAnnotations,setAnnotations:controller.setAnnotations,updateAnnotation:(id,patch,options)=>controller.updateAnnotation(id,patch,options),removeAnnotation:controller.removeAnnotation,
    selectAnnotation:(id,preventZoom)=>controller.handleAnnotationSelect({id,preventZoom}),clearAnnotationSelection:controller.handleAnnotationClear,getSelectedAnnotationId:()=>get(activeAnnotationId),
    getRendererExtension:()=>stageRef?.getRendererExtension?.()??null,getStageSize:()=>stageRef?.getStageSize?.()??{width:0,height:0},canvasToScreen:(point)=>stageRef?.canvasToScreen?.(point)??null,screenToCanvas:(point)=>stageRef?.screenToCanvas?.(point)??null,
    updateLayerOpacity:controller.updateLayerOpacity,getLayerOpacities:()=>get(layerOpacities),getMediaSources:()=>get(mediaSources),on:controller.on,off:controller.off
  };
  pluginContext.viewer=viewerApi;
  setViewerContext({state:viewerState,derived:viewerDerived,controller,settings:{get layout(){return settingsLayout;},set layout(v){if(v===settingsLayout)return;settingsLayout=v;if(v==='1x1'){workspace=null;return;}showMetadata.set(false);showSearch.set(false);showAnnotations.set(false);showTools.set(false);showSettings.set(false);showContents.set(false);showLayers.set(false);workspace??=new WorkspaceStore(manifestId);workspace.setLayoutPreset(v);},get theme(){return theme;},set theme(v){theme=v;},get locale(){return locale;},set locale(v){locale=v;normalisedConfig={...normalisedConfig,language:v};viewerState.config.set(normalisedConfig);},get layoutMode(){return get(layoutMode);},set layoutMode(v){controller.setLayoutMode(v);}}});

  const panelToggle=(panel:Parameters<typeof controller.setPanelOpen>[0],open:boolean)=>controller.setPanelOpen(panel,open);
  const openContents=(tab:'toc'|'transcript')=>{contentsTab=tab;panelToggle('contents',true);};
  const requestCanvas=(index:number)=>{if(onbeforecanvaschange?.({canvasIndex:index})===false)return;controller.setCanvasByIndex(index);};
  const previousCanvas=()=>{const index=get(selectedCanvasIndex);requestCanvas(get(layoutMode)==='two-page'?Math.max(0,Math.floor(index/2)*2-2):index-1);};
  const nextCanvas=()=>{const index=get(selectedCanvasIndex);requestCanvas(get(layoutMode)==='two-page'?Math.min(get(canvases).length-1,Math.floor(index/2)*2+2):index+1);};
  const handleCollectionSelect=async(selection:CollectionSelection)=>navigateMango({getManifestId:()=>manifestId||null,getCanvasCount:controller.getCanvasCount,setManifest:(id)=>manifestId=id,setCanvasById:controller.setCanvasById,on:controller.on},selection);

  export function getContentSize():ContentSize|null{return stageRef?.getContentSize?.()??null;}
  export function getViewBox():ViewBox|null{return stageRef?.getViewBox?.()??null;}
  export function setViewBox(box:ViewBox):void{stageRef?.setViewBox?.(box);}
  export function getZoom():number{return get(zoom)>0?Math.max(10,Math.round(get(zoom)*100)):100;}
  export function setZoom(percent:number):void{if(Number.isFinite(percent))stageRef?.setZoom?.(percent/100);}
  export function goHome():void{stageRef?.goHome?.();}
  export function zoomIn():void{stageRef?.zoomBy?.(1.2);}
  export function zoomOut():void{stageRef?.zoomBy?.(.8);}
  export function panTo(x:number,y:number):void{const box=getViewBox();if(box)setViewBox({x:x-box.w/2,y:y-box.h/2,w:box.w,h:box.h});}
  export function getTheme():ViewerSettingsTheme{return theme;}
  export function setTheme(v:string):void{if(isViewerSettingsTheme(v))theme=v;}
  export function getMediaType(){return get(mediaType);}
  export function setModelOrbit(v:string):void{stageRef?.setModelOrbit?.(v);} export function setModelTarget(v:string):void{stageRef?.setModelTarget?.(v);} export function setModelOrientation(v:string):void{stageRef?.setModelOrientation?.(v);}
  export function setModelPose(v:ModelPose,o?:ModelPoseOptions):void{stageRef?.setModelPose?.(v,o);} export function getModelOrbit():string|null{return stageRef?.getModelOrbit?.()??null;} export function getModelTarget():string|null{return stageRef?.getModelTarget?.()??null;} export function getModelOrientation():string|null{return stageRef?.getModelOrientation?.()??null;} export function getModelPose():ModelPose|null{return stageRef?.getModelPose?.()??null;}
  export function getState(){return controller.getStateSnapshot();} export function getCanvasIndex():number{return controller.getCanvasIndex();} export function getCanvasId():string|null{return controller.getCanvasId();} export function getCanvasCount():number{return controller.getCanvasCount();} export function setCanvasByIndex(v:number):void{controller.setCanvasByIndex(v);} export function setCanvasById(v:string):void{controller.setCanvasById(v);}
  export function setManifest(id:string):void{viewerState.collectionId.set('');manifestId=id;} export function getManifestId():string|null{return manifestId||null;}
  export function start():void{stageRef?.start?.();} export function play():void{stageRef?.play?.();} export function pause():void{stageRef?.pause?.();} export function stop():void{stageRef?.stop?.();} export function seekBy(v:number):void{stageRef?.seekBy?.(v);} export function seekTo(v:number):void{stageRef?.seekTo?.(v);} export function setMediaSegment(a:number,b:number):void{stageRef?.setMediaSegment?.(a,b);}
  export function addAnnotation(v:unknown):Promise<void>{return controller.addAnnotation(v);} export function getAnnotations(){return controller.getAnnotations();} export function setAnnotations(v:unknown[]){return controller.setAnnotations(v);} export function updateAnnotation(id:string,patch:Parameters<typeof controller.updateAnnotation>[1],options?:AnnotationPatchOptions){return controller.updateAnnotation(id,patch,options);} export function removeAnnotation(v:string):Promise<void>{return controller.removeAnnotation(v);}
  export function replaceAnnotation(id:string,v:ResolvedAnnotation):Promise<void>{return controller.replaceAnnotation(id,v);} export function commitAnnotation(id:string):Promise<void>{return controller.commitAnnotation(id);} export function getUserAnnotations():ResolvedAnnotation[]{return Object.values(get(userAnnotations)??{}).flat();}
  export function selectAnnotation(id:string,preventZoom=false){controller.handleAnnotationSelect({id,preventZoom});} export function clearAnnotationSelection(){controller.handleAnnotationClear();} export function getSelectedAnnotationId(){return get(activeAnnotationId);}
  export function getRendererExtension(){return stageRef?.getRendererExtension?.()??null;} export function getStageSize(){return stageRef?.getStageSize?.()??{width:0,height:0};} export function canvasToScreen(point:{x:number;y:number}){return stageRef?.canvasToScreen?.(point)??null;} export function screenToCanvas(point:{x:number;y:number}){return stageRef?.screenToCanvas?.(point)??null;}
  export function updateLayerOpacity(id:string,v:number):void{controller.updateLayerOpacity(id,v);} export function getLayerOpacities(){return get(layerOpacities);} export function getMediaSources(){return get(mediaSources);}
  export function on<K extends keyof ViewerEventMap>(e:K,h:(p:ViewerEventMap[K])=>void){return controller.on(e,h);} export function off<K extends keyof ViewerEventMap>(e:K,h:(p:ViewerEventMap[K])=>void){controller.off(e,h);} export function setEventTarget(v:EventTarget):void{controller.setEventTarget(v);}

  $effect.pre(()=>{if(configInitialized&&config===lastConfigInput)return;configInitialized=true;lastConfigInput=config;normalisedConfig=normaliseConfigForViewer(config);if(normalisedConfig.language)locale=normalisedConfig.language;viewerState.config.set(normalisedConfig);});
  $effect(()=>setLocale(locale));
  /* Components that read the page from context (the stage toolbar) follow the viewer's page. */
  $effect.pre(()=>{viewportState.selectedCanvasIndex=$selectedCanvasIndex;});
  $effect(()=>{controller.emitEvent('annotationsChange',{annotations:$annotations});});
  $effect.pre(()=>{if(pluginsInitialized&&plugins===lastPluginsInput)return;pluginsInitialized=true;lastPluginsInput=plugins;viewerState.plugins.set([...corePlugins,...plugins]);});
  $effect.pre(()=>viewerState.manifestId.set(manifestId??''));
  $effect(()=>{if(canvasIndex!==undefined&&canvasIndex!==get(selectedCanvasIndex))controller.setCanvasByIndex(canvasIndex);});
  $effect(()=>{const current=$selectedCanvasIndex;if(current!==lastCanvasIndex){lastCanvasIndex=current;oncanvaschange?.({canvasIndex:current});}});
  $effect(()=>{const collection=$collectionEntry;if(!collection?.json||manifestId!==collection.id)return;const first=findFirstManifestId(collection.json);if(first)manifestId=first;});
  $effect(()=>{if(!viewerRoot)return;const update=(entries?:ResizeObserverEntry[])=>{const entryWidth=entries?.[0]?.contentBoxSize?.[0]?.inlineSize;const width=typeof entryWidth==='number'&&entryWidth>0?entryWidth:(viewerRoot?.clientWidth??0);if(width>0){narrow=width<=1024;mobile=width<=768;return;}if(typeof window.matchMedia==='function'){narrow=window.matchMedia('(max-width: 1024px)').matches;mobile=window.matchMedia('(max-width: 768px)').matches;}};update();if(typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(update);observer.observe(viewerRoot);return()=>observer.disconnect();});
  onMount(()=>fullscreenController.attach()); onDestroy(()=>controller.destroy());
</script>

<div class="viewer" class:viewer--headless={!chrome} data-theme={theme} bind:this={viewerRoot}>
  {#if chrome}<div class="viewer__top-row"><ViewerHeader {manifestId} manifestEntry={$manifestEntry}/><div class="viewer__top-actions">{#if $pluginSlots.top.length}<PluginSlot slot="top" plugins={$pluginSlots.top} context={pluginContext}/>{/if}<button class="viewer__fullscreen-btn viewer__fullscreen-btn--labelled" type="button" onclick={()=>fullscreenController.toggle()} aria-label={isFullscreen?$t('viewer.stage.controls.closeFullscreen'):$t('viewer.stage.controls.enterFullscreen')}>{#if isFullscreen}<Shrink aria-hidden="true"/>{:else}<Expand aria-hidden="true"/>{/if}<span>{isFullscreen?$t('viewer.stage.controls.closeFullscreen'):$t('viewer.stage.controls.fullscreen')}</span></button></div></div>{/if}
  {#if chrome&&normalisedConfig.sidebar?.enabled!==false&&sidebarCollapsed}<button class="viewer__expand-sidebar" type="button" onclick={()=>sidebarCollapsed=false} aria-label={$t('viewer.stage.controls.expandSidebar')} title={$t('viewer.stage.controls.expandSidebar')}><ChevronsRight aria-hidden="true"/></button>{/if}
  <div class="viewer__grid" class:viewer__grid--controls={chrome&&normalisedConfig.sidebar?.enabled!==false&&!sidebarCollapsed} class:viewer__grid--left={chrome&&$leftVisible&&!sidebarCollapsed} class:viewer__grid--nav-compact={chrome&&($leftVisible||narrow)&&!sidebarCollapsed&&!mobile} class:viewer__grid--sidebar-right={chrome&&normalisedConfig.sidebar?.position==='right'} class:viewer__grid--mobile={mobile}>
    {#if chrome&&normalisedConfig.sidebar?.enabled!==false&&!sidebarCollapsed}
      <aside class="viewer__control-rail" aria-label={$t('viewer.stage.controls.label')}><ViewerDock compact variant="sidebar" {mobile} iconOnly={$leftVisible||narrow} galleryActive={$showThumbnails} allowControls={toolbar??chrome} controlsActive={showControls} oncontrolstoggle={()=>showControls=!showControls} allowThumbnails={$allowThumbnails} allowCollection={$allowCollection} allowContents={$contentsAvailable} allowChapters={$contentsAvailable&&$avChaptersAvailable} allowTranscript={$contentsAvailable&&$avTranscriptAvailable} allowSearch={$allowSearch} allowMetadata={$allowMetadata} allowAnnotations={$allowAnnotations} allowTools={$allowTools} allowLayers={$allowLayers} allowSettings={normalisedConfig.showSettings!==false} showThumbnails={$showThumbnails} showCollection={$showCollection} showContents={$showContents} showSearch={$showSearch} showMetadata={$showMetadata} showAnnotations={$showAnnotations} showTools={$showTools} showLayers={$showLayers} showSettings={$showSettings} {showManifestManager} {contentsTab} oncollapse={()=>sidebarCollapsed=true} onmanifesttoggle={()=>showManifestManager=!showManifestManager} ongalleryopen={()=>panelToggle('thumbnails',!$showThumbnails)} oncontentsopen={openContents} onpanelToggle={(d)=>panelToggle(d.panel,d.open)}/></aside>
      <LeftPanelStack visible={$leftVisible} redesigned {contentsTab} showCollection={$showCollection} showAnnotations={$showAnnotations} showTools={$showTools} showContents={$showContents} showSearch={$showSearch} showMetadata={$showMetadata} showSettings={$showSettings} showLayers={$showLayers} showThumbnails={$showThumbnails&&$thumbnailsInSidebar} leftPlugins={$pluginSlots.left} {pluginContext} onpanelToggle={(p,o)=>panelToggle(p,o)} oncollectionSelect={handleCollectionSelect} oncanvasSelect={(d)=>requestCanvas(d.index)} onviewall={()=>controller.setLayoutMode('gallery')}/>
    {/if}
    {#if showManifestManager}<div class="viewer__manifest-overlay"><ManifestManager {workspace} onclose={()=>showManifestManager=false} onsingleload={(id)=>setManifest(id)}/></div>{/if}
    <main class="stage stage--viewer" class:stage--joined-sidebar-left={chrome&&normalisedConfig.sidebar?.enabled!==false&&!sidebarCollapsed&&!$leftVisible&&normalisedConfig.sidebar?.position!=='right'} class:stage--joined-sidebar-right={chrome&&normalisedConfig.sidebar?.enabled!==false&&!sidebarCollapsed&&!$leftVisible&&normalisedConfig.sidebar?.position==='right'} aria-label={$t('viewer.stage.label')}>
      {#if settingsLayout==='1x1'}
      <div class="stage__primary stage__viewer-frame">
      {#if $layoutMode==='gallery'}<StageGalleryView canvases={$canvases} thumbnails={$canvasThumbnails} selectedCanvasIndex={$selectedCanvasIndex} onselect={(d)=>{if(onbeforecanvaschange?.({canvasIndex:d.index})===false)return;controller.setCanvasByIndex(d.index);controller.setLayoutMode('single');}}/>
      {:else}<Stage bind:this={stageRef} bind:canZoom rendererComponent={$rendererComponent} {avController} mediaSource={$mediaSource} annotations={annotationOverlay?$overlayAnnotations:[]} highlightIds={$highlightIds} activeAnnotationId={$activeAnnotationId} hoverAnnotationId={$hoverAnnotationId} overlayPlugins={$pluginSlots.overlay} {pluginContext} isFetching={$manifestEntry?.isFetching??false} error={$manifestEntry?.error??''} imageFilters={$imageFilters} mediaType={$mediaType} viewerConfig={normalisedConfig} fillHeight={!chrome} showDock={false} allowThumbnails={$allowThumbnails} allowSearch={$allowSearch} allowMetadata={$allowMetadata} allowAnnotations={$allowAnnotations} allowTools={$allowTools} allowLayers={$allowLayers} allowSettings={normalisedConfig.showSettings!==false} allowContents={$contentsAvailable} showThumbnails={$showThumbnails} showContents={$showContents} showSearch={$showSearch} showMetadata={$showMetadata} showAnnotations={$showAnnotations} showTools={$showTools} showLayers={$showLayers} layers={$mediaSources} layerOpacities={$layerOpacities} {rendererHandlers} rotation={$rotation} initialViewBox={initialViewState.viewBox} layoutMode={$layoutMode} activeLayoutImages={$activeLayoutImages} onviewboxchange={controller.handleViewBoxChange} onzoomchange={controller.handleZoomChange} onrotationchange={controller.handleRotationChange} onpaneltoggle={(d)=>panelToggle(d.panel,d.open)} onrendererready={(d)=>controller.emitEvent('rendererReady',d)} onstageresize={(d)=>controller.emitEvent('stageResize',d)}/>{/if}
      {#if (toolbar??chrome)&&showControls&&$layoutMode!=='gallery'}<StageToolbar {canZoom} hasSource={Boolean($mediaSource)} placement="below" mediaType={$mediaType} selectedCanvasIndex={$selectedCanvasIndex} totalCanvases={$canvases.length} zoomPercent={getZoom()} rotation={$rotation} onhome={()=>stageRef?.goHome?.()} onzoomIn={zoomIn} onzoomOut={zoomOut} onsetZoomPercent={(d)=>setZoom(d.percent)} onrotate={controller.handleRotationChange} onsetCanvasIndex={(d)=>requestCanvas(d.index)} onprevCanvas={previousCanvas} onnextCanvas={nextCanvas}/>{/if}
      {#if chrome&&$allowThumbnails&&$showThumbnails&&!$thumbnailsInSidebar&&$layoutMode!=='gallery'}<GalleryStrip canvases={$canvases} canvasThumbnails={$canvasThumbnails} selectedCanvasIndex={$selectedCanvasIndex} oncanvasSelect={(d)=>requestCanvas(d.index)} onviewall={()=>controller.setLayoutMode('gallery')}/>{/if}
      </div>
      {#if $pluginSlots.bottom.length}<div class="stage__bottom"><PluginSlot slot="bottom" plugins={$pluginSlots.bottom} context={pluginContext}/></div>{/if}
      {:else if workspace}
        <GridContainer node={workspace.layout} activeWindowId={workspace.activeWindowId} onfocuswindow={(id)=>workspace?.setActiveWindow(id)} onmovewindow={(d)=>workspace?.moveWindow(d.id,d.direction)} onclosewindow={(id)=>{workspace?.closeWindow(id);if(workspace?.layout.type==='window'){settingsLayout='1x1';workspace=null;}}} onloadmanifest={(d)=>{workspace?.setWindowManifest(d.id,d.manifestId);workspace?.setActiveWindow(d.id);}} oncanvaschange={(d)=>workspace?.setWindowCanvasIndex(d.id,d.canvasIndex)} onresizesplit={(d)=>workspace?.updateSplitSizes(d.targetId,d.sizes)} onopenmanifestmanager={(id)=>{workspace?.setActiveWindow(id);showManifestManager=true;}}/>
      {/if}
    </main>
    {#if chrome&&$pluginSlots.right.length}<aside class="panel-stack panel-stack--right"><PluginSlot slot="right" plugins={$pluginSlots.right} context={pluginContext}/></aside>{/if}
  </div>
</div>
<style>
  .viewer {
    position: relative;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 10px;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    padding: 12px 0 0;
    border-width: 1px;
    border-style: solid;
    border-radius: 0;
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
    align-items: center;
    min-width: 0;
    gap: 12px;
    padding: 0 16px;
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
    gap: 6px;
    width: 30px;
    height: 30px;
    border: 1px solid var(--viewer-panel-border);
    border-radius: var(--viewer-control-radius);
    background: var(--viewer-panel);
    color: var(--viewer-text);
    cursor: pointer;
    font: inherit;
    font-size: 14px;
  }

  .viewer__fullscreen-btn--labelled {
    width: auto;
    padding-inline: 8px;
    border-color: transparent;
    background: transparent;
    font-size: 12px;
  }

  .viewer__fullscreen-btn :global(svg) {
    width: 15px;
    height: 15px;
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
    grid-template-columns: 196px minmax(0, 1fr);
    column-gap: 0;
  }

  .viewer__grid--left {
    grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  }

  .viewer__grid.viewer__grid--controls.viewer__grid--left {
    grid-template-columns: 196px minmax(300px, 390px) minmax(0, 1fr);
  }

  .viewer__grid.viewer__grid--controls.viewer__grid--nav-compact:not(.viewer__grid--left) {
    grid-template-columns: 60px minmax(0, 1fr);
  }

  .viewer__grid.viewer__grid--controls.viewer__grid--left.viewer__grid--nav-compact {
    grid-template-columns: 60px minmax(300px, 390px) minmax(0, 1fr);
  }

  /* Headless: a host owns the frame, so the viewer is only its stage. */
  .viewer.viewer--headless,
  .viewer.viewer--headless[data-theme] {
    grid-template-rows: minmax(0, 1fr);
    gap: 0;
    padding: 0;
    border: 0;
    background: transparent;
  }

  .viewer--headless .viewer__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .viewer__grid.viewer__grid--sidebar-right.viewer__grid--controls:not(.viewer__grid--left) {
    grid-template-columns: minmax(0, 1fr) 196px;
  }

  .viewer__grid.viewer__grid--sidebar-right.viewer__grid--controls.viewer__grid--left {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 390px) 196px;
  }

  .viewer__grid.viewer__grid--sidebar-right.viewer__grid--controls.viewer__grid--nav-compact:not(.viewer__grid--left) {
    grid-template-columns: minmax(0, 1fr) 60px;
  }

  .viewer__grid.viewer__grid--sidebar-right.viewer__grid--controls.viewer__grid--left.viewer__grid--nav-compact {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 390px) 60px;
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
    padding: 16px 10px 14px;
    overflow: hidden;
    border: 1px solid var(--viewer-panel-border);
    border-right: 0;
    border-radius: var(--viewer-chrome-radius) 0 0 var(--viewer-chrome-radius);
    background: var(--viewer-control-rail-bg);
  }

  .viewer__grid--nav-compact > .viewer__control-rail {
    width: 60px;
    padding-inline: 8px;
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

  /* The image, then the toolbar and the thumbnail strip as rows of their own under it. */
  .stage__primary {
    position: relative;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto auto;
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

  /*
   * In the flow, not floated: undo the toolbar's own narrow-screen centring
   * (left: 50% and a translate) and scrolling. Groups that don't fit wrap onto
   * a second row, so every control stays in view.
   */
  .stage__primary :global(.stage__toolbar.stage__toolbar--below) {
    position: static;
    left: auto;
    width: 100%;
    margin: 0;
    padding: 8px 12px;
    flex-wrap: wrap;
    justify-content: center;
    overflow: visible;
    background: var(--viewer-stage-bottom-bg);
    transform: none;
  }

  /* Phones: every pixel goes to the buttons. */
  @container mango-viewer (width <= 500px) {
    .stage__primary :global(.stage__toolbar.stage__toolbar--below) {
      padding-inline: 0;
    }
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

  /* Grouped toolbar buttons & inline inputs stay square inside their rounded group container. */
  .viewer :global(.stage__toolbar-button),
  .viewer :global(.stage__toolbar-input) {
    border-radius: 0;
  }

  .viewer :global(.viewer-sidebar__button) {
    border-radius: var(--viewer-control-radius);
  }

  .panel-stack--right {
    min-width: 260px;
  }

  @container mango-viewer (width > 768px) and (width <= 1024px) {
    .viewer__grid.viewer__grid--controls,
    .viewer__grid.viewer__grid--controls.viewer__grid--nav-compact,
    .viewer__grid.viewer__grid--controls.viewer__grid--left,
    .viewer__grid.viewer__grid--controls.viewer__grid--left.viewer__grid--nav-compact,
    .viewer__grid.viewer__grid--sidebar-right.viewer__grid--controls:not(.viewer__grid--left),
    .viewer__grid.viewer__grid--sidebar-right.viewer__grid--controls.viewer__grid--nav-compact:not(.viewer__grid--left),
    .viewer__grid.viewer__grid--sidebar-right.viewer__grid--controls.viewer__grid--left,
    .viewer__grid.viewer__grid--sidebar-right.viewer__grid--controls.viewer__grid--left.viewer__grid--nav-compact {
      grid-template-columns: 60px minmax(0, 1fr);
    }

    .viewer__grid--controls > .stage,
    .viewer__grid--controls.viewer__grid--sidebar-right > .stage {
      grid-column: 2;
      grid-row: 1;
    }

    .viewer__grid--controls.viewer__grid--sidebar-right > .viewer__control-rail {
      grid-column: 1;
      grid-row: 1;
      border-right: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
      border-left: 0;
    }

    .viewer__grid :global(.panel-stack--left) {
      position: absolute;
      z-index: 20;
      inset: 0 auto 0 60px;
      width: min(360px, calc(100% - 60px));
      box-shadow: 12px 0 32px rgba(0, 0, 0, 0.45);
    }
  }

  /*
   * The viewer is frequently embedded in a narrow column on a wide desktop,
   * so this layout is selected from the viewer's measured width rather than
   * the browser viewport. The phone dock occupies its own row beneath the
   * stage instead of stealing a permanent strip down the image's left edge.
   */
  .viewer__grid--mobile,
  .viewer__grid--mobile.viewer__grid--left,
  .viewer__grid--mobile.viewer__grid--sidebar-right:not(.viewer__grid--left),
  .viewer__grid--mobile.viewer__grid--sidebar-right.viewer__grid--left {
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: minmax(0, 1fr) auto !important;
    gap: 0;
  }

  .viewer__grid--mobile > .stage,
  .viewer__grid--mobile.viewer__grid--sidebar-right > .stage {
    grid-column: 1;
    grid-row: 1;
  }

  .viewer__grid--mobile > .viewer__control-rail,
  .viewer__grid--mobile.viewer__grid--nav-compact > .viewer__control-rail,
  .viewer__grid--mobile.viewer__grid--sidebar-right > .viewer__control-rail {
    grid-column: 1;
    grid-row: 2;
    width: 100% !important;
    padding: 6px 8px;
    justify-items: safe center;
    overflow-x: auto;
    overflow-y: hidden;
    border: 0;
    border-top: 1px solid var(--viewer-panel-border);
    background: var(--viewer-control-rail-bg);
    scrollbar-width: none;
  }

  .viewer__grid--mobile > .viewer__control-rail::-webkit-scrollbar {
    display: none;
  }

  .viewer__grid--mobile :global(.panel-stack--left) {
    position: absolute;
    z-index: 20;
    inset: 0 0 57px;
    height: auto;
    width: 100%;
    max-width: none;
  }

  @container mango-viewer (width <= 768px) {
    .viewer {
      gap: 10px;
      padding-top: 12px;
    }

    .viewer__top-row {
      align-items: center;
      gap: 8px;
      padding-inline: 12px;
    }

    .viewer__top-row :global(.manifest__title) {
      font-size: 18px;
    }

    .viewer__fullscreen-btn--labelled {
      width: 30px;
      min-width: 30px;
      padding: 0;
    }

    .viewer__fullscreen-btn--labelled span {
      display: none;
    }
  }

  /* A short landscape embed has width to spare but very little height. */
  @container mango-viewer (max-height: 500px) and (min-width: 560px) {
    .viewer__grid--mobile,
    .viewer__grid--mobile.viewer__grid--left,
    .viewer__grid--mobile.viewer__grid--sidebar-right.viewer__grid--left {
      grid-template-columns: auto minmax(0, 1fr) !important;
      grid-template-rows: minmax(0, 1fr) !important;
    }

    .viewer__grid--mobile > .viewer__control-rail,
    .viewer__grid--mobile.viewer__grid--nav-compact > .viewer__control-rail,
    .viewer__grid--mobile.viewer__grid--sidebar-right > .viewer__control-rail {
      grid-column: 1;
      grid-row: 1;
      width: auto !important;
      padding: 8px 6px;
      justify-items: stretch;
      overflow-x: hidden;
      overflow-y: auto;
      border-top: 0;
      border-right: 1px solid var(--viewer-panel-border);
    }

    .viewer__grid--mobile > .stage,
    .viewer__grid--mobile.viewer__grid--sidebar-right > .stage {
      grid-column: 2;
      grid-row: 1;
    }

    .viewer__grid--mobile :global(.panel-stack--left) {
      inset: 0 0 0 57px;
      height: 100%;
      width: min(360px, calc(100% - 57px));
    }
  }
</style>
