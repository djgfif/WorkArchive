# Security Policy

## Supported Branch

Security fixes are handled against `master` and the current release branch, when
a separate release branch exists.

## Reporting A Vulnerability

Do not open a public issue for a suspected vulnerability or leaked secret.
Report privately to the repository owner with:

- affected component or path;
- reproduction steps;
- impact assessment;
- whether a credential, token, database dump, log, or personal path is exposed.

The maintainer should acknowledge the report, rotate any affected secret before
public discussion, and publish remediation notes only after the exposure is no
longer exploitable.

## Public Repository Rules

- Real `.env` files, production secrets, provider keys, database dumps, logs,
  browser traces, backup archives, and local IDE/tool state must not be tracked.
- Example files may document variable names but must use placeholder values.
- Run `scripts/security/public-readiness-check.sh` before changing repository
  visibility or merging release branches.
- If a real secret was ever committed, rotate the secret first. Git history
  rewriting requires explicit approval because it changes published history.

## License Status

No open-source license has been granted. Visibility on GitHub does not grant
reuse, redistribution, or sublicensing rights.
