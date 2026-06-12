import {
  Inject,
  Injectable,
  type ExecutionContext,
} from '@nestjs/common';
import type { CanActivate } from '@nestjs/common';

import { AuthService } from './auth.service';
import { extractRequiredBearerAccessToken } from './bearer-token';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: {
        authorization?: string;
      };
      user?: Awaited<ReturnType<AuthService['validateAccessToken']>>;
    }>();
    const accessToken = extractRequiredBearerAccessToken(
      request.headers.authorization,
    );

    request.user = await this.authService.validateAccessToken(accessToken);

    return true;
  }
}
