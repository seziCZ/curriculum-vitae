// Seeded random numbers (mulberry32) and a canvas context stub for tests.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Every method call is recorded as [name, ...args] in ctx.calls.
// fillText strings are also pushed to log. Property writes are stored as plain values.
export function canvasStub(log = []) {
  const calls = [];
  const store = {};
  const handler = {
    get(_, name) {
      if (name === 'calls') return calls;
      if (name === 'measureText') {
        return (s) => { calls.push(['measureText', s]); return { width: String(s).length * 7.5 }; };
      }
      if (name === 'fillText') {
        return (s, ...rest) => { calls.push(['fillText', s, ...rest]); log.push(s); };
      }
      if (name in store) return store[name];
      return (...args) => { calls.push([name, ...args]); };
    },
    set(_, name, value) { store[name] = value; return true; },
  };
  return new Proxy({}, handler);
}
