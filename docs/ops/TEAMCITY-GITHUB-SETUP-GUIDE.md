# Concise TeamCity Setup Guide (GitHub to IIS Monorepo)

This guide provides step-by-step instructions to set up **TeamCity** from scratch for the `c013-kiosk-queue-display-web` monorepo using a GitHub repository as the VCS root.

---

## Prerequisites

- TeamCity Server and Agent installed (Windows Agent).
- GitHub Repository URL (e.g., `https://github.com/your-org/c013-kiosk-queue-display-web.git`).
- GitHub Personal Access Token (PAT) with `repo` scope, or an SSH Deploy Key.

---

## Step 1: Create the TeamCity Project

1. Open TeamCity UI → Click **Projects** → **Create Project**.
2. Select **From a repository URL**.
3. Enter Repository URL: `https://github.com/your-org/c013-kiosk-queue-display-web.git`
4. Enter Authentication details (Username / PAT or SSH Key).
5. Click **Proceed**. TeamCity will auto-detect the repo.
6. Set **Project Name**: `C013 Kiosk & Queue Display Web`.

---

## Step 2: Configure the GitHub VCS Root

1. Go to **Project Settings** → **VCS Roots** → Edit or Create VCS Root:
   - **VCS type**: Git
   - **VCS root name**: `c013-monorepo-github`
   - **Fetch URL**: `https://github.com/your-org/c013-kiosk-queue-display-web.git`
   - **Default branch**: `refs/heads/main`
   - **Branch specification** (optional for PR/branch builds):
     ```text
     +:refs/heads/*
     ```
   - **Authentication method**: `Password / Access Token`
2. Click **Test Connection** → Verify green status → Click **Save**.

---

## Step 3: Create Build Config #1 — Shared Verification (Gatekeeper)

This build configuration runs `typecheck` and `test` across all workspace packages and apps.

1. In Project Settings, click **Create build configuration**.
   - **Name**: `00 - Shared Verification`
   - **Build Configuration ID**: `SharedVerificationBuild`
2. Select VCS Root: `c013-monorepo-github`.
3. Go to **Build Steps** → **Add build step**:
   - **Runner type**: `PowerShell`
   - **Step name**: `Install & Verify Monorepo`
   - **Script**: `Source code`
   - **Script content**:
     ```powershell
     # 1. Setup pnpm in user-space
     npm config set prefix "$env:APPDATA\npm"
     $env:PATH = "$env:APPDATA\npm;$env:PATH"
     npm install -g pnpm@10.14.0

     # 2. Add local node_modules\.bin to PATH so Windows finds 'turbo.cmd'
     $env:PATH = "$PWD\node_modules\.bin;$env:PATH"

     # 3. Install dependencies
     pnpm install --frozen-lockfile

     # 4. Run typecheck and tests (omit 'lint' as lint scripts are noop)
     pnpm turbo run typecheck test
     ```
4. Click **Save**.

---

## Step 4: Create App Deployment Build Configs

Repeat this step for each of the 3 applications (`kiosk-web`, `display-web`, `config-web`).

### Mapping Reference:
| App Name | Package Filter | IIS Folder | Vite `base` | `$AppName` |
|---|---|---|---|---|
| **Kiosk Web** | `kiosk-web` | `wwwroot/kiosk` | `/kiosk/` | `kiosk` |
| **Display Web** | `display-web` | `wwwroot/display` | `/display/` | `display` |
| **Config Web** | `config-web` | `wwwroot/queue-config` | `/queue-config/` | `queue-config` |

---

### Example Setup for Kiosk Web:

#### A. Create Build Configuration
1. Click **Create build configuration**:
   - **Name**: `01 - Kiosk Web Build & Deploy`
   - **ID**: `KioskWebBuild`
2. Select VCS Root: `c013-monorepo-github`.

