export type RectangleLabelLayout = {
  fontSize: number;
  lineHeight: number;
  lines: string[];
};

const wrapLabel = (label: string, charactersPerLine: number): string[] => {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (word.length > charactersPerLine) {
      if (line) lines.push(line);
      line = '';
      for (let offset = 0; offset < word.length; offset += charactersPerLine) {
        lines.push(word.slice(offset, offset + charactersPerLine));
      }
      continue;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= charactersPerLine) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
};

export const fitRectangleLabelLayout = (
  width: number,
  height: number,
  label: string,
): RectangleLabelLayout => {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const availableWidth = safeWidth * 0.88;
  const availableHeight = safeHeight * 0.8;
  let low = Math.max(1, Math.min(safeWidth, safeHeight) * 0.015);
  let high = Math.max(low, safeHeight * 0.42);
  let best: RectangleLabelLayout = {
    fontSize: low,
    lineHeight: low * 1.18,
    lines: wrapLabel(label, Math.max(1, Math.floor(availableWidth / (low * 0.56)))),
  };
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const fontSize = (low + high) / 2;
    const lineHeight = fontSize * 1.18;
    const charactersPerLine = Math.max(1, Math.floor(availableWidth / (fontSize * 0.56)));
    const lines = wrapLabel(label, charactersPerLine);
    if (lines.length * lineHeight <= availableHeight) {
      best = { fontSize, lineHeight, lines };
      low = fontSize;
    } else high = fontSize;
  }
  return best;
};

export const fitRectangleLabelFontSize = (
  width: number,
  height: number,
  label: string,
): number => fitRectangleLabelLayout(width, height, label).fontSize;

export const rectangleLabelOutlineWidth = (fontSize: number): number =>
  Math.max(1, fontSize * 0.1);
