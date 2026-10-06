import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/aes.js';

function b64toU8(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

window.nobleDecrypt = function nobleDecrypt(password, encData) {
  try {
    const salt = b64toU8(encData.salt);
    const iv   = b64toU8(encData.iv);
    const tag  = b64toU8(encData.tag);
    const data = b64toU8(encData.data);

    const combined = new Uint8Array(data.length + tag.length);
    combined.set(data);
    combined.set(tag, data.length);

    const normalised = password.trim().toLowerCase();
    const key = pbkdf2(sha256, normalised, salt, { c: encData.iter, dkLen: 32 });
    const aesGcm = gcm(key, iv);
    const decrypted = aesGcm.decrypt(combined);
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.warn('Fallback nobleDecrypt failed:', err);
    return null;
  }
};
