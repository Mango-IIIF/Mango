import { describe, expect, it } from 'vitest';
import * as addAnnotation from '../addAnnotation';
import * as helloPanel from '../helloPanel';

const pluginModules = [helloPanel, addAnnotation];

describe('plugin contract', () => {
  for (const module of pluginModules) {
    it('exports createPlugin with init/destroy', () => {
      expect(typeof module.createPlugin).toBe('function');
      const plugin = module.createPlugin();
      expect(plugin.id).toBeTruthy();
      expect(typeof plugin.init).toBe('function');
      expect(typeof plugin.destroy).toBe('function');
    });
  }
});
