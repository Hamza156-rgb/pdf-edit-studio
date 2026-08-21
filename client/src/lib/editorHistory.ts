export function addHistorySnapshot<T>(history: T[], snapshot: T, limit = 50) {
  return [...history.slice(-(limit - 1)), snapshot];
}

export function undoHistory<T>(history: T[], current: T, future: T[], limit = 50) {
  const previous = history.at(-1);
  if (!previous) return null;
  return { current: previous, history: history.slice(0, -1), future: [current, ...future].slice(0, limit) };
}

export function redoHistory<T>(history: T[], current: T, future: T[], limit = 50) {
  const next = future[0];
  if (!next) return null;
  return { current: next, history: addHistorySnapshot(history, current, limit), future: future.slice(1) };
}
