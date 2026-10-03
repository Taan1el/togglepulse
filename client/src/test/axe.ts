import { configureAxe } from 'vitest-axe';

// jsdom cannot compute colors or layout, so color-contrast is skipped here (it was checked separately from computed values); region is skipped because tests render fragments, not full pages.
export const axe = configureAxe({
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
  rules: {
    'color-contrast': { enabled: false },
    region: { enabled: false },
  },
});
