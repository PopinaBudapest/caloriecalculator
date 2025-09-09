// Minimal observable store so UI can subscribe without tight coupling
export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  const get = () => state;
  const set = (next, reason="") => {
    state = typeof next === "function" ? next(state) : next;
    subs.forEach(fn => fn(state, reason));
  };
  const update = (patch, reason="") => set({ ...state, ...patch }, reason);
  const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
  return { get, set, update, subscribe };
}
