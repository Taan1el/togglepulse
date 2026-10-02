import { DatabaseSync } from 'node:sqlite';
import { FlagRepository } from '../repositories/flag.repository.js';
import { EvaluationEngine } from '../services/evaluation-engine.js';
import { FlagService } from '../services/flag.service.js';
import { SAMPLE_FLAGS, SAMPLE_EVALUATIONS } from '../../../shared/sample-flags.js';

export function seedDatabase(db: DatabaseSync): void {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM feature_flags').get() as { count: number };
  if (countRow && countRow.count > 0) return;

  console.log('[TogglePulse Seed] Seeding sample feature flags...');
  const repo = new FlagRepository(db);
  const engine = new EvaluationEngine();
  const service = new FlagService(repo, engine);

  for (const flag of SAMPLE_FLAGS) {
    service.createFlag(flag);
  }

  for (const sample of SAMPLE_EVALUATIONS) {
    service.evaluate(sample.flagKey, 'production', {
      userId: sample.userId,
      attributes: { country: sample.country },
    });
  }

  console.log('[TogglePulse Seed] Seeded sample flags and evaluations.');
}
