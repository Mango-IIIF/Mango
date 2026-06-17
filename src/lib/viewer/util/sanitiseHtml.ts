export const sanitizeHtml = (value: string): string => {
  if (!value) return '';
  if (typeof document === 'undefined' || typeof DOMParser === 'undefined') {
    return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(value, 'text/html');
  const allowedTags = new Set([
    'a',
    'b',
    'br',
    'i',
    'img',
    'p',
    'small',
    'span',
    'sub',
    'sup',
  ]);
  const allowedAttrs: Record<string, string[]> = {
    a: ['href'],
    img: ['src', 'alt'],
  };

  const sanitizeElement = (element: Element) => {
    const tag = element.tagName.toLowerCase();
    if (!allowedTags.has(tag)) {
      const text = doc.createTextNode(element.textContent ?? '');
      element.replaceWith(text);
      return;
    }
    const allowed = allowedAttrs[tag] ?? [];
    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();
      if (!allowed.includes(name)) {
        element.removeAttribute(attr.name);
        continue;
      }
      const attrValue = attr.value ?? '';
      if (
        (name === 'href' || name === 'src') &&
        attrValue.trim().toLowerCase().startsWith('javascript:')
      ) {
        element.removeAttribute(attr.name);
      }
    }
    for (const child of Array.from(element.children)) {
      sanitizeElement(child);
    }
  };

  for (const child of Array.from(doc.body.children)) {
    sanitizeElement(child);
  }

  return doc.body.innerHTML;
};
