import { expect, test } from '@playwright/test';

test('creates and saves an annotation with the package editor', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.goto('/annotation-editor-wellcome.html');

  await expect(page.locator('.annotation-workspace')).toBeVisible();
  const editor = page.locator('.mango-annotation-editor');
  await expect(editor).toBeAttached();

  // Let the OpenSeadragon canvas dimensions settle before starting an interaction.
  await page.waitForTimeout(1_500);

  // Selecting a tool also verifies that toolbar state reaches the package editor.
  await page.getByRole('button', { name: 'Point' }).click();
  await expect(page.locator('.left-sidebar__tool--active')).toHaveText('Point');
  await page.waitForTimeout(200);

  const drawingSurface = page.locator('.mango-annotation-editor__svg');
  const bounds = await drawingSurface.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;

  const savedRows = page.locator('.annotation-table tbody tr');
  const rowsBefore = await savedRows.count();
  const pointsBefore = await drawingSurface.locator('circle').count();

  await drawingSurface.click({
    position: { x: bounds.width * 0.5, y: bounds.height * 0.5 },
  });

  await expect
    .poll(() => drawingSurface.locator('circle').count())
    .toBeGreaterThan(pointsBefore);
  await expect(drawingSurface.locator('circle').first()).toHaveAttribute(
    'fill',
    'rgba(167, 139, 250, 0.18)',
  );

  await page.getByRole('button', { name: 'Save Annotation' }).click();

  await expect(savedRows).toHaveCount(rowsBefore + 1);
  await expect
    .poll(() => drawingSurface.locator('circle').count())
    .toBeGreaterThan(pointsBefore);
  expect(runtimeErrors).toEqual([]);
});

test('opens an off-canvas search hit, zooms to it, and highlights it', async ({ page }) => {
  await page.goto('/viewer.html');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  const query = page.getByRole('searchbox', { name: 'Search annotations' });
  await query.fill('Vererbung');

  const results = page.locator('.search-list__button');
  await expect(results.first()).toBeVisible();
  expect(await results.count()).toBeGreaterThan(1);

  const canvasNumber = page.getByRole('textbox', { name: 'Canvas number' });
  await expect(canvasNumber).toHaveValue('1');
  await results.first().click();

  await expect(canvasNumber).not.toHaveValue('1');
  await expect(page.locator('.annotation--active')).toBeVisible();
  await expect(page.locator('.annotation--hit')).toBeVisible();

  const zoom = page.getByRole('textbox', { name: 'Zoom percent' });
  await expect(zoom).not.toHaveValue('100');
});
