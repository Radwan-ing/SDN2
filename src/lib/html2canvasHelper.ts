export const parseOklch = (str: string) => {
  if (!str) return null;
  const cleaned = str.trim().toLowerCase();
  const match = cleaned.match(/(?:oklch|oklab)\s*\(([^)]+)\)/i);
  if (!match) return null;
  
  const inner = match[1];
  // Split by comma, slash, or whitespace
  const parts = inner.split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  let l = parseFloat(parts[0]);
  if (parts[0].endsWith('%')) {
    l = parseFloat(parts[0]) / 100;
  }
  let c = parseFloat(parts[1]);
  if (parts[1].endsWith('%')) {
    c = parseFloat(parts[1]) / 100;
  }
  let h = parseFloat(parts[2]);
  if (parts[2].endsWith('deg')) {
    h = parseFloat(parts[2]);
  } else if (parts[2].endsWith('rad')) {
    h = parseFloat(parts[2]) * (180 / Math.PI);
  } else if (parts[2].endsWith('turn')) {
    h = parseFloat(parts[2]) * 360;
  }

  let alpha = 1;
  if (parts.length >= 4) {
    if (parts[3].endsWith('%')) {
      alpha = parseFloat(parts[3]) / 100;
    } else {
      alpha = parseFloat(parts[3]);
    }
  }

  return { l, c, h, alpha, isOklab: cleaned.startsWith('oklab') };
};

export const oklchToRgb = (oklchStr: string): string => {
  const parsed = parseOklch(oklchStr);
  if (!parsed) return oklchStr;

  let { l, c, h, alpha, isOklab } = parsed;

  l = Math.max(0, Math.min(1, l));

  let a = 0;
  let b = 0;

  if (isOklab) {
    a = c;
    b = h;
  } else {
    const hRad = (h * Math.PI) / 180;
    a = c * Math.cos(hRad);
    b = c * Math.sin(hRad);
  }

  // Convert OKLAB to LMS
  const l_lms = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_lms = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_lms = l - 0.0894841775 * a - 1.2914855480 * b;

  // Cube LMS to get linear LMS
  const l_cube = l_lms * l_lms * l_lms;
  const m_cube = m_lms * m_lms * m_lms;
  const s_cube = s_lms * s_lms * s_lms;

  // Convert linear LMS to linear sRGB
  const r_lin = +4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
  const g_lin = -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413193965 * s_cube;
  const b_lin = -0.0041960863 * l_cube - 0.7034186147 * m_cube + 1.7076147010 * s_cube;

  // Helper to convert linear channel to sRGB channel
  const pivot = (v: number) => {
    if (v <= 0.0031308) {
      return 12.92 * v;
    }
    return 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  };

  const r = Math.max(0, Math.min(255, Math.round(pivot(r_lin) * 255)));
  const g = Math.max(0, Math.min(255, Math.round(pivot(g_lin) * 255)));
  const b_val = Math.max(0, Math.min(255, Math.round(pivot(b_lin) * 255)));

  if (alpha === 1) {
    return `rgb(${r}, ${g}, ${b_val})`;
  } else {
    return `rgba(${r}, ${g}, ${b_val}, ${alpha})`;
  }
};

const oklchCache = new Map<string, string>();

export const convertOklchToRgb = (color: string): string => {
  if (!color || (!color.includes('oklch') && !color.includes('oklab'))) return color;
  const trimmed = color.trim();
  if (oklchCache.has(trimmed)) {
    return oklchCache.get(trimmed)!;
  }
  const converted = oklchToRgb(trimmed);
  oklchCache.set(trimmed, converted);
  return converted;
};

export const cleanOklchInStyleText = (text: string): string => {
  if (!text) return text;
  return text.replace(/(oklch|oklab)\([^)]+\)/gi, (match) => convertOklchToRgb(match));
};

export const sanitizeElementInlineStyles = (element: HTMLElement) => {
  const allElements = [element, ...Array.from(element.querySelectorAll('*'))];
  allElements.forEach((el) => {
    if (el instanceof HTMLElement) {
      const styleAttr = el.getAttribute('style');
      if (styleAttr && (styleAttr.includes('oklch') || styleAttr.includes('oklab'))) {
        el.setAttribute('style', cleanOklchInStyleText(styleAttr));
      }
    }
  });
};

let styleBackups: Array<{ element: HTMLStyleElement; originalText: string }> = [];
let createdStyles: HTMLStyleElement[] = [];

export const restoreDocumentStyles = (): void => {
  // 1. Restore original style tags text content
  styleBackups.forEach((backup) => {
    if (backup.element) {
      backup.element.textContent = backup.originalText;
    }
  });

  // 2. Remove dynamically created style tags
  createdStyles.forEach((style) => {
    if (style && style.parentNode) {
      style.remove();
    }
  });

  // Clear backups
  styleBackups = [];
  createdStyles = [];
};

export const sanitizeDocumentStyles = async (): Promise<() => void> => {
  // Clear any previous backups before starting
  restoreDocumentStyles();

  // 1. Sanitize all <style> tags
  const styles = document.querySelectorAll('style');
  styles.forEach((style) => {
    if (style.textContent && (style.textContent.includes('oklch') || style.textContent.includes('oklab'))) {
      styleBackups.push({
        element: style,
        originalText: style.textContent
      });
      style.textContent = cleanOklchInStyleText(style.textContent);
    }
  });

  // 2. Convert and sanitize all <link rel="stylesheet"> tags
  const links = document.querySelectorAll('link[rel="stylesheet"]');
  for (const link of Array.from(links)) {
    try {
      const href = (link as HTMLLinkElement).href;
      if (href && !link.hasAttribute('data-sanitized')) {
        const response = await fetch(href);
        let text = await response.text();
        text = cleanOklchInStyleText(text);
        
        const style = document.createElement('style');
        style.textContent = text;
        style.setAttribute('data-sanitized', 'true');
        document.head.appendChild(style);
        createdStyles.push(style);
        
        // CRITICAL FIX: DO NOT remove the original <link> tag.
        // This ensures the page never loses its styles/colors, and avoids unstyling.
      }
    } catch (e) {
      console.error('Error sanitizing link stylesheet:', e);
    }
  }

  return restoreDocumentStyles;
};
