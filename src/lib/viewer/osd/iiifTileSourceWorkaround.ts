type IIIFTileSourceLike = {
  _id?: string;
  width?: number;
  height?: number;
  version?: number;
  tileFormat?: string;
  emulateLegacyImagePyramid?: boolean;
  levelSizes?: Array<{ width: number; height: number }>;
  getTileWidth: (level: number) => number;
  getTileHeight: (level: number) => number;
  getTileUrl: (level: number, x: number, y: number) => string;
};

type OpenSeadragonWithIIIF = {
  IIIFTileSource?: { prototype?: IIIFTileSourceLike & Record<PropertyKey, unknown> };
};

const PATCH_MARKER = Symbol.for('mango.osd.iiif-exact-tile-level-patch');

/**
 * OSD 6.0.2 treats a listed IIIF size as a single-image level only when both
 * dimensions are strictly smaller than the tile dimensions. If one dimension
 * exactly equals its tile dimension, OSD can request only part of the source
 * image. See Wellcome b18035978 canvas 6 (628 x 1024 at a 1024 x 1024 level).
 */
export const applyIIIFExactTileLevelWorkaround = (
  OpenSeadragonClass: OpenSeadragonWithIIIF,
): void => {
  const prototype = OpenSeadragonClass.IIIFTileSource?.prototype;
  if (!prototype || prototype[PATCH_MARKER]) return;

  const originalGetTileUrl = prototype.getTileUrl;
  prototype.getTileUrl = function (level: number, x: number, y: number): string {
    const source = this as IIIFTileSourceLike;
    const levelSize = source.levelSizes?.[level];
    const tileWidth = source.getTileWidth(level);
    const tileHeight = source.getTileHeight(level);
    const isSingleTileLevel =
      !source.emulateLegacyImagePyramid &&
      Boolean(levelSize) &&
      levelSize!.width <= tileWidth &&
      levelSize!.height <= tileHeight;
    const hitsExactBoundary =
      levelSize?.width === tileWidth || levelSize?.height === tileHeight;

    if (isSingleTileLevel && hitsExactBoundary && source._id) {
      const isFullSize =
        levelSize!.width === source.width && levelSize!.height === source.height;
      const size =
        source.version === 3
          ? isFullSize
            ? 'max'
            : `${levelSize!.width},${levelSize!.height}`
          : isFullSize
            ? 'full'
            : `${levelSize!.width},`;
      const quality = source.version === 1 ? 'native' : 'default';
      return [source._id, 'full', size, '0', `${quality}.${source.tileFormat ?? 'jpg'}`].join(
        '/',
      );
    }

    return originalGetTileUrl.call(source, level, x, y);
  };

  Object.defineProperty(prototype, PATCH_MARKER, { value: true });
};
