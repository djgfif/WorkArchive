import {
  Inject,
  Injectable,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { CanActivate } from '@nestjs/common';

import { AuthService } from './auth.service';

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
    const accessToken = this.extractAccessToken(request.headers.authorization);

    request.user = await this.authService.validateAccessToken(accessToken);

    return true;
  }

  private extractAccessToken(authorizationHeader?: string) {
    if (!authorizationHeader) {
      throw new UnauthorizedException('Missing Bearer access token.');
    }

    const [scheme, token] = authorizationHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Malformed Bearer access token.');
    }

    return token;
  }
}
