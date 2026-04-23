import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { readExternalApiKeyEncryptionSecret } from '../../config/api-runtime-config';

export interface EncryptedExternalApiKey {
  encryptedKey: string;
  iv: string;
  authTag: string;
}

const ALGORITHM = 'aes-256-gcm';
const IV_BYTE_LENGTH = 12;

@Injectable()
export class ExternalApiKeyCryptoService {
  encrypt(rawKey: string): EncryptedExternalApiKey {
    const iv = randomBytes(IV_BYTE_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.readEncryptionKey(), iv);
    const encryptedKey = Buffer.concat([
      cipher.update(rawKey, 'utf8'),
      cipher.final(),
    ]);

    return {
      encryptedKey: encryptedKey.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(encrypted: EncryptedExternalApiKey) {
    const decipher = createDecipheriv(
      ALGORITHM,
      this.readEncryptionKey(),
      Buffer.from(encrypted.iv, 'base64'),
    );

    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.encryptedKey, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private readEncryptionKey() {
    return createHash('sha256')
      .update(readExternalApiKeyEncryptionSecret(), 'utf8')
      .digest();
  }
}
