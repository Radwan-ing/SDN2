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

export const sanitizeDocumentStyles = async (): Promise<void> => {
  // 1. Sanitize all <style> tags
  const styles = document.querySelectorAll('style');
  styles.forEach((style) => {
    if (style.textContent && (style.textContent.includes('oklch') || style.textContent.includes('oklab'))) {
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
        
        // Remove or disable original link so it doesn't get parsed
        link.remove();
      }
    } catch (e) {
      console.error('Error sanitizing link stylesheet:', e);
    }
  }
};
