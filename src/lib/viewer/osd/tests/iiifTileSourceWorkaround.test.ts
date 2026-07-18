import { describe, expect, it } from 'vitest';
import { applyIIIFExactTileLevelWorkaround } from '../iiifTileSourceWorkaround';

const createOSD = () => {
  class IIIFTileSource {
    _id = 'https://example.org/image';
    width = 1957;
    height = 3189;
    version = 2;
    tileFormat = 'jpg';
    levelSizes = [
      { width: 61, height: 100 },
      { width: 123, height: 200 },
      { width: 245, height: 400 },
      { width: 628, height: 1024 },
      { width: 1957, height: 3189 },
    ];
    getTileWidth() {
      return 1024;
    }
    getTileHeight() {
      return 1024;
    }
    getTileUrl() {
      return 'original';
    }
  }
  return { IIIFTileSource };
};

describe('applyIIIFExactTileLevelWorkaround', () => {
  it('requests the complete image when a listed size exactly meets a tile boundary', () => {
    const OSD = createOSD();
    applyIIIFExactTileLevelWorkaround(OSD);

    const source = new OSD.IIIFTileSource();
    expect(source.getTileUrl(3, 0, 0)).toBe(
      'https://example.org/image/full/628,/0/default.jpg',
    );
  });

  it('leaves ordinary tiled levels with OpenSeadragon', () => {
    const OSD = createOSD();
    applyIIIFExactTileLevelWorkaround(OSD);

    const source = new OSD.IIIFTileSource();
    expect(source.getTileUrl(4, 0, 0)).toBe('original');
  });
});
