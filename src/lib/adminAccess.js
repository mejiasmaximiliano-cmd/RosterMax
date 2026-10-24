/** An explicit inactive registry record revokes even a still-cached claim. */
export function canAdminister({ claim = false, registryReady = false, registryExists = false, active = false } = {}) {
  return registryReady && (registryExists ? active === true : claim === true);
}
