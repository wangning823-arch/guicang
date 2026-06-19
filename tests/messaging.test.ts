import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageQueue } from '../src/messaging/queue.js';

describe('MessageQueue', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue({ maxRetries: 2, retryDelay: 10 });
  });

  describe('publish/subscribe', () => {
    it('should publish a message', () => {
      const msg = queue.publish('test-topic', { data: 'hello' });
      expect(msg.id).toBeDefined();
      expect(msg.topic).toBe('test-topic');
      expect(msg.status).toBe('pending');
    });

    it('should subscribe and receive message', async () => {
      const handler = vi.fn();
      queue.subscribe('test-topic', handler);

      queue.publish('test-topic', { data: 'hello' });

      // Wait for processing
      await new Promise((r) => setTimeout(r, 50));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple subscribers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      queue.subscribe('test-topic', handler1);
      queue.subscribe('test-topic', handler2);

      queue.publish('test-topic', { data: 'hello' });

      await new Promise((r) => setTimeout(r, 50));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe', async () => {
      const handler = vi.fn();
      queue.subscribe('test-topic', handler);
      queue.unsubscribe('test-topic', handler);

      queue.publish('test-topic', { data: 'hello' });

      await new Promise((r) => setTimeout(r, 50));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('message priority', () => {
    it('should process high priority first', async () => {
      const processed: string[] = [];

      queue.subscribe('topic', async (msg) => {
        processed.push(msg.priority);
      });

      queue.publish('topic', { order: 1 }, 'low');
      queue.publish('topic', { order: 2 }, 'high');
      queue.publish('topic', { order: 3 }, 'normal');

      await new Promise((r) => setTimeout(r, 100));

      expect(processed[0]).toBe('high');
    });

    it('should handle critical priority', async () => {
      const processed: string[] = [];

      queue.subscribe('topic', async (msg) => {
        processed.push(msg.priority);
      });

      queue.publish('topic', { order: 1 }, 'normal');
      queue.publish('topic', { order: 2 }, 'critical');

      await new Promise((r) => setTimeout(r, 50));

      expect(processed[0]).toBe('critical');
    });
  });

  describe('error handling', () => {
    it('should retry failed messages', async () => {
      let attempts = 0;
      queue.subscribe('topic', async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
      });

      queue.publish('topic', { data: 'test' });

      await new Promise((r) => setTimeout(r, 200));

      expect(attempts).toBe(2);
    });

    it('should fail after max retries', async () => {
      queue.subscribe('topic', async () => {
        throw new Error('Permanent failure');
      });

      const msg = queue.publish('topic', { data: 'test' });

      await new Promise((r) => setTimeout(r, 200));

      expect(msg.status).toBe('failed');
    });
  });

  describe('queue status', () => {
    it('should report pending messages', () => {
      queue.publish('topic', { data: 'test' });

      const status = queue.getQueueStatus('topic');
      expect(status.pending).toBe(1);
    });
  });

  describe('topics', () => {
    it('should list topics', () => {
      queue.publish('topic1', { data: 1 });
      queue.publish('topic2', { data: 2 });

      const topics = queue.getTopics();
      expect(topics).toContain('topic1');
      expect(topics).toContain('topic2');
    });
  });

  describe('stats', () => {
    it('should report stats', () => {
      queue.publish('topic1', { data: 1 });
      queue.publish('topic2', { data: 2 });

      const stats = queue.getStats();
      expect(stats.totalMessages).toBe(2);
      expect(stats.totalTopics).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear specific topic', () => {
      queue.publish('topic1', { data: 1 });
      queue.publish('topic2', { data: 2 });

      queue.clear('topic1');

      expect(queue.getTopics()).toContain('topic2');
      expect(queue.getTopics()).not.toContain('topic1');
    });

    it('should clear all topics', () => {
      queue.publish('topic1', { data: 1 });
      queue.publish('topic2', { data: 2 });

      queue.clear();

      expect(queue.getTopics().length).toBe(0);
    });
  });
});