#### B. Add Snapshot Dependency (Ensures Verification Passes First)
1. Go to **Dependencies** → **Add new snapshot dependency**.
2. Select **Depend on**: `00 - Shared Verification`.
3. Check options:
   - `Do not run build if dependency failed`
   - `Run build on the same revision`
4. Click **Save**.

#### C. Add Environment Variables (Vite Env Injection)
1. Go to **Parameters** → **Add new parameter**:
   - **Name**: `env.VITE_BILREG_API_BASE` | **Type**: `Environment variable (env.)` | **Value**: `http://<api-host>/api`

> [!NOTE]
> `VITE_BILREG_API_BASE` is the **only** build-time environment variable required. `VITE_BILREG_TOKEN` is obsolete (kiosk and display endpoints are public/unauthenticated, while `config-web` uses interactive session auth).

#### D. Add VCS Trigger (Path Filtering)
1. Go to **Triggers** → **Add new trigger** → **VCS Trigger**.
2. Under **Trigger rules**, paste:
   ```text
   +:apps/kiosk-web/**
   +:packages/**
   +:package.json
   +:pnpm-lock.yaml
   +:turbo.json
   +:tsconfig.base.json
   +:.prettierrc.json
   +:.prettierignore
   ```
   *(For `display-web`, replace `apps/kiosk-web/**` with `apps/display-web/**`)*  
   *(For `config-web`, replace `apps/kiosk-web/**` with `apps/config-web/**`)*

#### E. Add Build & Deployment Steps

##### Step 1: Build Kiosk Web (PowerShell Runner)
- **Runner**: `PowerShell`
- **Step name**: `Build Kiosk App`
- **Script content**:
  ```powershell
  npm config set prefix "$env:APPDATA\npm"
  $env:PATH = "$env:APPDATA\npm;$env:PATH"
  npm install -g pnpm@10.14.0
  $env:PATH = "$PWD\node_modules\.bin;$env:PATH"

  pnpm install --frozen-lockfile
  pnpm turbo run build --filter=kiosk-web
  ```

##### Step 2: Publish Artifacts
- Go to **General Settings** → **Artifact paths**:
  ```text
  apps/kiosk-web/dist/** => kiosk-build-%build.number%.zip
  ```

##### Step 3: IIS Cutover Deployment (PowerShell Runner)
- **Runner**: `PowerShell`
- **Step name**: `Deploy to IIS`
- **Script content**:
  ```powershell
  Param(
      [string]$AppRoot = "C:\inetpub\wwwroot",
      [string]$AppName = "kiosk",
      [string]$SourceZip = "%teamcity.build.checkoutDir%\kiosk-build-%build.number%.zip"
  )

  $TargetDir = Join-Path $AppRoot $AppName
  $BackupDir = Join-Path $AppRoot "backups\$AppName"
  $Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $BackupZip = Join-Path $BackupDir "$AppName`_$Timestamp.zip"

  if (!(Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force }
  if (!(Test-Path $TargetDir)) { New-Item -ItemType Directory -Path $TargetDir -Force }

  if ((Get-ChildItem $TargetDir).Count -gt 0) {
      Compress-Archive -Path "$TargetDir\*" -DestinationPath $BackupZip -Force
  }

  Get-ChildItem -Path $TargetDir -Recurse | Where-Object { $_.Name -ne "web.config" } | Remove-Item -Recurse -Force
  Expand-Archive -Path $SourceZip -DestinationPath $TargetDir -Force

  Write-Host "Deployed $AppName successfully to $TargetDir!"
  ```

---

## Step 5: Verification Checklist

1. Push a test commit to `apps/kiosk-web/src/App.vue`.
2. Observe TeamCity UI:
   - `01 - Kiosk Web Build & Deploy` triggers automatically.
   - `00 - Shared Verification` is scheduled first via Snapshot Dependency.
   - `Shared Verification` passes → `Kiosk Web Build & Deploy` executes.
   - Assets deploy to `C:\inetpub\wwwroot\kiosk`.
3. Open `http://<iis-host>/kiosk/loket-01` in browser and confirm app loads.
