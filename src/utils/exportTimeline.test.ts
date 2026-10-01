import { describe, it, expect, afterEach } from 'vitest';
import { createSVGFromElement } from './exportTimeline';

describe('createSVGFromElement', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.documentElement.className = '';
  });

  it('embeds the page CSS and the root classes so the SVG renders styled', () => {
    const style = document.createElement('style');
    style.textContent = '.bg-white { background-color: #fff; }';
    document.head.appendChild(style);
    document.documentElement.className = 'dark';

    const element = document.createElement('div');
    element.className = 'bg-white';
    element.textContent = 'Timeline';

    const svg = new XMLSerializer().serializeToString(createSVGFromElement(element));

    expect(svg).toMatch(/<style>\.bg-white \{ background-color: [^}]+\}<\/style>/);
    expect(svg).toContain('class="dark"');
    expect(svg).toContain('Timeline');
  });
});
