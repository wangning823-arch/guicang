import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebServer } from '../src/web/server.js';

describe('WebServer', () => {
  let server: WebServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = new WebServer({ port: 19999 });
    await server.start();
    baseUrl = 'http://localhost:19999';
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('workflow CRUD', () => {
    it('should create a workflow', async () => {
      const res = await fetch(`${baseUrl}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'test-workflow',
          nodes: [{ id: 'n1', type: 'start', name: 'Start', x: 0, y: 0 }],
          connections: [],
        }),
      });
      const data = await res.json() as { id: string; name: string };
      expect(res.status).toBe(200);
      expect(data.name).toBe('test-workflow');
      expect(data.id).toBeDefined();
    });

    it('should list workflows', async () => {
      const res = await fetch(`${baseUrl}/api/workflows`);
      const data = await res.json() as { workflows: Array<{ name: string }> };
      expect(res.status).toBe(200);
      expect(Array.isArray(data.workflows)).toBe(true);
    });

    it('should get a single workflow', async () => {
      // Create first
      const createRes = await fetch(`${baseUrl}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'wf-get', nodes: [], connections: [] }),
      });
      const created = await createRes.json() as { id: string };

      const res = await fetch(`${baseUrl}/api/workflows/${created.id}`);
      const data = await res.json() as { name: string };
      expect(res.status).toBe(200);
      expect(data.name).toBe('wf-get');
    });

    it('should update a workflow', async () => {
      const createRes = await fetch(`${baseUrl}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'wf-update', nodes: [], connections: [] }),
      });
      const created = await createRes.json() as { id: string };

      const res = await fetch(`${baseUrl}/api/workflows/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'wf-update-2' }),
      });
      const data = await res.json() as { name: string };
      expect(res.status).toBe(200);
      expect(data.name).toBe('wf-update-2');
    });

    it('should delete a workflow', async () => {
      const createRes = await fetch(`${baseUrl}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'wf-delete', nodes: [], connections: [] }),
      });
      const created = await createRes.json() as { id: string };

      const res = await fetch(`${baseUrl}/api/workflows/${created.id}`, {
        method: 'DELETE',
      });
      const data = await res.json() as { ok: boolean };
      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);

      // Verify deleted
      const getRes = await fetch(`${baseUrl}/api/workflows/${created.id}`);
      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent workflow', async () => {
      const res = await fetch(`${baseUrl}/api/workflows/non-existent`);
      expect(res.status).toBe(404);
    });
  });

  describe('static files', () => {
    it('should serve workflow editor', async () => {
      const res = await fetch(`${baseUrl}/workflow-editor.html`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('归藏');
    });
  });
});
