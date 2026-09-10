import { DatabaseSync } from 'node:sqlite';
import { FlagRepository } from '../repositories/flag.repository.js';
import { EvaluatorService } from '../services/evaluator.service.js';
import { FlagService } from '../services/flag.service.js';

export function seedDatabase(db: DatabaseSync): void {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM feature_flags').get() as { count: number };
  if (countRow && countRow.count > 0) return;

  console.log('[TogglePulse Seed] Seeding enterprise feature flags & canary rollouts...');
  const repo = new FlagRepository(db);
  const evaluator = new EvaluatorService();
  const service = new FlagService(repo, evaluator);

  // 1. One-Click Checkout with Baltic targeting rule
  service.createFlag({
    key: 'checkout_v2',
    name: 'One-Click Instant Checkout & Apple Pay',
    description: 'Streamlined checkout funnel with biometric payment integration and pre-filled shipping addresses.',
    tags: ['checkout', 'fintech', 'revenue'],
    environments: {
      production: {
        enabled: true,
        killSwitchActive: false,
        rolloutPercentage: 35,
        rules: [
          {
            id: 'rule_baltic_beta',
            attribute: 'country',
            operator: 'IN',
            values: ['EE', 'FI', 'SE'],
            serveValue: true,
          },
        ],
      },
    },
  });

  // 2. Vector Neural Search
  service.createFlag({
    key: 'vector_search',
    name: 'Vector Semantic Catalog Search',
    description: 'Replaces keyword matching with BERT vector embeddings for relevant catalog discovery.',
    tags: ['search', 'ai', 'experiment'],
    environments: {
      production: {
        enabled: true,
        killSwitchActive: false,
        rolloutPercentage: 15,
        rules: [],
      },
    },
  });

  // 3. Emergency Disabled Feature
  service.createFlag({
    key: 'legacy_md5_auth',
    name: 'Legacy MD5 Token Validator (Deprecated)',
    description: 'Legacy authorization path for third-party partners prior to OAuth2 migration.',
    tags: ['security', 'deprecated', 'killswitch'],
    environments: {
      production: {
        enabled: false,
        killSwitchActive: true,
        rolloutPercentage: 0,
        rules: [],
      },
    },
  });

  // 4. Dark mode 100% rollout
  service.createFlag({
    key: 'obsidian_dark_theme',
    name: 'Obsidian Night Mode UI',
    description: 'High-contrast dark mode palette matching IDE aesthetics.',
    tags: ['ui', 'frontend'],
    environments: {
      production: {
        enabled: true,
        killSwitchActive: false,
        rolloutPercentage: 100,
        rules: [],
      },
    },
  });

  // Seed sample evaluation audits
  const sampleUsers = ['usr_alice_101', 'usr_bob_202', 'usr_charlie_303', 'usr_diana_404', 'usr_erik_505'];
  for (const uid of sampleUsers) {
    service.evaluate('checkout_v2', 'production', {
      userId: uid,
      attributes: { country: uid.includes('alice') ? 'EE' : 'DE' },
    });
  }

  console.log('[TogglePulse Seed] Successfully seeded 4 production feature flags and test evaluations.');
}
