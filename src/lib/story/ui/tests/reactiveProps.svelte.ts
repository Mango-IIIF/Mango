/**
 * Svelte 5 removed `$set` on mounted components, so a test that needs to change
 * a prop after mount has to hand `mount` a reactive object in the first place.
 * Runes only compile inside `.svelte`/`.svelte.ts`, which is why this lives in
 * its own file rather than beside the tests that use it.
 */
export const reactiveProps = <T extends Record<string, unknown>>(initial: T): T => {
  const props = $state(initial);
  return props;
};
