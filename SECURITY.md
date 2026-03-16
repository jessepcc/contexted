# Security Policy

## Reporting a vulnerability

Do not open public issues for security problems.

Preferred path:

1. Use GitHub's private vulnerability reporting for this repository if it is enabled.
2. If that option is unavailable, open a GitHub issue titled `Security contact requested` without technical details, and the maintainer will move the report to a private channel.

Include:

- affected area or file
- reproduction steps
- impact
- any proof-of-concept or logs, with secrets removed

## Scope

Please report issues involving:

- authentication or authorization
- storage or exposure of user memory text
- secret handling
- upload, queue, or worker execution paths
- dependency or deployment misconfiguration that could expose user data

## Expectations

- Avoid public disclosure until a fix or mitigation is in place.
- Redact tokens, private URLs, and personal data from reports.
- If the issue involves user memory content, share the minimum excerpt needed to reproduce it.
