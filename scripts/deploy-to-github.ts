import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

function getSecretToken(): string {
  // 1. Check CLI argument --token=... or positional arg
  const tokenArg = process.argv.find((arg) => arg.startsWith('--token='))
  if (tokenArg) return tokenArg.replace('--token=', '').trim()

  // 2. Check process.env.GITHUB_TOKEN
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim()

  // 3. Check .github_token file
  try {
    const tokenPath = path.resolve(process.cwd(), '.github_token')
    if (fs.existsSync(tokenPath)) {
      return fs.readFileSync(tokenPath, 'utf-8').trim()
    }
  } catch {}

  // 4. Check .env file
  try {
    const envPath = path.resolve(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8')
      const match = content.match(/GITHUB_TOKEN=["']?([^"'\r\n]+)["']?/)
      if (match && match[1]) return match[1].trim()
    }
  } catch {}

  return ''
}

function run(cmd: string, maskSecret = ''): string {
  const displayCmd = maskSecret ? cmd.replaceAll(maskSecret, '***TOKEN***') : cmd
  console.log(`\x1b[36m▶ ${displayCmd}\x1b[0m`)
  try {
    const out = execSync(cmd, {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    })
    return out.trim()
  } catch (err: any) {
    const stderr = err.stderr ? err.stderr.toString() : ''
    const stdout = err.stdout ? err.stdout.toString() : ''
    const msg = stderr || stdout || err.message
    const safeMsg = maskSecret ? msg.replaceAll(maskSecret, '***TOKEN***') : msg
    throw new Error(`Command failed: ${displayCmd}\n${safeMsg}`)
  }
}

export async function deployToGithub() {
  console.log('\n\x1b[1m\x1b[35m=== RyzenDesk GitHub Deployment Script ===\x1b[0m\n')

  const token = getSecretToken()
  const repo = process.env.GITHUB_REPO || 'romangalaxys10-spec/RyzenDesk'
  const branch = process.env.GITHUB_BRANCH || 'main'

  if (!token) {
    console.error('\x1b[31m✖ Error: GITHUB_TOKEN is required to push to GitHub.\x1b[0m')
    console.error('Please provide it via:')
    console.error('  - GITHUB_TOKEN environment variable (e.g. GITHUB_TOKEN=ghp_... npm run deploy)')
    console.error('  - .github_token file in project root')
    console.error('  - CLI argument: npm run deploy -- --token=ghp_...\n')
    process.exit(1)
  }

  console.log(`Target Repository : \x1b[33m${repo}\x1b[0m`)
  console.log(`Target Branch     : \x1b[33m${branch}\x1b[0m`)
  console.log(`Auth Status       : \x1b[32mToken loaded (${token.slice(0, 4)}...${token.slice(-4)})\x1b[0m\n`)

  const remoteUrl = `https://x-access-token:${token}@github.com/${repo}.git`

  try {
    // 1. Initialize git if not present
    if (!fs.existsSync(path.resolve(process.cwd(), '.git'))) {
      console.log('Initializing local git repository...')
      run(`git init -b ${branch}`)
    }

    // 2. Configure Git User for Deployment
    run('git config user.name "RyzenDesk Deployer"')
    run('git config user.email "deploy@ryzendesk.internal"')

    // 3. Configure Remote URL
    let remotes = ''
    try {
      remotes = run('git remote')
    } catch {}

    if (remotes.includes('origin')) {
      run(`git remote set-url origin "${remoteUrl}"`, token)
    } else {
      run(`git remote add origin "${remoteUrl}"`, token)
    }

    // 4. Check for and ensure clean branch
    try {
      run(`git checkout -B ${branch}`)
    } catch {
      run(`git branch -M ${branch}`)
    }

    // 5. Stage all changes
    console.log('\nStaging files for commit...')
    run('git add -A')

    const status = run('git status --porcelain')
    if (!status) {
      console.log('\x1b[33mℹ No changes detected in working tree.\x1b[0m')
    } else {
      const fileCount = status.split('\n').filter(Boolean).length
      console.log(`Staged \x1b[32m${fileCount}\x1b[0m files.`)

      // 6. Custom or auto commit message
      const customMsgArg = process.argv.find((arg) => arg.startsWith('--message='))
      const commitMsg = customMsgArg
        ? customMsgArg.replace('--message=', '').trim()
        : `feat: deploy latest updates - RyzenDesk Professional Polish [${new Date().toISOString()}]`

      console.log(`\nCommitting: "${commitMsg}"`)
      run(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`)
    }

    // 7. Push updates to remote repository
    console.log('\nPushing updates to GitHub...')
    
    try {
      run(`git push -u origin ${branch}`, token)
    } catch (pushErr: any) {
      console.log('\x1b[33mℹ Fast-forward not possible, pushing updates with force overwrite to sync remote...\x1b[0m')
      run(`git push -u origin ${branch} --force`, token)
    }

    const latestCommit = run('git log -1 --oneline')
    console.log('\n\x1b[32m✔ SUCCESS! All updates deployed and pushed to GitHub.\x1b[0m')
    console.log(`Latest commit: \x1b[1m${latestCommit}\x1b[0m`)
    console.log(`View online  : \x1b[34mhttps://github.com/${repo}/tree/${branch}\x1b[0m\n`)
    return { success: true, commit: latestCommit, branch, repo }
  } catch (err: any) {
    console.error('\n\x1b[31m✖ Deployment failed:\x1b[0m', err.message)
    throw err
  }
}

// Execute if run directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('deploy-to-github')) {
  deployToGithub().catch(() => {
    process.exit(1)
  })
}
