export function mockFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const { ok = true, status = 200, body = {} } = await handler(String(url));
    return { ok, status, json: async () => body };
  };
  return () => {
    globalThis.fetch = original;
  };
}

export function silenceConsole() {
  const originals = { log: console.log, error: console.error };
  console.log = () => {};
  console.error = () => {};
  return () => Object.assign(console, originals);
}
