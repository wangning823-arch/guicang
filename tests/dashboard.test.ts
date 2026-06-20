import { describe, it, expect, beforeEach } from 'vitest';
import { Dashboard } from '../src/dashboard/panel.js';

describe('Dashboard', () => {
  let dash: Dashboard;

  beforeEach(() => {
    dash = new Dashboard();
  });

  describe('panel management', () => {
    it('should add a panel', () => {
      dash.addPanel({
        id: 'panel-1',
        type: 'status',
        title: 'System Status',
        position: { x: 0, y: 0, w: 2, h: 1 },
      });

      const panel = dash.getPanel('panel-1');
      expect(panel).toBeDefined();
      expect(panel!.title).toBe('System Status');
    });

    it('should remove a panel', () => {
      dash.addPanel({
        id: 'panel-1',
        type: 'status',
        title: 'Test',
        position: { x: 0, y: 0, w: 1, h: 1 },
      });

      expect(dash.removePanel('panel-1')).toBe(true);
      expect(dash.getPanel('panel-1')).toBeUndefined();
    });

    it('should return false when removing non-existent panel', () => {
      expect(dash.removePanel('nonexistent')).toBe(false);
    });

    it('should get all panels', () => {
      dash.addPanel({
        id: 'panel-1',
        type: 'status',
        title: 'A',
        position: { x: 0, y: 0, w: 1, h: 1 },
      });
      dash.addPanel({
        id: 'panel-2',
        type: 'metrics',
        title: 'B',
        position: { x: 1, y: 0, w: 1, h: 1 },
      });

      expect(dash.getAllPanels().length).toBe(2);
    });

    it('should update panel', () => {
      dash.addPanel({
        id: 'panel-1',
        type: 'status',
        title: 'Old Title',
        position: { x: 0, y: 0, w: 1, h: 1 },
      });

      const result = dash.updatePanel('panel-1', { title: 'New Title' });
      expect(result).toBe(true);
      expect(dash.getPanel('panel-1')!.title).toBe('New Title');
    });

    it('should return false when updating non-existent panel', () => {
      expect(dash.updatePanel('nonexistent', { title: 'Test' })).toBe(false);
    });
  });

  describe('data refresh', () => {
    it('should set refresh callback', async () => {
      dash.addPanel({
        id: 'panel-1',
        type: 'status',
        title: 'Test',
        position: { x: 0, y: 0, w: 1, h: 1 },
      });

      dash.setRefreshCallback('panel-1', async () => {
        return { status: 'ok' };
      });

      const data = await dash.refreshPanel('panel-1');
      expect(data).not.toBeNull();
      expect(data!.data).toEqual({ status: 'ok' });
    });

    it('should return null for panel without callback', async () => {
      dash.addPanel({
        id: 'panel-1',
        type: 'status',
        title: 'Test',
        position: { x: 0, y: 0, w: 1, h: 1 },
      });

      const data = await dash.refreshPanel('panel-1');
      expect(data).toBeNull();
    });

    it('should refresh all panels', async () => {
      dash.addPanel({
        id: 'panel-1',
        type: 'status',
        title: 'A',
        position: { x: 0, y: 0, w: 1, h: 1 },
      });
      dash.addPanel({
        id: 'panel-2',
        type: 'metrics',
        title: 'B',
        position: { x: 1, y: 0, w: 1, h: 1 },
      });

      dash.setRefreshCallback('panel-1', async () => ({ a: 1 }));
      dash.setRefreshCallback('panel-2', async () => ({ b: 2 }));

      const results = await dash.refreshAll();
      expect(results.length).toBe(2);
    });

    it('should handle refresh errors', async () => {
      dash.addPanel({
        id: 'panel-1',
        type: 'status',
        title: 'Test',
        position: { x: 0, y: 0, w: 1, h: 1 },
      });

      dash.setRefreshCallback('panel-1', async () => {
        throw new Error('Refresh failed');
      });

      const data = await dash.refreshPanel('panel-1');
      expect(data).toBeNull();
    });

    it('should get panel data', async () => {
      dash.addPanel({
        id: 'panel-1',
        type: 'status',
        title: 'Test',
        position: { x: 0, y: 0, w: 1, h: 1 },
      });

      dash.setRefreshCallback('panel-1', async () => ({ value: 42 }));
      await dash.refreshPanel('panel-1');

      const data = dash.getPanelData('panel-1');
      expect(data).toBeDefined();
      expect(data!.data).toEqual({ value: 42 });
    });
  });

  describe('import/export', () => {
    it('should export config', () => {
      dash.addPanel({
        id: 'panel-1',
        type: 'status',
        title: 'Test',
        position: { x: 0, y: 0, w: 1, h: 1 },
      });

      const config = dash.exportConfig();
      expect(config.length).toBe(1);
      expect(config[0].id).toBe('panel-1');
    });

    it('should import config', () => {
      dash.importConfig([
        {
          id: 'panel-1',
          type: 'status',
          title: 'Imported',
          position: { x: 0, y: 0, w: 1, h: 1 },
        },
      ]);

      expect(dash.getPanel('panel-1')).toBeDefined();
    });
  });

  describe('default dashboard', () => {
    it('should create default dashboard', () => {
      dash.createDefault();
      const panels = dash.getAllPanels();

      expect(panels.length).toBe(5);
      expect(panels.some((p) => p.type === 'status')).toBe(true);
      expect(panels.some((p) => p.type === 'metrics')).toBe(true);
      expect(panels.some((p) => p.type === 'tasks')).toBe(true);
      expect(panels.some((p) => p.type === 'agents')).toBe(true);
      expect(panels.some((p) => p.type === 'logs')).toBe(true);
    });
  });
});
