import html2canvas from 'html2canvas';

export interface ScreenshotOptions {
  scale?: number;
  excludeSelector?: string;
}

export async function captureScreenshot(
  options: ScreenshotOptions = {},
): Promise<string> {
  const { scale = 1, excludeSelector = '[data-bug-reporter-exclude]' } = options;

  // Hide excluded elements
  const hidden: HTMLElement[] = [];
  if (excludeSelector) {
    document.querySelectorAll<HTMLElement>(excludeSelector).forEach((el) => {
      hidden.push(el);
      el.style.visibility = 'hidden';
    });
  }

  try {
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      allowTaint: true,
      logging: false,
      scale,
      backgroundColor: '#ffffff',
    });

    return canvas.toDataURL('image/png');
  } finally {
    // Restore hidden elements
    for (const el of hidden) {
      el.style.visibility = '';
    }
  }
}
