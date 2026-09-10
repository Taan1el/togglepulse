import { DatabaseSync } from 'node:sqlite';
import type {
  FeatureFlag,
  EnvironmentConfig,
  FlagStats,
} from '../../../shared/types.js';

export class FlagRepository {
  constructor(private db: DatabaseSync) {}

  createFlag(flag: FeatureFlag): void {
    this.db
      .prepare(`
        INSERT INTO feature_flags (
          key, name, description, tags_json, environments_json, evaluation_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        flag.key,
        flag.name,
        flag.description,
        JSON.stringify(flag.tags),
        JSON.stringify(flag.environments),
        flag.evaluationCount,
        flag.createdAt,
        flag.updatedAt
      );
  }

  getFlagByKey(key: string): FeatureFlag | null {
    const row = this.db.prepare('SELECT * FROM feature_flags WHERE key = ?').get(key) as any;
    if (!row) return null;

    return {
      key: row.key,
      name: row.name,
      description: row.description,
      tags: JSON.parse(row.tags_json || '[]'),
      environments: JSON.parse(row.environments_json || '{}'),
      evaluationCount: row.evaluation_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  getAllFlags(): FeatureFlag[] {
    const rows = this.db.prepare('SELECT * FROM feature_flags ORDER BY updated_at DESC').all() as any[];

    return rows.map((r) => ({
      key: r.key,
      name: r.name,
      description: r.description,
      tags: JSON.parse(r.tags_json || '[]'),
      environments: JSON.parse(r.environments_json || '{}'),
      evaluationCount: r.evaluation_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  updateFlagEnvironments(key: string, environments: Record<string, EnvironmentConfig>): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE feature_flags
        SET environments_json = ?, updated_at = ?
        WHERE key = ?
      `)
      .run(JSON.stringify(environments), now, key);
  }

  deleteFlag(key: string): boolean {
    const res = this.db.prepare('DELETE FROM feature_flags WHERE key = ?').run(key);
    return res.changes > 0;
  }

  incrementEvaluationCount(key: string): void {
    this.db
      .prepare('UPDATE feature_flags SET evaluation_count = evaluation_count + 1 WHERE key = ?')
      .run(key);
  }

  recordEvaluationAudit(audit: {
    id: string;
    flagKey: string;
    environment: string;
    userId: string;
    result: boolean;
    reason: string;
    context: any;
    timestamp: string;
  }): void {
    this.db
      .prepare(`
        INSERT INTO evaluation_audits (
          id, flag_key, environment, user_id, result, reason, context_json, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        audit.id,
        audit.flagKey,
        audit.environment,
        audit.userId,
        audit.result ? 1 : 0,
        audit.reason,
        JSON.stringify(audit.context),
        audit.timestamp
      );
  }

  getRecentAudits(flagKey?: string, limit = 50): any[] {
    let sql = 'SELECT * FROM evaluation_audits';
    const params: any[] = [];

    if (flagKey) {
      sql += ' WHERE flag_key = ?';
      params.push(flagKey);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map((r) => ({
      id: r.id,
      flagKey: r.flag_key,
      environment: r.environment,
      userId: r.user_id,
      result: r.result === 1,
      reason: r.reason,
      context: JSON.parse(r.context_json || '{}'),
      timestamp: r.timestamp,
    }));
  }

  getFlagStats(flagKey: string): FlagStats {
    const totalRow = this.db
      .prepare('SELECT COUNT(*) as count FROM evaluation_audits WHERE flag_key = ?')
      .get(flagKey) as any;

    const trueRow = this.db
      .prepare('SELECT COUNT(*) as count FROM evaluation_audits WHERE flag_key = ? AND result = 1')
      .get(flagKey) as any;

    const killRow = this.db
      .prepare("SELECT COUNT(*) as count FROM evaluation_audits WHERE flag_key = ? AND reason = 'KILL_SWITCH'")
      .get(flagKey) as any;

    const total = totalRow?.count || 0;
    const trueCount = trueRow?.count || 0;

    return {
      totalEvaluations: total,
      trueEvaluations: trueCount,
      falseEvaluations: total - trueCount,
      killSwitchEngagements: killRow?.count || 0,
    };
  }
}
