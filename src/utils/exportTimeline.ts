// src/utils/exportTimeline.ts

import html2canvas from 'html2canvas';

export async function exportToPNG(element: HTMLElement, filename: string = 'timeline.png'): Promise<void> {
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: null,
      scale: 2, // Higher quality
      logging: false,
    });

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
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
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export SVG:', error);
    throw error;
  }
}

function createSVGFromElement(element: HTMLElement): SVGSVGElement {
  const bbox = element.getBoundingClientRect();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', bbox.width.toString());
  svg.setAttribute('height', bbox.height.toString());
  svg.setAttribute('viewBox', `0 0 ${bbox.width} ${bbox.height}`);

  // Create a foreignObject to embed HTML
  const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  foreignObject.setAttribute('width', '100%');
  foreignObject.setAttribute('height', '100%');

  // Clone the element
  const clone = element.cloneNode(true) as HTMLElement;
  foreignObject.appendChild(clone);
  svg.appendChild(foreignObject);

  return svg;
}

export async function exportToJSON(data: unknown, filename: string = 'schedules.json'): Promise<void> {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export JSON:', error);
    throw error;
  }
}
