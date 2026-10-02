// Sample flags and evaluations used to seed the server database on first run
// and the browser demo. Fixed values only, so both start from the same data.
import type { CreateFlagPayload } from './types.js';

export const SAMPLE_FLAGS: CreateFlagPayload[] = [
  {
    key: 'checkout_v2',
    name: 'One-click checkout',
    description: 'Single-step checkout with saved payment details and pre-filled shipping addresses.',
    tags: ['checkout', 'revenue'],
    environments: {
      production: {
        enabled: true,
        killSwitchActive: false,
        rolloutPercentage: 35,
        rules: [
          { id: 'rule_baltic_beta', attribute: 'country', operator: 'IN', values: ['EE', 'FI', 'SE'], serveValue: true },
        ],
      },
    },
  },
  {
    key: 'vector_search',
    name: 'Semantic catalog search',
    description: 'Ranks catalog results by embedding similarity instead of keyword matching.',
    tags: ['search', 'experiment'],
    environments: {
      production: { enabled: true, killSwitchActive: false, rolloutPercentage: 15, rules: [] },
      staging: { enabled: true, killSwitchActive: false, rolloutPercentage: 60, rules: [] },
    },
  },
  {
    key: 'legacy_md5_auth',
    name: 'Legacy partner token check',
    description: 'Old authorization path kept for partners that have not moved to OAuth2 yet.',
    tags: ['auth', 'deprecated'],
    environments: {
      production: { enabled: false, killSwitchActive: true, rolloutPercentage: 0, rules: [] },
    },
  },
  {
    key: 'obsidian_dark_theme',
    name: 'Dark theme',
    description: 'Dark color palette for the web app, selectable in account settings.',
    tags: ['ui', 'frontend'],
    environments: {
      production: { enabled: true, killSwitchActive: false, rolloutPercentage: 100, rules: [] },
    },
  },
];

export const SAMPLE_EVALUATIONS: { flagKey: string; userId: string; country: string }[] = [
  { flagKey: 'checkout_v2', userId: 'usr_alice_101', country: 'EE' },
  { flagKey: 'checkout_v2', userId: 'usr_bob_202', country: 'DE' },
  { flagKey: 'checkout_v2', userId: 'usr_charlie_303', country: 'DE' },
  { flagKey: 'checkout_v2', userId: 'usr_diana_404', country: 'DE' },
  { flagKey: 'checkout_v2', userId: 'usr_erik_505', country: 'DE' },
];
