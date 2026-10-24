export async function fetchNetworkVersion(fetchImpl = fetch, { environment = 'production', timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const response = await fetchImpl(`/api/version?check=${nonce}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }, signal: controller.signal });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json') || Number(response.headers.get('age') || 0) > 0) throw new Error('No se recibió un manifiesto actual de red.');
    const data = await response.json();
    if (!/^[a-f0-9]{40}$/.test(data.commit || '') || !/^[a-f0-9]{20}$/.test(data.build || '') || typeof data.version !== 'string' || !data.version || data.environment !== environment || data.checkedNonce !== nonce || !Number.isFinite(Date.parse(data.checkedAt))) throw new Error('La respuesta de versiones no es válida o no confirma esta solicitud de red.');
    return data;
  } finally { clearTimeout(timeout); }
}

export function readWorkerBuild(worker) {
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const done = (value) => { clearTimeout(timer); channel.port1.close(); channel.port2.close(); resolve(value); };
    const timer = setTimeout(() => done(null), 1000);
    channel.port1.onmessage = (event) => done(event.data?.type === 'ROSTERMAX_VERSION' ? event.data.build : null);
    try { worker.postMessage({ type: 'GET_ROSTERMAX_VERSION' }, [channel.port2]); } catch { done(null); }
  });
}

/** Explicit network result + real worker lifecycle. Never activates/reloads. */
export function createUpdateChecker({ loadedCommit, getRegistration, fetchVersion, workerBuild = readWorkerBuild, onState, now = () => new Date() }) {
  let registration, manifest, checkedAt, disposed = false, busy = false, verified = false, generation = 0;
  const workers = new Set();
  const emit = (status, detail = '') => { if (!disposed) onState({ status, detail, checkedAt, manifest }); };
  const inspect = async () => {
    if (!manifest || !verified || disposed) return;
    const version = generation;
    if (registration?.installing) { emit('downloading'); return; }
    if (registration?.waiting) {
      const build = await workerBuild(registration.waiting);
      if (version !== generation || disposed) return;
      emit(build === manifest.build ? 'ready' : 'error', build === manifest.build ? '' : 'Hay una versión en espera, pero no pudimos confirmar que sea la versión pública comprobada. Volvé a comprobar con conexión.'); return;
    }
    if (manifest.commit === loadedCommit) { emit('latest', registration ? 'Versión abierta comprobada por red.' : 'Versión abierta comprobada por red. Este navegador no tiene un worker registrado.'); return; }
    const build = await workerBuild(registration?.active);
    if (version !== generation || disposed) return;
    emit(build === manifest.build ? 'ready' : 'available', build === manifest.build ? '' : 'La versión pública es más nueva que esta ventana. Todavía no hay una descarga completa confirmada. Volvé a comprobar o reabrí con conexión después de sincronizar.');
  };
  const watch = () => {
    for (const worker of [registration?.installing, registration?.waiting]) if (worker && !workers.has(worker)) {
      workers.add(worker); worker.addEventListener('statechange', changed);
    }
  };
  const changed = (event) => { watch(); if (event?.target?.state === 'redundant') { verified = false; generation++; emit('error', 'La descarga no se completó. Conservamos la versión anterior; volvé a comprobar con conexión.'); } else void inspect(); };
  const found = () => { watch(); if (verified) emit('downloading'); };
  const check = async () => {
    if (busy || disposed) return;
    busy = true; verified = false; generation++; emit('checking');
    try {
      manifest = await fetchVersion(); checkedAt = manifest.checkedAt ? new Date(manifest.checkedAt) : now(); verified = true;
      const next = await getRegistration();
      if (disposed) return;
      if (next !== registration) { registration?.removeEventListener('updatefound', found); registration = next; registration?.addEventListener('updatefound', found); }
      watch();
      if (registration) await registration.update();
      await inspect();
    } catch { verified = false; generation++; emit('error', 'No pudimos comprobar la versión o completar su descarga. Revisá tu conexión. Conservamos la versión actual y tus datos; no damos la app por actualizada.'); }
    finally { busy = false; }
  };
  return { check, dispose() { disposed = true; generation++; registration?.removeEventListener('updatefound', found); for (const worker of workers) worker.removeEventListener('statechange', changed); } };
}
