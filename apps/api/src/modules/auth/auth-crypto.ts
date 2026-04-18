import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';

const HASH_SEPARATOR = ':';
const SCRYPT_KEY_LENGTH = 64;

function scrypt(secret: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(secret, salt, SCRYPT_KEY_LENGTH, (error, derivedKey) => {
      if (error) {
        reject(error);

        return;
      }

      resolve(derivedKey as Buffer);
    });
  });
}

export async function hashSecret(secret: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(secret, salt);

  return `${salt}${HASH_SEPARATOR}${derivedKey.toString('hex')}`;
}

export async function verifySecret(secret: string, storedHash: string) {
  const [salt, expectedHash] = storedHash.split(HASH_SEPARATOR);

  if (!salt || !expectedHash) {
    return false;
  }

  const derivedKey = await scrypt(secret, salt);
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  if (expectedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, derivedKey);
}
