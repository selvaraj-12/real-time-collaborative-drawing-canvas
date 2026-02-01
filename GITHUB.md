# Add this app to your GitHub

Your repo is initialized and the first commit is done. You're connected to GitHub—use either method below.

---

## Option A: Cursor / VS Code (easiest)

1. Open **Source Control** (Ctrl+Shift+G or click the branch icon).
2. Click **"Publish to GitHub"** or **"Publish Branch"** (or the cloud icon with an arrow).
3. Choose **repo name** (e.g. `real-time-collaborative-drawing-canvas`) and **public**.
4. Confirm—Cursor will create the repo and push for you.

---

## Option B: Command line

## 1. Create a new repo on GitHub

1. Go to [github.com](https://github.com) and sign in.
2. Click **New** (or **+** → **New repository**).
3. Name it (e.g. `real-time-collaborative-drawing-canvas`).
4. Leave it empty (no README, .gitignore, or license).
5. Click **Create repository**.

## 2. Add your GitHub identity (if needed)

If you haven’t set Git identity yet:

```bash
git config --global user.name "YOUR_GITHUB_USERNAME"
git config --global user.email "your-email@example.com"
```

## 3. Add the remote and push

**Using the script (replace `YourGitHubUsername`):**

```powershell
cd "c:\Users\admin\VS Code\real-time-collaborative-drawing-canvas"
.\push-to-github.ps1 YourGitHubUsername
```

**Or manually:**

```powershell
git remote add origin https://github.com/YOUR_USERNAME/real-time-collaborative-drawing-canvas.git
git branch -M main
git push -u origin main
```

If GitHub asks for credentials, use a **Personal Access Token** as the password (Settings → Developer settings → Personal access tokens).
