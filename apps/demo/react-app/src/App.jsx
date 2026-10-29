import { useEffect, useRef } from 'react';
import '@mango-iiif/iiif-viewer/element';

export default function App() {
  const viewerRef = useRef(null);
  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.config = { theme: 'dark', language: 'en' };
    }
  }, []);
  return (
    <main>
      <h1>Mango IIIF Viewer</h1>
      <mango-viewer
        ref={viewerRef}
        mode="viewer"
        manifest-id="https://iiif.wellcomecollection.org/presentation/v2/b18035723"
      />
    </main>
  );
}
