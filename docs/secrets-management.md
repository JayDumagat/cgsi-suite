# Local secret management with OpenBao

Compose includes OpenBao as an optional, persistent local service. It binds only to host loopback, stores its encrypted data in the `cgsi_openbao_data` volume, and starts **sealed**. It is not started with the default application stack.

## Start and initialize it

```powershell
docker compose --profile secrets up -d openbao
docker compose exec -it openbao bao operator init -key-shares=5 -key-threshold=3
```

Initialization prints recovery material and an initial root token once. Record the key shares separately and securely; do not paste them into `.env`, commit them, or send them to logs. Unseal the server by providing three different shares. Repeat after a server restart when using this local file-storage configuration:

```powershell
docker compose exec -it openbao bao operator unseal
```

Run that command three times, supplying a different share each time. Then log in interactively with the initial token and create scoped operator/machine policies. Do not give application containers the initial root token.

## Enable the engines

After unsealing and logging in as an operator, enable the database and Transit engines:

```powershell
docker compose exec -it openbao bao secrets enable database
docker compose exec -it openbao bao secrets enable transit
docker compose exec -it openbao bao write -f transit/keys/cgsi-directory
```

Rotate the Transit key to create a new version:

```powershell
docker compose exec -it openbao bao write -f transit/keys/cgsi-directory/rotate
```

Transit keeps prior key versions available for decrypting their ciphertext; rewrap existing ciphertext before retiring an old version. This key does not rotate the Express cookie `SESSION_SECRET` or replace the identity service's PostgreSQL password. Those consumers need explicit key-overlap/reload logic before their credentials can be moved to managed rotation.

The PostgreSQL database engine should be configured with a dedicated OpenBao database-control account and separate service roles after database grants are finalized. Do not hand OpenBao the shared `cgsi_admin` login and do not have it rotate the only human recovery account. The current application containers still read credentials from Compose environment variables; scoped OpenBao authentication, renewable leases, file/API delivery, and pool reload are the next secrets integration step.

## Operating boundary

This Compose profile is for local development only. It uses a single-node filesystem backend and a local HTTP listener published to `127.0.0.1`. OpenBao documents the filesystem backend as single-node and not production-recommended; production needs a supported HA storage backend, TLS, restricted network access, audit delivery, backup/recovery, and an auto-unseal plan appropriate to the hosting environment. See the official [filesystem backend](https://openbao.org/docs/configuration/storage/filesystem/), [secrets database engine](https://openbao.org/docs/secrets/databases/), [Transit engine](https://openbao.org/docs/secrets/transit/), and [seal/unseal concepts](https://openbao.org/docs/concepts/seal/).
