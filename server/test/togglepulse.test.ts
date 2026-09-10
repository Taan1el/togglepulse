import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { EvaluatorService } from '../src/services/evaluator.service.js';
import type { FeatureFlag } from '../../shared/types.js';

describe('TogglePulse Feature Flag & Canary Rollout Suite', () => {
  const evaluator = new EvaluatorService();

  describe('Deterministic SHA-256 Bucketing', () => {
    it('generates consistent deterministic bucket numbers for identical inputs', () => {
      const bucket1 = evaluator.computeBucket('usr_estonia_42', 'checkout_v2');
      const bucket2 = evaluator.computeBucket('usr_estonia_42', 'checkout_v2');
      expect(bucket1).toBe(bucket2);
      expect(bucket1).toBeGreaterThanOrEqual(0);
      expect(bucket1).toBeLessThan(100);
    });

    it('distributes buckets predictably across different flag keys', () => {
      const b1 = evaluator.computeBucket('usr_test', 'flag_alpha');
      const b2 = evaluator.computeBucket('usr_test', 'flag_beta');
      expect(typeof b1).toBe('number');
      expect(typeof b2).toBe('number');
    });
  });

  describe('Targeting Rule Engine & Semver Operators', () => {
    it('evaluates EQUALS and IN rules accurately', () => {
      const ruleEquals = {
        id: 'r1',
        attribute: 'country',
        operator: 'EQUALS' as const,
        values: ['EE'],
        serveValue: true,
      };

      expect(evaluator.evaluateRule(ruleEquals, { userId: 'u1', attributes: { country: 'EE' } })).toBe(true);
      expect(evaluator.evaluateRule(ruleEquals, { userId: 'u1', attributes: { country: 'LV' } })).toBe(false);

      const ruleIn = {
        id: 'r2',
        attribute: 'role',
        operator: 'IN' as const,
        values: ['admin', 'beta_tester'],
        serveValue: true,
      };

      expect(evaluator.evaluateRule(ruleIn, { userId: 'u1', attributes: { role: 'beta_tester' } })).toBe(true);
      expect(evaluator.evaluateRule(ruleIn, { userId: 'u1', attributes: { role: 'standard_user' } })).toBe(false);
    });

    it('evaluates SEMVER_GTE for client application versions', () => {
      const ruleSemver = {
        id: 'r3',
        attribute: 'appVersion',
        operator: 'SEMVER_GTE' as const,
        values: ['2.4.0'],
        serveValue: true,
      };

      expect(evaluator.evaluateRule(ruleSemver, { userId: 'u1', attributes: { appVersion: '2.5.1' } })).toBe(true);
      expect(evaluator.evaluateRule(ruleSemver, { userId: 'u1', attributes: { appVersion: '2.4.0' } })).toBe(true);
      expect(evaluator.evaluateRule(ruleSemver, { userId: 'u1', attributes: { appVersion: '2.3.9' } })).toBe(false);
    });
  });

  describe('Evaluation Precedence & Emergency Kill Switch', () => {
    const sampleFlag: FeatureFlag = {
      key: 'new_billing',
      name: 'New Billing Portal',
      description: 'Stripe Elements checkout',
      tags: ['billing'],
      environments: {
        production: {
          enabled: true,
          killSwitchActive: false,
          rolloutPercentage: 0,
          rules: [
            {
              id: 'rule_vip',
              attribute: 'plan',
              operator: 'EQUALS',
              values: ['enterprise'],
              serveValue: true,
            },
          ],
        },
      },
      evaluationCount: 0,
      createdAt: '2026-09-10T12:00:00Z',
      updatedAt: '2026-09-10T12:00:00Z',
    };

    it('matches targeted rule when criteria is met', () => {
      const res = evaluator.evaluateFlag(sampleFlag, 'production', {
        userId: 'usr_enterprise_1',
        attributes: { plan: 'enterprise' },
      });

      expect(res.enabled).toBe(true);
      expect(res.reason).toBe('RULE_MATCH');
      expect(res.matchedRuleId).toBe('rule_vip');
    });

    it('emergency kill switch immediately overrides targeted rules and percentage rollouts', () => {
      const killedFlag: FeatureFlag = {
        ...sampleFlag,
        environments: {
          production: {
            ...sampleFlag.environments.production,
            killSwitchActive: true,
          },
        },
      };

      const res = evaluator.evaluateFlag(killedFlag, 'production', {
        userId: 'usr_enterprise_1',
        attributes: { plan: 'enterprise' },
      });

      expect(res.enabled).toBe(false);
      expect(res.reason).toBe('KILL_SWITCH');
    });
  });

  describe('REST API Endpoints Integration', () => {
    let app: any;

    beforeEach(() => {
      const ctx = createApp(':memory:', false);
      app = ctx.app;
    });

    it('checks health status on /api/health', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.service).toBe('togglepulse-engine');
    });

    it('creates, updates rollout, evaluates and audits feature flags', async () => {
      // 1. Create flag
      const createRes = await request(app)
        .post('/api/flags')
        .send({
          key: 'instant_payouts',
          name: 'Instant SEPA Payouts',
          description: 'Instant SEPA payments via Nordic banking rails',
          tags: ['fintech', 'nordic'],
          environments: {
            production: {
              enabled: true,
              killSwitchActive: false,
              rolloutPercentage: 0,
              rules: [
                {
                  id: 'rule_ee',
                  attribute: 'country',
                  operator: 'EQUALS',
                  values: ['EE'],
                  serveValue: true,
                },
              ],
            },
          },
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.key).toBe('instant_payouts');

      // 2. Evaluate Estonian user (matches rule)
      const evalRes1 = await request(app)
        .post('/api/flags/instant_payouts/evaluate')
        .send({
          environment: 'production',
          context: { userId: 'usr_tallinn_01', attributes: { country: 'EE' } },
        });

      expect(evalRes1.status).toBe(200);
      expect(evalRes1.body.data.enabled).toBe(true);
      expect(evalRes1.body.data.reason).toBe('RULE_MATCH');

      // 3. Ramp up rollout to 100%
      const rolloutRes = await request(app)
        .patch('/api/flags/instant_payouts/rollout')
        .send({
          environment: 'production',
          rolloutPercentage: 100,
        });

      expect(rolloutRes.status).toBe(200);
      expect(rolloutRes.body.data.environments.production.rolloutPercentage).toBe(100);

      // 4. Evaluate German user (matches 100% rollout)
      const evalRes2 = await request(app)
        .post('/api/flags/instant_payouts/evaluate')
        .send({
          environment: 'production',
          context: { userId: 'usr_berlin_02', attributes: { country: 'DE' } },
        });

      expect(evalRes2.status).toBe(200);
      expect(evalRes2.body.data.enabled).toBe(true);
      expect(evalRes2.body.data.reason).toBe('ROLLOUT_BUCKET');

      // 5. Trigger emergency kill switch
      const killRes = await request(app)
        .post('/api/flags/instant_payouts/killswitch')
        .send({ environment: 'production', active: true });

      expect(killRes.status).toBe(200);
      expect(killRes.body.data.environments.production.killSwitchActive).toBe(true);

      // 6. Re-evaluate: must return false due to kill switch
      const evalRes3 = await request(app)
        .post('/api/flags/instant_payouts/evaluate')
        .send({
          environment: 'production',
          context: { userId: 'usr_tallinn_01', attributes: { country: 'EE' } },
        });

      expect(evalRes3.status).toBe(200);
      expect(evalRes3.body.data.enabled).toBe(false);
      expect(evalRes3.body.data.reason).toBe('KILL_SWITCH');

      // 7. Verify audit log recorded all events
      const auditsRes = await request(app).get('/api/audits?flagKey=instant_payouts');
      expect(auditsRes.status).toBe(200);
      expect(auditsRes.body.data.length).toBe(3);
    });
  });
});
