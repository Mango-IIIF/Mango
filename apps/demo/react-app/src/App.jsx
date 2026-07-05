import React, { useEffect, useRef } from 'react';
import '../../../../src/dist/mango-viewer-element.js';

function MangoViewer({ manifestId, mode, config, storyUrl }) {
  const viewerRef = useRef(null);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    if (config !== undefined) el.config = config;
    if (storyUrl !== undefined) el.storyUrl = storyUrl;
  }, [config, storyUrl]);

  return (
    <mango-viewer
      ref={viewerRef}
      manifest-id={manifestId}
      mode={mode}
      style={{ width: '100vw', height: 'calc(100vh - 50px)', display: 'block' }}
    />
  );
}

// Minimal Navigation Header Component
function Header({ currentMode }) {
  return (
    <header style={styles.header}>
      <a href="/" style={styles.logo}>React Mango</a>
      <nav style={styles.nav}>
        {[
          { key: 'viewer', label: 'Viewer' },
          { key: 'story-viewer', label: 'Story Viewer' },
          { key: 'story-builder', label: 'Story Builder' },
          { key: 'annotation-editor', label: 'Annotation Editor' }
        ].map((item) => (
          <a
            key={item.key}
            href={`?mode=${item.key}`}
            style={{
              ...styles.navLink,
              ...(currentMode === item.key ? styles.activeNavLink : {})
            }}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');

  if (!mode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Header currentMode="" />
        <div style={styles.menuContainer}>
          <h1 style={styles.menuTitle}>React Mango Demos</h1>
          <nav style={styles.menuNav}>
            <a href="?mode=viewer" style={styles.menuLink}>IIIF Viewer</a>
            <a href="?mode=story-viewer" style={styles.menuLink}>Story Viewer</a>
            <a href="?mode=story-builder" style={styles.menuLink}>Story Builder</a>
            <a href="?mode=annotation-editor" style={styles.menuLink}>Annotation Editor</a>
          </nav>
        </div>
      </div>
    );
  }

  // Render header + clean full-screen viewer based on active mode
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header currentMode={mode} />
      <main style={{ flex: 1, position: 'relative', background: '#020617' }}>
        {mode === 'story-viewer' || mode === 'story-builder' ? (
          <MangoViewer
            mode={mode}
            storyUrl="/test-story/demo.json"
            config={{
              showMetadata: false,
              showSearch: false,
              showThumbnails: false,
              showTools: false,
              showAnnotations: false
            }}
          />
        ) : (
          <MangoViewer
            mode={mode}
            manifestId="https://iiif.wellcomecollection.org/presentation/v2/b18035723"
          />
        )}
      </main>
    </div>
  );
}

const styles = {
  header: {
    height: '50px',
    background: '#0f172a',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    boxSizing: 'border-box',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  logo: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#38bdf8',
    textDecoration: 'none',
  },
  nav: {
    display: 'flex',
    gap: '15px',
  },
  navLink: {
    fontSize: '13px',
    color: '#94a3b8',
    textDecoration: 'none',
    fontWeight: 500,
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'all 0.2s',
  },
  activeNavLink: {
    color: '#38bdf8',
    background: '#1e293b',
  },
  menuContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    background: '#0f172a',
    color: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  menuTitle: {
    fontSize: '32px',
    marginBottom: '30px',
    color: '#38bdf8',
    fontWeight: 600,
  },
  menuNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    width: '260px',
  },
  menuLink: {
    display: 'block',
    textAlign: 'center',
    padding: '14px 20px',
    background: '#1e293b',
    color: '#cbd5e1',
    textDecoration: 'none',
    borderRadius: '8px',
    border: '1px solid #334155',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
};
