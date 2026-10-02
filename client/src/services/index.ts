// The one place that decides whether the app talks to the Express API or the
// in-browser demo. Components import from here, never from ./api.js or
// ./demoApi.js directly. The choice is read on every call so tests can switch
// it with a stubbed environment variable.
import * as realApi from './api.js';
import * as demoApi from './demoApi.js';

export const isDemoMode = (): boolean => import.meta.env.VITE_DEMO_MODE === 'true';

const impl = () => (isDemoMode() ? demoApi : realApi);

export const fetchFlags: typeof realApi.fetchFlags = () => impl().fetchFlags();
export const fetchFlagByKey: typeof realApi.fetchFlagByKey = (key) => impl().fetchFlagByKey(key);
export const createFlag: typeof realApi.createFlag = (payload) => impl().createFlag(payload);
export const updateRollout: typeof realApi.updateRollout = (key, payload) => impl().updateRollout(key, payload);
export const toggleKillSwitch: typeof realApi.toggleKillSwitch = (key, env, active) =>
  impl().toggleKillSwitch(key, env, active);
export const evaluateFlag: typeof realApi.evaluateFlag = (key, env, context) => impl().evaluateFlag(key, env, context);
export const deleteFlag: typeof realApi.deleteFlag = (key) => impl().deleteFlag(key);

// Only meaningful in demo mode; the demo banner is the only caller.
export const resetDemoData = demoApi.resetDemoData;
