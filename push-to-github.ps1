# Add this project to your GitHub and push.
# Usage: .\push-to-github.ps1 YourGitHubUsername
# Or:    .\push-to-github.ps1 YourGitHubUsername YourRepoName

param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Username,
  [Parameter(Mandatory = $false, Position = 1)]
  [string]$RepoName = "real-time-collaborative-drawing-canvas"
)

$repoPath = $PSScriptRoot
Set-Location $repoPath

$remoteUrl = "https://github.com/$Username/$RepoName.git"

# Remove existing origin if any
git remote remove origin 2>$null

# Add your repo as origin
git remote add origin $remoteUrl

# Use main branch and push
git branch -M main
Write-Host "Pushing to $remoteUrl ..." -ForegroundColor Cyan
git push -u origin main

if ($LASTEXITCODE -eq 0) {
  Write-Host "Done! Your app is at: https://github.com/$Username/$RepoName" -ForegroundColor Green
} else {
  Write-Host "Push failed. Make sure:" -ForegroundColor Yellow
  Write-Host "  1. Repo exists: https://github.com/new (name: $RepoName)" -ForegroundColor Yellow
  Write-Host "  2. You're signed in (Git Credential Manager or Personal Access Token)" -ForegroundColor Yellow
}
