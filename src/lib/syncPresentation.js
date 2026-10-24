export function syncLabel({pending,cached,offline,error}={}) {
  return error ? 'Error de sincronización · revisá el aviso' : pending ? 'Guardado en este dispositivo · Pendiente de sincronizar' : cached || offline ? 'Guardado en este dispositivo · sin comprobación reciente' : 'Sincronizado';
}
