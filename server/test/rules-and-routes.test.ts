import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const validRule = { id: 'r1', attribute: 'country', operator: 'IN', values: ['EE'], serveValue: true };

describe('Targeting rule validation on creation', () => {
  let ctx: ReturnType<typeof createApp>;
  beforeEach(() => { ctx = createApp(':memory:', false); });
  afterEach(() => { ctx.db.close(); });

  const create = (rules: unknown) => request(ctx.app).post('/api/flags')
    .send({ key: 'ruled', name: 'Ruled', environments: { production: { rules } } });

  it.each([
    ['rules is not an array', 'EE'],
    ['rule is not an object', [1]],
    ['missing id', [{ ...validRule, id: undefined }]],
    ['duplicate id', [validRule, validRule]],
    ['empty attribute', [{ ...validRule, attribute: '' }]],
    ['unknown operator', [{ ...validRule, operator: 'GREATER_THAN' }]],
    ['values not strings', [{ ...validRule, values: [1] }]],
    ['values not an array', [{ ...validRule, values: 'EE' }]],
    ['serveValue not boolean', [{ ...validRule, serveValue: 'true' }]],
  ])('rejects %s', async (_name, rules) => {
    const res = await create(rules).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    await request(ctx.app).get('/api/flags/ruled').expect(404);
  });

  it('stores valid rules and applies them during evaluation', async () => {
    await create([validRule]).expect(201);
    const hit = await request(ctx.app).post('/api/flags/ruled/evaluate')
      .send({ context: { userId: 'u1', attributes: { country: 'ee' } } }).expect(200);
    expect(hit.body.data).toMatchObject({ enabled: true, reason: 'RULE_MATCH', matchedRuleId: 'r1' });
    const miss = await request(ctx.app).post('/api/flags/ruled/evaluate')
      .send({ context: { userId: 'u1', attributes: { country: 'DE' } } }).expect(200);
    expect(miss.body.data.reason).toBe('ROLLOUT_BUCKET');
  });
});

describe('Flag lifecycle routes', () => {
  let ctx: ReturnType<typeof createApp>;
  beforeEach(async () => {
    ctx = createApp(':memory:', false);
    await request(ctx.app).post('/api/flags').send({ key: 'Beta Flag!', name: 'Beta' }).expect(201);
  });
  afterEach(() => { ctx.db.close(); });

  it('normalizes the key to lowercase with underscores', async () => {
    const res = await request(ctx.app).get('/api/flags/beta_flag_').expect(200);
    expect(res.body.data.name).toBe('Beta');
  });

  it('rejects an unknown environment name on rollout updates', async () => {
    const res = await request(ctx.app).patch('/api/flags/beta_flag_/rollout')
      .send({ environment: 'qa', rolloutPercentage: 5 }).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('clamps rollout percentages sent to the update endpoint', async () => {
    const up = await request(ctx.app).patch('/api/flags/beta_flag_/rollout').send({ rolloutPercentage: 250 }).expect(200);
    expect(up.body.data.environments.production.rolloutPercentage).toBe(100);
    const down = await request(ctx.app).patch('/api/flags/beta_flag_/rollout').send({ rolloutPercentage: -5 }).expect(200);
    expect(down.body.data.environments.production.rolloutPercentage).toBe(0);
  });

  it('counts evaluations in the flag, the stats endpoint and the audit trail', async () => {
    await request(ctx.app).patch('/api/flags/beta_flag_/rollout').send({ rolloutPercentage: 100 }).expect(200);
    for (const userId of ['a', 'b', 'c']) {
      await request(ctx.app).post('/api/flags/beta_flag_/evaluate').send({ context: { userId } }).expect(200);
    }
    await request(ctx.app).post('/api/flags/beta_flag_/killswitch').send({ active: true }).expect(200);
    await request(ctx.app).post('/api/flags/beta_flag_/evaluate').send({ context: { userId: 'd' } }).expect(200);

    const flag = await request(ctx.app).get('/api/flags/beta_flag_').expect(200);
    expect(flag.body.data.evaluationCount).toBe(4);
    const stats = await request(ctx.app).get('/api/flags/beta_flag_/stats').expect(200);
    expect(stats.body.data).toEqual({
      totalEvaluations: 4, trueEvaluations: 3, falseEvaluations: 1, killSwitchEngagements: 1,
    });
    const audits = await request(ctx.app).get('/api/audits?flagKey=beta_flag_&limit=2').expect(200);
    expect(audits.body.data).toHaveLength(2);
    const other = await request(ctx.app).get('/api/audits?flagKey=nope').expect(200);
    expect(other.body.data).toEqual([]);
  });

  it('deletes a flag together with its audits and reports when nothing was deleted', async () => {
    await request(ctx.app).post('/api/flags/beta_flag_/evaluate').send({ context: { userId: 'a' } }).expect(200);
    const first = await request(ctx.app).delete('/api/flags/beta_flag_').expect(200);
    expect(first.body.data.deleted).toBe(true);
    await request(ctx.app).get('/api/flags/beta_flag_').expect(404);
    const audits = await request(ctx.app).get('/api/audits?flagKey=beta_flag_').expect(200);
    expect(audits.body.data).toEqual([]);
    const second = await request(ctx.app).delete('/api/flags/beta_flag_').expect(200);
    expect(second.body.data.deleted).toBe(false);
  });

  it('evaluates an unknown environment as off without failing', async () => {
    const res = await request(ctx.app).post('/api/flags/beta_flag_/evaluate')
      .send({ environment: 'qa', context: { userId: 'a' } }).expect(200);
    expect(res.body.data).toMatchObject({ enabled: false, reason: 'DEFAULT_OFF' });
  });

  it('rejects a kill switch request without a boolean', async () => {
    await request(ctx.app).post('/api/flags/beta_flag_/killswitch').send({ active: 'yes' }).expect(400);
  });
});
