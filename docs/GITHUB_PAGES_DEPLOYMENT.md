# GitHub Pages Deployment

The repository can remain private while the published Pages site is public.
The workflow publishes only `dist/`; source files, tests, documentation, and
backups are not included in the Pages artifact.

## Setup

1. Create a private GitHub repository.
2. Add it as this folder's `origin` remote.
3. Push the `main` branch.
4. In repository settings, open **Pages** and choose **GitHub Actions** as the
   source.
5. Wait for the `Publish LayerLock` workflow to finish.

The project-site URL will be:

```text
https://ACCOUNT.github.io/REPOSITORY/
```

The public page is deliberately a static client-side app. Passwords, notes,
images, and generated containers must stay in the browser and must never be
committed to this repository.

Before each release, compare the published `dist/index.html` SHA-256 with the
locally verified file. GitHub Pages is a delivery channel, not the only backup
or a trust anchor for high-value secrets.
