// src/utils/exportTimeline.ts

import html2canvas from 'html2canvas';

// Some browsers only download from links that are in the document, and cancel the
// download if its object URL is revoked straight away
function downloadUrl(href: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = href;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 40 * 1000);
}

export async function exportToPNG(element: HTMLElement, filename: string = 'timeline.png'): Promise<void> {
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: null,
      scale: 2, // Higher quality
      logging: false,
    });

    downloadUrl(canvas.toDataURL('image/png'), filename);
  } catch (error) {
    console.error('Failed to export PNG:', error);
    throw error;
  }
}

export function exportToSVG(element: HTMLElement, filename: string = 'timeline.svg'): void {
  try {
    const svgElement = createSVGFromElement(element);
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    downloadBlob(new Blob([svgString], { type: 'image/svg+xml' }), filename);
  } catch (error) {
    console.error('Failed to export SVG:', error);
    throw error;
  }
}

// The page's CSS rules as text (stylesheets from other origins can't be read and are skipped)
function collectPageCss(): string {
  return Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n');
      } catch {
        return '';
      }
    })
    .join('\n');
}

export function createSVGFromElement(element: HTMLElement): SVGSVGElement {
  const bbox = element.getBoundingClientRect();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', bbox.width.toString());
  svg.setAttribute('height', bbox.height.toString());
  svg.setAttribute('viewBox', `0 0 ${bbox.width} ${bbox.height}`);

  // Create a foreignObject to embed HTML
  const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  foreignObject.setAttribute('width', '100%');
  foreignObject.setAttribute('height', '100%');

  // The clone keeps its utility classes, so the file needs the page's CSS, plus the
  // root's classes (e.g. "dark") for variants that depend on them
  const wrapper = document.createElement('div');
  wrapper.className = document.documentElement.className;
  const style = document.createElement('style');
  style.textContent = collectPageCss();
  wrapper.appendChild(style);

  // Clone the element
  const clone = element.cloneNode(true) as HTMLElement;
  wrapper.appendChild(clone);
  foreignObject.appendChild(wrapper);
  svg.appendChild(foreignObject);

  return svg;
}

export async function exportToJSON(data: unknown, filename: string = 'schedules.json'): Promise<void> {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    downloadBlob(new Blob([jsonString], { type: 'application/json' }), filename);
  } catch (error) {
    console.error('Failed to export JSON:', error);
    throw error;
  }
}
