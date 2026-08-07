const AUTH_MESSAGES = {
  'auth/credential-already-in-use': 'Esta cuenta ya existe. Pulsa “Ya tengo cuenta” para ingresar.',
  'auth/email-already-in-use': 'Esta cuenta ya existe. Pulsa “Ya tengo cuenta” para ingresar.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Habilita ventanas emergentes e inténtalo otra vez.',
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
  'auth/cancelled-popup-request': 'Ya hay una ventana de acceso abierta.',
  'auth/network-request-failed': 'No pudimos conectar con Google. Revisa tu conexión.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado para ingresar con Google.',
  'auth/user-disabled': 'Esta cuenta fue deshabilitada. Contacta al administrador.',
};

export function getAuthErrorMessage(error) {
  return AUTH_MESSAGES[error?.code] || 'No pudimos completar el acceso con Google.';
}
