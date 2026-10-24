import test from 'node:test';
import assert from 'node:assert/strict';
import { canAdminister } from '../src/lib/adminAccess.js';
test('registro protegido y claims no se basan en correo y una revocación explícita prevalece', () => {
  assert.equal(canAdminister({ claim: true }), false);
  assert.equal(canAdminister({ registryReady: true, registryExists: true, active: true }), true);
  assert.equal(canAdminister({ claim: true, registryReady: true, registryExists: true, active: false }), false);
  assert.equal(canAdminister({ claim: true, registryReady: true, registryExists: false }), true);
  assert.equal(canAdminister({ registryReady: true }), false);
});
