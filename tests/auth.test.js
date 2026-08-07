import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthErrorMessage } from '../src/lib/auth.js';

test('explica cuándo una cuenta existente debe iniciar sesión', () => {
  assert.match(getAuthErrorMessage({ code: 'auth/credential-already-in-use' }), /Ya tengo cuenta/);
});

test('muestra un mensaje útil para dominios no autorizados', () => {
  assert.match(getAuthErrorMessage({ code: 'auth/unauthorized-domain' }), /dominio/);
});
