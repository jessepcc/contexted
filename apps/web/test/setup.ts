const vitestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

vitestGlobal.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Node 22.4+ defines its own experimental `localStorage`/`sessionStorage` globals whose
 * getters return undefined unless the process is started with --localstorage-file. Those
 * own accessors sit on globalThis ahead of anything vitest's jsdom environment installs,
 * so web storage reads as undefined and every helper that touches it throws. CI pins Node
 * 20, which has no such globals, so the suite is green there and red on a newer local Node
 * — drift that makes the tests look broken on one machine and fine on another.
 *
 * jsdom's own Storage object is unreachable here (in the vitest jsdom environment the
 * window IS globalThis, and document.defaultView points back at it), so rather than try to
 * recover it, install a minimal spec-shaped Storage. Tests only need string round-tripping
 * plus clear(), which is exactly what the Storage contract guarantees.
 */
function createStorage(): Storage {
  let entries = new Map<string, string>();

  return {
    get length(): number {
      return entries.size;
    },
    key(index: number): string | null {
      return [...entries.keys()][index] ?? null;
    },
    getItem(key: string): string | null {
      return entries.get(String(key)) ?? null;
    },
    setItem(key: string, value: string): void {
      entries.set(String(key), String(value));
    },
    removeItem(key: string): void {
      entries.delete(String(key));
    },
    clear(): void {
      entries = new Map();
    },
  } satisfies Storage;
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (typeof vitestGlobal[name] === 'undefined') {
    Object.defineProperty(globalThis, name, {
      value: createStorage(),
      configurable: true,
      writable: true,
    });
  }
}
