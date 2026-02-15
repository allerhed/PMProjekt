import domtoimage from 'dom-to-image-more';

export interface ScreenshotOptions {
  scale?: number;
  excludeSelector?: string;
}

export async function captureScreenshot(
  options: ScreenshotOptions = {},
): Promise<string> {
  const {
    scale = window.devicePixelRatio || 2,
    excludeSelector = '[data-bug-reporter-exclude]',
  } = options;

  const width = document.body.scrollWidth;
  const height = document.body.scrollHeight;

  const dataUrl = await domtoimage.toPng(document.body, {
    bgcolor: '#ffffff',
    width,
    height,
    style: {
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      width: `${width}px`,
      height: `${height}px`,
    },
    quality: 1,
    filter: (node: Node) => {
      if (excludeSelector && node instanceof HTMLElement) {
        return !node.matches(excludeSelector);
      }
      return true;
    },
  });

  return dataUrl;
}
