export { AuthModule } from './auth.module';
export { AuthService } from './auth.service';
export {
  maskAuthSessionIpAddress,
  summarizeAuthSessionUserAgent,
} from './auth-session-metadata';
export {
  extractOptionalBearerAccessToken,
  extractRequiredBearerAccessToken,
} from './bearer-token';
export { CurrentUser } from './current-user.decorator';
export { JwtAuthGuard } from './jwt-auth.guard';
export type { AuthenticatedUser } from './auth.types';
