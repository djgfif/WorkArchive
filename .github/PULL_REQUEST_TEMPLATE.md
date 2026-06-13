## Summary

-

## Validation

- [ ] `scripts/security/public-readiness-check.sh`
- [ ] `npm run check:web-i18n`
- [ ] `npm run check:web-i18n-resources`
- [ ] `npm run check:web-i18n-packs`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test --workspaces --if-present`
- [ ] `npm run build`

## Security Checklist

- [ ] No real `.env` files or secrets are tracked
- [ ] No logs, traces, local databases, backup archives, or private screenshots are tracked
- [ ] Public docs do not expose machine-specific paths or private deployment details
