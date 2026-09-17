import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Kill switch configuration preservation', () => {
  let ctx: ReturnType<typeof createApp>;

  beforeEach(() => { ctx = createApp(':memory:', false); });
  afterEach(() => { ctx.db.close(); });

  it.each([0, 23, 100])('preserves a %i percent rollout across repeated toggles', async (percentage) => {
    const production = {
      enabled: true, killSwitchActive: false, rolloutPercentage: percentage,
      rules: [{ id: 'vip', attribute: 'plan', operator: 'EQUALS', values: ['pro'], serveValue: true }],
    };
    const created = await request(ctx.app).post('/api/flags').send({
      key: 'checkout', name: 'Checkout', environments: { production },
    }).expect(201);
    const evaluate = () => request(ctx.app).post('/api/flags/checkout/evaluate').send({
      context: { userId: 'customer', attributes: { plan: 'pro' } },
    });
    for (const active of [true, true, false, false]) {
      const updated = await request(ctx.app).post('/api/flags/checkout/killswitch')
        .send({ active }).expect(200);
      expect(updated.body.data.environments.production).toEqual({ ...production, killSwitchActive: active });
      expect(updated.body.data.environments.staging).toEqual(created.body.data.environments.staging);
      const result = await evaluate().expect(200);
      expect(result.body.data.enabled).toBe(!active);
      expect(result.body.data.reason).toBe(active ? 'KILL_SWITCH' : 'RULE_MATCH');
    }
    const stored = await request(ctx.app).get('/api/flags/checkout').expect(200);
    expect(stored.body.data.environments.production).toEqual(production);
  });

  it('does not enable an environment that was disabled before activation', async () => {
    await request(ctx.app).post('/api/flags').send({
      key: 'reports', name: 'Reports',
      environments: { production: { enabled: false, rolloutPercentage: 100 } },
    }).expect(201);
    for (const active of [true, false]) {
      await request(ctx.app).post('/api/flags/reports/killswitch').send({ active }).expect(200);
    }
    const result = await request(ctx.app).post('/api/flags/reports/evaluate')
      .send({ context: { userId: 'customer' } }).expect(200);
    expect(result.body.data).toMatchObject({ enabled: false, reason: 'DISABLED' });
  });

  it('keeps rollout edits made while the kill switch is active', async () => {
    await request(ctx.app).post('/api/flags').send({ key: 'search', name: 'Search' }).expect(201);
    await request(ctx.app).post('/api/flags/search/killswitch').send({ active: true }).expect(200);
    await request(ctx.app).patch('/api/flags/search/rollout')
      .send({ environment: 'production', rolloutPercentage: 17, enabled: false }).expect(200);
    const result = await request(ctx.app).post('/api/flags/search/killswitch')
      .send({ active: false }).expect(200);
    expect(result.body.data.environments.production).toMatchObject({
      rolloutPercentage: 17, enabled: false, killSwitchActive: false,
    });
  });

  it.each([['false', 'string'], [0, 'number'], [null, 'null']])(
    'rejects a non-boolean active value (%s as %s) instead of coercing it',
    async (active: unknown) => {
      await request(ctx.app).post('/api/flags').send({ key: 'billing', name: 'Billing' }).expect(201);
      const response = await request(ctx.app).post('/api/flags/billing/killswitch')
        .send({ active }).expect(400);
      expect(response.body).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
      const stored = await request(ctx.app).get('/api/flags/billing').expect(200);
      expect(stored.body.data.environments.production.killSwitchActive).toBe(false);
    }
  );

  it('rejects a non-boolean enabled or killSwitchActive on a direct rollout update', async () => {
    await request(ctx.app).post('/api/flags').send({ key: 'search-two', name: 'Search Two' }).expect(201);
    const badEnabled = await request(ctx.app).patch('/api/flags/search-two/rollout')
      .send({ environment: 'production', enabled: 'true' }).expect(400);
    expect(badEnabled.body.code).toBe('VALIDATION_ERROR');
    const badKillSwitch = await request(ctx.app).patch('/api/flags/search-two/rollout')
      .send({ environment: 'production', killSwitchActive: 1 }).expect(400);
    expect(badKillSwitch.body.code).toBe('VALIDATION_ERROR');
  });
});
