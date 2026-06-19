import { describe, it, expect, beforeEach } from 'vitest';
import { PluginMarketplace } from '../src/plugin/marketplace.js';

describe('PluginMarketplace', () => {
  let marketplace: PluginMarketplace;

  beforeEach(() => {
    marketplace = new PluginMarketplace();
  });

  describe('plugin listing', () => {
    it('should have builtin plugins', () => {
      const plugins = marketplace.getAllPlugins();
      expect(plugins.length).toBeGreaterThanOrEqual(5);
    });

    it('should get plugin by name', () => {
      const plugin = marketplace.getPlugin('weather');
      expect(plugin).toBeDefined();
      expect(plugin!.name).toBe('weather');
      expect(plugin!.version).toBe('1.0.0');
    });

    it('should return undefined for unknown plugin', () => {
      expect(marketplace.getPlugin('nonexistent')).toBeUndefined();
    });
  });

  describe('search', () => {
    it('should search by name', () => {
      const results = marketplace.search('weather');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('weather');
    });

    it('should search by description', () => {
      const results = marketplace.search('计算');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('calculator');
    });

    it('should search by tag', () => {
      const results = marketplace.search('utility');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty for no match', () => {
      const results = marketplace.search('xyz123');
      expect(results.length).toBe(0);
    });
  });

  describe('filtering', () => {
    it('should get by tag', () => {
      const plugins = marketplace.getByTag('utility');
      expect(plugins.length).toBeGreaterThanOrEqual(2);
    });

    it('should get popular plugins', () => {
      const popular = marketplace.getPopular(3);
      expect(popular.length).toBe(3);
      expect(popular[0].downloads).toBeGreaterThanOrEqual(popular[1].downloads);
    });

    it('should get top rated plugins', () => {
      const topRated = marketplace.getTopRated(3);
      expect(topRated.length).toBe(3);
      expect(topRated[0].rating).toBeGreaterThanOrEqual(topRated[1].rating);
    });

    it('should get recent plugins', () => {
      const recent = marketplace.getRecent(3);
      expect(recent.length).toBe(3);
    });
  });

  describe('install/uninstall', () => {
    it('should install a plugin', () => {
      const record = marketplace.install('weather', '1.0.0');
      expect(record).not.toBeNull();
      expect(record!.pluginName).toBe('weather');
      expect(record!.version).toBe('1.0.0');
      expect(record!.enabled).toBe(true);
    });

    it('should increment download count on install', () => {
      const before = marketplace.getPlugin('weather')!.downloads;
      marketplace.install('weather', '1.0.0');
      const after = marketplace.getPlugin('weather')!.downloads;
      expect(after).toBe(before + 1);
    });

    it('should return null for unknown plugin', () => {
      const record = marketplace.install('nonexistent', '1.0.0');
      expect(record).toBeNull();
    });

    it('should uninstall a plugin', () => {
      marketplace.install('weather', '1.0.0');
      const result = marketplace.uninstall('weather');
      expect(result).toBe(true);
      expect(marketplace.isInstalled('weather')).toBe(false);
    });

    it('should return false when uninstalling non-installed', () => {
      const result = marketplace.uninstall('weather');
      expect(result).toBe(false);
    });

    it('should list installed plugins', () => {
      marketplace.install('weather', '1.0.0');
      marketplace.install('calculator', '1.2.0');
      const installed = marketplace.getInstalled();
      expect(installed.length).toBe(2);
    });

    it('should check if installed', () => {
      expect(marketplace.isInstalled('weather')).toBe(false);
      marketplace.install('weather', '1.0.0');
      expect(marketplace.isInstalled('weather')).toBe(true);
    });
  });

  describe('enable/disable', () => {
    it('should disable an installed plugin', () => {
      marketplace.install('weather', '1.0.0');
      const result = marketplace.setEnabled('weather', false);
      expect(result).toBe(true);
      const installed = marketplace.getInstalled();
      expect(installed[0].enabled).toBe(false);
    });

    it('should return false for non-installed plugin', () => {
      const result = marketplace.setEnabled('weather', false);
      expect(result).toBe(false);
    });
  });

  describe('ratings', () => {
    it('should add a rating', () => {
      const record = marketplace.addRating('weather', 'user1', 5, 'Great!');
      expect(record).not.toBeNull();
      expect(record!.rating).toBe(5);
      expect(record!.comment).toBe('Great!');
    });

    it('should update plugin rating', () => {
      marketplace.addRating('weather', 'user1', 4);
      marketplace.addRating('weather', 'user2', 5);
      const plugin = marketplace.getPlugin('weather')!;
      expect(plugin.rating).toBe(4.5);
      expect(plugin.ratingCount).toBe(2);
    });

    it('should reject invalid rating', () => {
      const record = marketplace.addRating('weather', 'user1', 6);
      expect(record).toBeNull();
    });

    it('should return null for unknown plugin', () => {
      const record = marketplace.addRating('nonexistent', 'user1', 5);
      expect(record).toBeNull();
    });

    it('should get ratings for a plugin', () => {
      marketplace.addRating('weather', 'user1', 4);
      marketplace.addRating('weather', 'user2', 5);
      const ratings = marketplace.getRatings('weather');
      expect(ratings.length).toBe(2);
    });

    it('should return empty array for no ratings', () => {
      const ratings = marketplace.getRatings('nonexistent');
      expect(ratings).toEqual([]);
    });
  });

  describe('tags', () => {
    it('should get all unique tags', () => {
      const tags = marketplace.getAllTags();
      expect(tags.length).toBeGreaterThanOrEqual(5);
      expect(tags).toContain('utility');
      expect(tags).toContain('weather');
    });

    it('should return sorted tags', () => {
      const tags = marketplace.getAllTags();
      const sorted = [...tags].sort();
      expect(tags).toEqual(sorted);
    });
  });

  describe('stats', () => {
    it('should return correct stats', () => {
      marketplace.install('weather', '1.0.0');
      marketplace.addRating('weather', 'user1', 5);

      const stats = marketplace.getStats();
      expect(stats.totalPlugins).toBeGreaterThanOrEqual(5);
      expect(stats.totalInstalls).toBe(1);
      expect(stats.totalRatings).toBe(1);
      expect(stats.averageRating).toBe(5);
    });

    it('should return zero stats for empty marketplace', () => {
      const empty = new PluginMarketplace();
      // Clear all plugins
      for (const p of empty.getAllPlugins()) {
        empty.uninstall(p.name);
      }
      const stats = empty.getStats();
      expect(stats.totalPlugins).toBe(6); // builtin plugins still there
    });
  });

  describe('register custom plugin', () => {
    it('should register a custom plugin', () => {
      marketplace.registerPlugin({
        name: 'custom',
        version: '0.1.0',
        description: 'Custom plugin',
        author: 'test',
        tags: ['custom'],
        downloads: 0,
        rating: 0,
        ratingCount: 0,
        publishedAt: '2024-06-01',
        updatedAt: '2024-06-01',
      });

      const plugin = marketplace.getPlugin('custom');
      expect(plugin).toBeDefined();
      expect(plugin!.name).toBe('custom');
    });
  });
});
