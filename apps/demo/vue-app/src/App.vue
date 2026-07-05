<script setup>
import { ref } from 'vue';
import '../../../../src/dist/mango-viewer-element.js';

// Read mode from URL query parameters (e.g., ?mode=viewer)
const params = new URLSearchParams(window.location.search);
const mode = ref(params.get('mode') || '');
const config = ref({ showThumbnails: true });

const storyConfig = ref({
  showMetadata: false,
  showSearch: false,
  showThumbnails: false,
  showTools: false,
  showAnnotations: false
});

const navItems = [
  { key: 'viewer', label: 'Viewer' },
  { key: 'story-viewer', label: 'Story Viewer' },
  { key: 'story-builder', label: 'Story Builder' },
  { key: 'annotation-editor', label: 'Annotation Editor' }
];
</script>

<template>
  <div class="app-layout">
    <!-- Minimal Navigation Header -->
    <header class="app-header">
      <a href="/" class="logo">Vue Mango</a>
      <nav class="nav">
        <a
          v-for="item in navItems"
          :key="item.key"
          :href="`?mode=${item.key}`"
          class="nav-link"
          :class="{ 'active-nav-link': mode === item.key }"
        >
          {{ item.label }}
        </a>
      </nav>
    </header>

    <!-- Render Menu Links if no mode is active -->
    <div v-if="!mode" class="menu-container">
      <h1 class="menu-title">Vue Mango Demos</h1>
      <nav class="menu-nav">
        <a href="?mode=viewer" class="menu-link">IIIF Viewer</a>
        <a href="?mode=story-viewer" class="menu-link">Story Viewer</a>
        <a href="?mode=story-builder" class="menu-link">Story Builder</a>
        <a href="?mode=annotation-editor" class="menu-link">Annotation Editor</a>
      </nav>
    </div>

    <!-- Render the clean, full-screen viewer based on the active mode -->
    <div v-else class="viewer-container">
      <mango-viewer
        v-if="mode === 'story-viewer' || mode === 'story-builder'"
        :mode="mode"
        story-url="/test-story/demo.json"
        :config="storyConfig"
      />
      <mango-viewer
        v-else
        manifest-id="https://iiif.wellcomecollection.org/presentation/v2/b18035723"
        :mode="mode"
        :config="config"
      />
    </div>
  </div>
</template>

<style>
/* Reset body styles */
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: #0f172a;
}
</style>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-header {
  height: 50px;
  background: #0f172a;
  border-bottom: 1px solid #1e293b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.logo {
  font-size: 16px;
  font-weight: bold;
  color: #42b883; /* Vue brand green */
  text-decoration: none;
}

.nav {
  display: flex;
  gap: 15px;
}

.nav-link {
  font-size: 13px;
  color: #94a3b8;
  text-decoration: none;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.nav-link:hover {
  color: #ffffff;
}

.active-nav-link {
  color: #42b883;
  background: #1e293b;
}

.menu-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  background: #0f172a;
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.menu-title {
  font-size: 32px;
  margin-bottom: 30px;
  color: #42b883;
  font-weight: 600;
}

.menu-nav {
  display: flex;
  flex-direction: column;
  gap: 15px;
  width: 260px;
}

.menu-link {
  display: block;
  text-align: center;
  padding: 14px 20px;
  background: #1e293b;
  color: #cbd5e1;
  text-decoration: none;
  border-radius: 8px;
  border: 1px solid #334155;
  font-weight: 500;
  transition: all 0.2s;
}

.menu-link:hover {
  background: #334155;
  border-color: #42b883;
  color: #ffffff;
}

.viewer-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

mango-viewer {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
