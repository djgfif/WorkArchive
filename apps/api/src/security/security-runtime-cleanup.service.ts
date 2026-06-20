import {
  Injectable,
  type OnApplicationShutdown,
} from '@nestjs/common';

import { shutdownRedisRateLimitClients } from './security-middleware';

@Injectable()
export class SecurityRuntimeCleanupService implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await shutdownRedisRateLimitClients();
  }
}
