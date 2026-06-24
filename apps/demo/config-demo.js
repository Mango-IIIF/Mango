const form = document.querySelector('#config-form');
const manifestInput = document.querySelector('#manifest-id');
const viewerShell = document.querySelector('#viewer-shell');
const output = document.querySelector('#config-output');
const status = document.querySelector('#config-status');
const copyButton = document.querySelector('#copy-config');
const sidebarToggle = document.querySelector('#enable-sidebar');
const sidebarControls = form.querySelectorAll(
  '[data-config-path^="sidebar."]:not([data-config-path="sidebar.enabled"])',
);
const initialViewBoxToggle = document.querySelector('#enable-initial-view-box');
const initialViewBoxControls = form.querySelectorAll(
  '[data-optional-group="initial-view-box"]',
);

let renderTimer;
let renderCount = 0;
let updateVersion = 0;
let pendingViewer = null;
let currentConfig = {};
let currentConfigChanges = {};
let defaultConfig = {};
let viewerCssText = '';

const UNCHANGED = Symbol('unchanged');

const setAtPath = (target, path, value) => {
  const keys = path.split('.');
  const finalKey = keys.pop();
  let cursor = target;
  for (const key of keys) {
    cursor[key] ??= {};
    cursor = cursor[key];
  }
  cursor[finalKey] = value;
};

const readValue = (control) => {
  if (control instanceof HTMLInputElement && control.type === 'checkbox') {
    return control.checked;
  }
  if (control.dataset.valueType === 'json') {
    return JSON.parse(control.value);
  }
  if (control.dataset.valueType === 'list') {
    return control.value
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }
  if (control.dataset.valueType === 'number' || control.type === 'number') {
    return Number(control.value);
  }
  return control.value;
};

const collectConfig = () => {
  const config = {};
  const invalidControls = [];

  for (const control of form.querySelectorAll('[data-config-path]')) {
    if (control.dataset.optionalGroup === 'initial-view-box' && !initialViewBoxToggle.checked) {
      continue;
    }
    control.classList.remove('config-invalid');
    try {
      setAtPath(config, control.dataset.configPath, readValue(control));
    } catch {
      control.classList.add('config-invalid');
      invalidControls.push(control.dataset.configPath);
    }
  }

  if (invalidControls.length > 0) {
    throw new Error(`Invalid JSON: ${invalidControls.join(', ')}`);
  }
  return config;
};

const diffConfig = (value, baseline) => {
  if (Array.isArray(value)) {
    return JSON.stringify(value) === JSON.stringify(baseline) ? UNCHANGED : value;
  }
  if (value && typeof value === 'object') {
    const changed = {};
    for (const [key, childValue] of Object.entries(value)) {
      const childChange = diffConfig(childValue, baseline?.[key]);
      if (childChange !== UNCHANGED) changed[key] = childChange;
    }
    return Object.keys(changed).length > 0 ? changed : UNCHANGED;
  }
  return Object.is(value, baseline) ? UNCHANGED : value;
};

const getConfigChanges = (config) => {
  const changes = diffConfig(config, defaultConfig);
  return changes === UNCHANGED ? {} : changes;
};

const injectViewerCss = (viewer) => {
  if (
    viewerCssText &&
    viewer.shadowRoot &&
    !viewer.shadowRoot.querySelector('style[data-mango-viewer-css]')
  ) {
    const style = document.createElement('style');
    style.dataset.mangoViewerCss = 'mango-viewer-css';
    style.textContent = viewerCssText;
    viewer.shadowRoot.prepend(style);
  }
};

const viewerHasContent = (viewer) => {
  if (!viewer.isConnected || viewer.getCanvasCount?.() < 1) return false;
  const root = viewer.shadowRoot;
  if (!root) return false;
  if (root.querySelector('.stage-gallery-view')) return true;
  if (viewer.getMediaType?.() === 'image') return viewer.getViewBox?.() !== null;
  return Boolean(root.querySelector('video, audio, model-viewer, .pdf-viewer canvas'));
};

const waitForViewerContent = async (viewer, version) => {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (version !== updateVersion || !viewer.isConnected) return false;
    if (viewerHasContent(viewer)) return true;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  return false;
};

const updateViewer = async () => {
  try {
    currentConfig = collectConfig();
  } catch (error) {
    updateVersion += 1;
    pendingViewer?.remove();
    pendingViewer = null;
    status.textContent = error.message;
    status.dataset.state = 'error';
    return;
  }

  currentConfigChanges = getConfigChanges(currentConfig);
  output.textContent = JSON.stringify(currentConfigChanges, null, 2);
  status.textContent = 'Updating viewer…';
  status.dataset.state = 'loading';
  const version = ++updateVersion;

  pendingViewer?.remove();

  const viewer = document.createElement('mango-viewer');
  pendingViewer = viewer;
  viewer.className = 'config-viewer--pending';
  viewer.mode = 'viewer';
  viewer.manifestId = manifestInput.value.trim();
  viewer.config = structuredClone(currentConfig);
  viewer.dataset.renderCount = String(++renderCount);

  const currentStyle = viewerShell
    .querySelector('#config-viewer')
    ?.shadowRoot?.querySelector('style[data-mango-viewer-css]');
  if (currentStyle?.textContent) viewerCssText = currentStyle.textContent;
  injectViewerCss(viewer);
  viewerShell.append(viewer);
  injectViewerCss(viewer);

  const ready = await waitForViewerContent(viewer, version);
  if (version !== updateVersion) return;
  if (!ready) {
    viewer.remove();
    pendingViewer = null;
    status.textContent = 'Viewer update timed out; previous content retained';
    status.dataset.state = 'error';
    return;
  }

  viewerShell.querySelector('#config-viewer')?.remove();
  viewer.id = 'config-viewer';
  viewer.classList.remove('config-viewer--pending');
  pendingViewer = null;
  status.textContent = 'Viewer updated';
  status.dataset.state = 'ready';
};

const scheduleUpdate = () => {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(updateViewer, 250);
};

form.addEventListener('input', scheduleUpdate);
form.addEventListener('change', scheduleUpdate);
form.addEventListener('reset', () => {
  window.setTimeout(() => {
    syncOptionalControls();
    updateViewer();
  });
});
manifestInput.addEventListener('change', updateViewer);
const syncOptionalControls = () => {
  sidebarControls.forEach((control) => {
    control.disabled = !sidebarToggle.checked;
  });
  initialViewBoxControls.forEach((control) => {
    control.disabled = !initialViewBoxToggle.checked;
  });
};
sidebarToggle.addEventListener('change', syncOptionalControls);
initialViewBoxToggle.addEventListener('change', syncOptionalControls);

copyButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(JSON.stringify(currentConfigChanges, null, 2));
  copyButton.textContent = 'Copied';
  window.setTimeout(() => (copyButton.textContent = 'Copy JSON'), 1200);
});

await customElements.whenDefined('mango-viewer');
await new Promise((resolve) => requestAnimationFrame(resolve));
syncOptionalControls();
defaultConfig = collectConfig();
updateViewer();
