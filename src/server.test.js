import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import app from '../server';

let server;
let baseUrl;

beforeAll(() => {
  return new Promise((resolve) => {
    // Start Express on an ephemeral port (0) for parallel-safe testing
    server = app.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

afterAll(() => {
  return new Promise((resolve) => {
    server.close(resolve);
  });
});

describe('Express Proxy Routes', () => {
  test('rejects POST with missing body arguments', async () => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Description must be at least 20 characters');
  });

  test('rejects POST with invalid budget', async () => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dayDescription: 'A very long test description to bypass the character limits check.',
        peopleCount: 4,
        budget: -5.0
      })
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Budget must be greater than 0');
  });

  test('rejects POST with invalid origin (CORS test)', async () => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://unauthorized-domain.com'
      },
      body: JSON.stringify({
        dayDescription: 'A very long test description to bypass the character limits check.',
        peopleCount: 4,
        budget: 500
      })
    });

    // Express cors middleware returns 500 when origin is rejected by the filter
    expect(response.status).toBe(500);
  });
});
