export { AuthModule } from './auth.module';
export { AuthService } from './auth.service';
export {
  maskAuthSessionIpAddress,
  summarizeAuthSessionUserAgent,
} from './auth-session-metadata';
export {
  toAuthRefreshSessionResponse,
  toAuthUserResponse,
  toGoogleAuthAccountData,
  type AuthUserResponseSource,
} from './auth-response-mappers';
export {
  consumeGoogleOAuthFlow,
  generateOAuthSecret,
  getAllowedOAuthReturnOrigin,
  getAuthSessionMetadata,
  getGoogleLoginFailureRedirectUrl,
  getGoogleLoginSuccessRedirectUrl,
  getGoogleOAuthCookieOptions,
  getGoogleOAuthFlowCookieOptions,
  GOOGLE_OAUTH_COOKIE_MAX_AGE_MS,
  GOOGLE_OAUTH_FLOW_COOKIE,
  type GoogleOAuthFailureReason,
  type GoogleOAuthFlowConsumeResult,
} from './auth-google-oauth';
export {
  extractOptionalBearerAccessToken,
  extractRequiredBearerAccessToken,
} from './bearer-token';
export { CurrentUser } from './current-user.decorator';
export { JwtAuthGuard } from './jwt-auth.guard';
export type { AuthenticatedUser } from './auth.types';
