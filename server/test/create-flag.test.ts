import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Initial environment configuration', () => {
  let ctx: ReturnType<typeof createApp>;

  beforeEach(() => { ctx = createApp(':memory:', false); });
  afterEach(() => { ctx.db.close(); });

  const invalidEnvironments: unknown[] = [null, [], 'production', false, 12];
  for (const environment of ['production', 'staging', 'development']) {
    for (const config of [null, [], 'enabled', false, 12,
      { enabled: 'false' }, { enabled: 0 }, { enabled: null },
      { killSwitchActive: 'false' }, { killSwitchActive: 1 }, { killSwitchActive: null },
      { rolloutPercentage: '50' }, { rolloutPercentage: null },
      { rolloutPercentage: false }, { rolloutPercentage: -1 }, { rolloutPercentage: 101 }]) {
      invalidEnvironments.push({ [environment]: config });
    }
  }

  it.each(invalidEnvironments.map(environments => ({ environments })))(
    'rejects invalid environment input $environments without creating a flag', async ({ environments }) => {
      const response = await request(ctx.app).post('/api/flags').send({
        key: 'checkout', name: 'Checkout', environments,
      }).expect(400);
      expect(response.body).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
      await request(ctx.app).get('/api/flags/checkout').expect(404);
    }
  );

  it('preserves defaults when environments are omitted', async () => {
    const created = await request(ctx.app).post('/api/flags')
      .send({ key: 'checkout', name: 'Checkout' }).expect(201);
    for (const [environment, percentage] of [['production', 0], ['staging', 100], ['development', 100]]) {
      expect(created.body.data.environments[environment]).toEqual({
        enabled: true, killSwitchActive: false, rolloutPercentage: percentage, rules: [],
      });
    }
  });

  it.each([0, 23.5, 100])('persists valid partial settings and evaluates a %s percent rollout', async (rolloutPercentage) => {
    const created = await request(ctx.app).post('/api/flags').send({
      key: 'checkout', name: 'Checkout', environments: {
        production: { enabled: true, killSwitchActive: false, rolloutPercentage },
        staging: { enabled: false }, development: { killSwitchActive: true },
      },
    }).expect(201);
    const stored = await request(ctx.app).get('/api/flags/checkout').expect(200);
    expect(stored.body.data.environments).toEqual(created.body.data.environments);
    const evaluate = (environment: string) => request(ctx.app).post('/api/flags/checkout/evaluate')
      .send({ environment, context: { userId: 'customer' } }).expect(200);
    const production = await evaluate('production');
    expect(production.body.data.enabled).toBe(production.body.data.bucket < rolloutPercentage);
    expect((await evaluate('staging')).body.data.reason).toBe('DISABLED');
    expect((await evaluate('development')).body.data.reason).toBe('KILL_SWITCH');
  });
});
