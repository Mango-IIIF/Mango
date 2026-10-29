<script setup>
import { onMounted, ref } from 'vue'
import '@mango-iiif/iiif-viewer/element'

const viewer = ref(null)
onMounted(() => {
  if (viewer.value) viewer.value.config = { theme: 'dark', language: 'en' }
})
</script>

<template>
  <main>
    <h1>Mango IIIF Viewer</h1>
    <mango-viewer
      ref="viewer"
      mode="viewer"
      manifest-id="https://iiif.wellcomecollection.org/presentation/v2/b18035723"
    />
  </main>
</template>
