import { Component } from 'react';

export default class SectionBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-3">
      <h2 className="font-bold">No pudimos abrir esta sección</h2>
      <p className="text-sm">Puede haber fallado la descarga o la conexión. No borres los datos de la app. Puedes volver al calendario y reintentar con conexión.</p>
      <button type="button" onClick={this.props.onHome} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">Volver a Roster</button>
      <p className="text-xs">Antes de recargar, confirma que no quedan escrituras pendientes.</p>
      <button type="button" disabled={this.props.pending} onClick={() => window.location.reload()} className="min-h-11 rounded-xl border border-blue-500/40 px-4 text-sm font-semibold disabled:opacity-50">{this.props.pending ? 'Primero sincroniza tus cambios' : 'Recargar para volver a intentar'}</button>
    </section>;
  }
}
