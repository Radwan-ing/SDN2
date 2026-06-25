export const convertOklchToRgb = (color: string): string => {
  if (!color || (!color.includes('oklch') && !color.includes('oklab'))) return color;
  try {
    const temp = document.createElement('div');
    temp.style.color = color;
    document.body.appendChild(temp);
    const computed = window.getComputedStyle(temp).color;
    document.body.removeChild(temp);
    if (computed && !computed.includes('oklch') && !computed.includes('oklab')) {
      return computed;
    }
  } catch (e) {
    // ignore
  }
  return 'rgb(0, 0, 0)';
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
let linkBackups: Array<{ element: HTMLLinkElement; parent: Node | null; nextSibling: Node | null }> = [];
let createdStyles: HTMLStyleElement[] = [];

export const restoreDocumentStyles = (): void => {
  // 1. Restore original style tags text content
  styleBackups.forEach((backup) => {
    backup.element.textContent = backup.originalText;
  });

  // 2. Remove dynamically created style tags
  createdStyles.forEach((style) => {
    if (style && style.parentNode) {
      style.remove();
    }
  });

  // 3. Put original link tags back
  linkBackups.forEach((backup) => {
    if (backup.parent && !document.head.contains(backup.element) && !document.body.contains(backup.element)) {
      backup.parent.insertBefore(backup.element, backup.nextSibling);
    }
  });

  // Clear backups
  styleBackups = [];
  linkBackups = [];
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
        
        linkBackups.push({
          element: link as HTMLLinkElement,
          parent: link.parentNode,
          nextSibling: link.nextSibling
        });
        
        // Remove original link so it doesn't get parsed
        link.remove();
      }
    } catch (e) {
      console.error('Error sanitizing link stylesheet:', e);
    }
  }

  return restoreDocumentStyles;
};
