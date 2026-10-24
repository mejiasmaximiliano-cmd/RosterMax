import Modal from './Modal';
export default function DiscardChanges({ guard, theme }) {
  if (!guard.open) return null;
  if (guard.waiting) return <Modal title="Guardado en curso" theme={theme} onClose={guard.keep}><p className="text-sm">La escritura ya comenzó y no se cancela cerrando el formulario. Esperá la confirmación o recuperá la conexión. Conservamos lo que escribiste.</p><button className="ux-button ux-secondary mt-4" onClick={guard.keep}>Volver al formulario</button></Modal>;
  return <Modal title="¿Descartar cambios sin guardar?" theme={theme} onClose={guard.keep}><p className="text-sm">Lo que escribiste en esta edición todavía no está guardado. Los registros que ya guardaste no se anulan.</p><div className="mt-4 flex flex-wrap gap-3"><button className="ux-button ux-secondary" onClick={guard.keep}>Seguir editando</button><button className="ux-button ux-danger" onClick={guard.discard}>Descartar edición</button></div></Modal>;
}
