import request from 'supertest';
import { enforceNoAutonomousExecution } from './guardrail';
import { createApp } from './server';
import type { DraftIntentResponse } from './types';

const app = createApp();

describe('GET /health', () => {
  it('returns the service health payload', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'ai-agent',
      version: '0.1.0',
    });
    expect(typeof res.body.uptime).toBe('number');
    expect(Date.parse(res.body.timestamp)).not.toBeNaN();
  });
});

describe('POST /v1/intents/validate', () => {
  it('accepts a valid payment intent', async () => {
    const intent = {
      type: 'payment',
      destination: 'GABC123',
      amount: '10.5',
      asset: 'XLM',
    };

    const res = await request(app).post('/v1/intents/validate').send(intent);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: true, intent });
  });

  it('rejects requests with missing payment fields', async () => {
    const res = await request(app)
      .post('/v1/intents/validate')
      .send({ type: 'payment', destination: 'GABC123', asset: 'XLM' });

    expect(res.status).toBe(400);
    expect(res.body.errors.fieldErrors).toHaveProperty('amount');
  });

  it('rejects unsupported intent types', async () => {
    const res = await request(app).post('/v1/intents/validate').send({
      type: 'invoice',
      destination: 'GABC123',
      amount: '10',
      asset: 'XLM',
    });

    expect(res.status).toBe(400);
    expect(res.body.errors.fieldErrors.type).toEqual(
      expect.arrayContaining([expect.stringContaining('Invalid discriminator value')])
    );
  });

  it('rejects empty request bodies', async () => {
    const res = await request(app).post('/v1/intents/validate').send({});

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});

describe('enforceNoAutonomousExecution', () => {
  const validDraft: DraftIntentResponse = {
    status: 'draft',
    requiresConfirmation: true,
    summary: 'test',
    intent: { type: 'payment', destination: 'G123', amount: '10', asset: 'XLM' },
  };

  it('does not throw for a valid draft response', () => {
    expect(() => enforceNoAutonomousExecution(validDraft)).not.toThrow();
  });

  it('throws when status is not "draft"', () => {
    const bad = { ...validDraft, status: 'executed' } as unknown as DraftIntentResponse;
    expect(() => enforceNoAutonomousExecution(bad)).toThrow('GUARDRAIL VIOLATION');
  });

  it('throws when requiresConfirmation is false', () => {
    const bad = { ...validDraft, requiresConfirmation: false } as unknown as DraftIntentResponse;
    expect(() => enforceNoAutonomousExecution(bad)).toThrow('GUARDRAIL VIOLATION');
  });
});
