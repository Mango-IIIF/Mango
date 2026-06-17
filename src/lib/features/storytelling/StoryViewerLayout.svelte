<script lang="ts">
  import ViewerLayout from '../viewer/ViewerLayout.svelte';
  import type { ViewerConfig } from '../../core/types/config';
  import type { ViewerPlugin } from '../../core/types/plugin';

  interface Props {
    manifestId?: string;
    config?: ViewerConfig | undefined;
    plugins?: ViewerPlugin[];
    story?: string | Record<string, unknown> | undefined;
    storyUrl?: string | undefined;
  }

  let {
    manifestId = $bindable(''),
    config = undefined,
    plugins = [],
    story = undefined,
    storyUrl = undefined,
  }: Props = $props();
</script>

<ViewerLayout
  bind:manifestId
  {config}
  {plugins}
  mode="story-viewer"
  {story}
  {storyUrl}
/>
