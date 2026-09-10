# Prepared CI workflow — inactive

`fitdatakit.yml` defines the web regression job and macOS FitDataKit test/build
job. It is deliberately outside `.github/workflows/`, so GitHub does not run it.

On 2026-09-10 UTC GitHub rejected the first branch push because the configured
Personal Access Token lacked `workflow` scope. The unpushed commit was amended
to retain this file as an inert review artifact. The local script ran all
checks; there is no GitHub Actions pass to infer from it.

After a credential with workflow-write permission is authorized, move the file
unchanged to `.github/workflows/fitdatakit.yml`, push it through a PR and verify
both jobs. The existing Vercel check remains required on main.
