/**
 * Secret masking and safe value formatting utilities.
 * Guarantees that secret values are never printed in logs or terminal outputs.
 */

const SECRET_NAME_PATTERN = /(?:SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY|API_KEY|APP_SECRET|CLIENT_SECRET|ACCESS_TOKEN|REFRESH_TOKEN|AUTH_TOKEN|CREDENTIAL|PASSPHRASE)/i;

/**
 * Checks if a key name suggests sensitive content.
 * @param {string} key
 * @returns {boolean}
 */
export function isLikelySecret(key) {
  if (!key || typeof key !== 'string') return false;
  return SECRET_NAME_PATTERN.test(key);
}

/**
 * Masks a secret value with its length and a fixed mask.
 * E.g., "[SECRET len=16] ********"
 * @param {any} value
 * @returns {string}
 */
export function maskSecret(value) {
  if (value === undefined || value === null) {
    return '[SECRET len=0] ********';
  }
  const str = String(value);
  return `[SECRET len=${str.length}] ********`;
}

/**
 * Masks any value appropriately based on whether it is secret and whether public values are revealed.
 * Secret values are NEVER revealed even if showPublic is true.
 *
 * @param {any} value - The raw value
 * @param {boolean} isSecret - Whether this key is declared or inferred as secret
 * @param {boolean} [showPublic=false] - Whether non-secret values should be shown
 * @returns {string}
 */
export function maskValue(value, isSecret = false, showPublic = false) {
  if (isSecret) {
    return maskSecret(value);
  }
  if (value === undefined || value === null) {
    return '<empty>';
  }
  const str = String(value);
  if (showPublic) {
    return str;
  }
  return `*** (len=${str.length})`;
}
