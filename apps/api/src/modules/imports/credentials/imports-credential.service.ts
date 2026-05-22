import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import {
  ExternalApiKeyCryptoService,
  type EncryptedExternalApiKey,
} from './external-api-key-crypto.service';
import type { ImportProvider } from '../imports.constants';

@Injectable()
export class ImportsCredentialService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ExternalApiKeyCryptoService)
    private readonly cryptoService: ExternalApiKeyCryptoService,
  ) {}

  async hasCredential(userId: string, provider: ImportProvider) {
    const credential = await this.prisma.externalApiCredential.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      select: {
        id: true,
      },
    });

    return credential !== null;
  }

  async saveCredential(
    userId: string,
    provider: ImportProvider,
    rawKey: string,
  ) {
    const encrypted = this.cryptoService.encrypt(rawKey);

    await this.prisma.externalApiCredential.upsert({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      create: {
        userId,
        provider,
        ...encrypted,
      },
      update: encrypted,
    });
  }

  async deleteCredential(userId: string, provider: ImportProvider) {
    await this.prisma.externalApiCredential.deleteMany({
      where: {
        userId,
        provider,
      },
    });
  }

  async getDecryptedCredential(userId: string, provider: ImportProvider) {
    const credential = await this.prisma.externalApiCredential.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      select: {
        encryptedKey: true,
        iv: true,
        authTag: true,
      },
    });

    if (!credential) {
      return null;
    }

    return this.cryptoService.decrypt(credential as EncryptedExternalApiKey);
  }
}
