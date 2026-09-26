# Security Policy

## Reporting a vulnerability

Please do not publish credentials, tokens, private Firebase configuration, database files, or exploitable security details in a public issue.

Report suspected vulnerabilities privately to the repository owner through GitHub. Include:

- affected component or endpoint
- reproducible steps
- expected versus actual behavior
- security impact
- suggested mitigation, if known

## Secret handling

Never commit:

- `.env` files
- JWT secrets
- Firebase service-account private keys
- Resend API keys
- production admin passwords
- database files

Use `backend/.env.example` as the configuration template.

## Production considerations

The current application uses SQLite. Before using it for a production workload, provide durable persistent storage or migrate the persistence layer to a managed database.

The repository's production seed requires explicit `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables and does not create the public development demo accounts.

## Dependency hygiene

Keep `backend/package-lock.json` committed and review dependency updates through the repository's normal CI workflow.
