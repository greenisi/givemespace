import { spawnSync } from "node:child_process";

const DEFAULT_REMOTE = "origin";
const COMMIT_HASH_PATTERN = /^[0-9a-f]{7,40}$/i;
const UPDATE_BRANCH_CONFIG_KEY = "agent-one.updateBranch";

function createMissingGitError() {
  const baseMessage =
    "The update command is only available for source installs and requires Git to be installed and available on PATH.";

  if (process.platform === "darwin") {
    return new Error(`${baseMessage} Install it with "xcode-select --install" or "brew install git", then try again.`);
  }

  if (process.platform === "win32") {
    return new Error(
      `${baseMessage} Install Git for Windows, reopen the terminal so PATH is refreshed, then try again.`
    );
  }

  return new Error(
    `${baseMessage} Install the "git" package with your distro package manager, then try again.`
  );
}

function createGitError(args, stderr, stdout) {
  const message = String(stderr || stdout || "git command failed").trim();
  return new Error(`git ${args.join(" ")} failed: ${message}`);
}

function runGit(projectRoot, args, { check = true } = {}) {
  const result = spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw createMissingGitError();
    }

    throw result.error;
  }

  if (check && result.status !== 0) {
    throw createGitError(args, result.stderr, result.stdout);
  }

  return result;
}

function readGit(projectRoot, args, options) {
  return runGit(projectRoot, args, options).stdout.trim();
}

function ensureGitAvailable(projectRoot) {
  const result = spawnSync("git", ["--version"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.error && result.error.code === "ENOENT") {
    throw createMissingGitError();
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw createGitError(["--version"], result.stderr, result.stdout);
  }
}

function parseUpdateArgs(args) {
  let target = null;
  let branchName = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--branch") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--branch requires a branch name.");
      }

      branchName = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--branch=")) {
      branchName = arg.slice("--branch=".length).trim();
      if (!branchName) {
        throw new Error("--branch requires a branch name.");
      }
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown update argument: ${arg}`);
    }

    if (target) {
      throw new Error("Update accepts at most one positional tag, commit, or branch target.");
    }

    target = arg;
  }

  if (target && branchName) {
    throw new Error("Use either a positional target or --branch <branch>, not both.");
  }

  return {
    branchName,
    target
  };
}

function ensureCleanTrackedFiles(projectRoot) {
  const unstagedDiff = runGit(projectRoot, ["diff", "--quiet"], { check: false });
  if (unstagedDiff.status === 1) {
    throw new Error("Update refused because tracked files have unstaged changes. Commit or stash them first.");
  }
  if (unstagedDiff.status !== 0) {
    throw createGitError(["diff", "--quiet"], unstagedDiff.stderr, unstagedDiff.stdout);
  }

  const stagedDiff = runGit(projectRoot, ["diff", "--cached", "--quiet"], { check: false });
  if (stagedDiff.status === 1) {
    throw new Error("Update refused because tracked files have staged changes. Commit, unstage, or stash them first.");
  }
  if (stagedDiff.status !== 0) {
    throw createGitError(["diff", "--cached", "--quiet"], stagedDiff.stderr, stagedDiff.stdout);
  }
}

function fetchRemote(projectRoot, remoteName) {
  runGit(projectRoot, ["fetch", "--tags", remoteName]);
}

function readCurrentBranch(projectRoot) {
  return readGit(projectRoot, ["branch", "--show-current"]);
}

function hasLocalBranch(projectRoot, branchName) {
  const result = runGit(projectRoot, ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], {
    check: false
  });

  return result.status === 0;
}

function hasRemoteBranch(projectRoot, remoteName, branchName) {
  const result = runGit(
    projectRoot,
    ["show-ref", "--verify", "--quiet", `refs/remotes/${remoteName}/${branchName}`],
    { check: false }
  );

  return result.status === 0;
}

function readRememberedBranch(projectRoot) {
  const result = runGit(projectRoot, ["config", "--local", "--get", UPDATE_BRANCH_CONFIG_KEY], { check: false });
  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim() || null;
}

function rememberBranch(projectRoot, branchName) {
  if (!branchName) {
    return;
  }

  runGit(projectRoot, ["config", "--local", UPDATE_BRANCH_CONFIG_KEY, branchName]);
}

function readRemoteDefaultBranch(projectRoot, remoteName) {
  const result = runGit(projectRoot, ["symbolic-ref", "--quiet", "--short", `refs/remotes/${remoteName}/HEAD`], {
    check: false
  });

  if (result.status !== 0) {
    return null;
  }

  const remoteRef = result.stdout.trim();
  const prefix = `${remoteName}/`;
  if (!remoteRef.startsWith(prefix)) {
    return null;
  }

  return remoteRef.slice(prefix.length) || null;
}

function readHeadCommit(projectRoot) {
  return readGit(projectRoot, ["rev-parse", "HEAD"]);
}

function readShortCommit(projectRoot, revision = "HEAD") {
  return readGit(projectRoot, ["rev-parse", "--short", revision]);
}

function isCommitReference(value) {
  return COMMIT_HASH_PATTERN.test(value);
}

function tryReadRevision(projectRoot, revision) {
  const result = runGit(projectRoot, ["rev-parse", "--verify", "--quiet", revision], { check: false });
  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim();
}

function resolveTargetRevision(projectRoot, remoteName, target) {
  const tagRevision = tryReadRevision(projectRoot, `refs/tags/${target}^{commit}`);
  if (tagRevision) {
    return {
      revision: tagRevision,
      label: `tag ${target}`
    };
  }

  if (!isCommitReference(target)) {
    return null;
  }

  let commitRevision = tryReadRevision(projectRoot, `${target}^{commit}`);
  if (commitRevision) {
    return {
      revision: commitRevision,
      label: `commit ${target}`
    };
  }

  runGit(projectRoot, ["fetch", "--no-tags", remoteName, target], { check: false });
  commitRevision = tryReadRevision(projectRoot, `${target}^{commit}`);

  if (!commitRevision) {
    return null;
  }

  return {
    revision: commitRevision,
    label: `commit ${target}`
  };
}

function resolveReconnectBranch(projectRoot, remoteName) {
  const rememberedBranch = readRememberedBranch(projectRoot);
  if (rememberedBranch && hasRemoteBranch(projectRoot, remoteName, rememberedBranch)) {
    return rememberedBranch;
  }

  const defaultBranch = readRemoteDefaultBranch(projectRoot, remoteName);
  if (defaultBranch && hasRemoteBranch(projectRoot, remoteName, defaultBranch)) {
    return defaultBranch;
  }

  return null;
}

function reattachBranch(projectRoot, remoteName, branchName) {
  const currentBranch = readCurrentBranch(projectRoot);
  if (currentBranch === branchName) {
    return;
  }

  if (hasLocalBranch(projectRoot, branchName)) {
    runGit(projectRoot, ["switch", branchName]);
    console.log(`Reattached to ${branchName}.`);
    return;
  }

  if (!hasRemoteBranch(projectRoot, remoteName, branchName)) {
    throw new Error(`Remote ${remoteName} does not have branch ${branchName}.`);
  }

  runGit(projectRoot, ["switch", "--create", branchName, "--track", `${remoteName}/${branchName}`]);
  console.log(`Created and attached ${branchName} tracking ${remoteName}/${branchName}.`);
}

function resolveBranchTarget(projectRoot, remoteName, target) {
  if (!target) {
    return null;
  }

  if (hasRemoteBranch(projectRoot, remoteName, target) || hasLocalBranch(projectRoot, target)) {
    return target;
  }

  return null;
}

function updateBranch(projectRoot, remoteName, requestedBranchName = null) {
  let branchName = requestedBranchName || readCurrentBranch(projectRoot);
  if (!branchName) {
    branchName = resolveReconnectBranch(projectRoot, remoteName);
    if (!branchName) {
      throw new Error(
        "Update could not reconnect from detached HEAD because no remembered branch or origin/HEAD default branch was available."
      );
    }
  }

  if (!hasRemoteBranch(projectRoot, remoteName, branchName)) {
    throw new Error(`Remote ${remoteName} does not have branch ${branchName}.`);
  }

  reattachBranch(projectRoot, remoteName, branchName);
  rememberBranch(projectRoot, branchName);

  const previousCommit = readHeadCommit(projectRoot);
  runGit(projectRoot, ["merge", "--ff-only", `${remoteName}/${branchName}`]);
  const nextCommit = readHeadCommit(projectRoot);
  const shortCommit = readShortCommit(projectRoot);

  if (previousCommit === nextCommit) {
    console.log(`Already up to date with ${remoteName}/${branchName} at ${shortCommit}.`);
    return;
  }

  console.log(`Updated ${branchName} to ${remoteName}/${branchName} at ${shortCommit}.`);
}

function resolveTargetBranch(projectRoot, remoteName) {
  const currentBranch = readCurrentBranch(projectRoot);
  if (currentBranch) {
    return currentBranch;
  }

  return resolveReconnectBranch(projectRoot, remoteName);
}

function applyRevisionToBranch(projectRoot, remoteName, branchName, resolvedTarget) {
  reattachBranch(projectRoot, remoteName, branchName);
  rememberBranch(projectRoot, branchName);

  const previousCommit = readHeadCommit(projectRoot);
  runGit(projectRoot, ["reset", "--hard", resolvedTarget.revision]);
  const nextCommit = readHeadCommit(projectRoot);
  const shortCommit = readShortCommit(projectRoot);

  if (previousCommit === nextCommit) {
    console.log(`Already on ${branchName} at ${resolvedTarget.label} (${shortCommit}).`);
    return;
  }

  console.log(`Updated ${branchName} to ${resolvedTarget.label} at ${shortCommit}.`);
}

function checkoutTargetRevision(projectRoot, remoteName, target) {
  const resolvedTarget = resolveTargetRevision(projectRoot, remoteName, target);
  if (!resolvedTarget) {
    throw new Error(`Could not resolve "${target}" as an exact tag or a short/full commit hash from ${remoteName}.`);
  }

  const targetBranch = resolveTargetBranch(projectRoot, remoteName);
  if (targetBranch) {
    applyRevisionToBranch(projectRoot, remoteName, targetBranch, resolvedTarget);
    return;
  }

  runGit(projectRoot, ["checkout", "--detach", resolvedTarget.revision]);
  const shortCommit = readShortCommit(projectRoot);
  console.log(`Checked out ${resolvedTarget.label} at ${shortCommit} in detached HEAD mode.`);
}

export const help = {
  name: "update",
  summary: "Fetch and apply source-checkout updates from the git repository.",
  usage: [
    "node A1.js update",
    "node A1.js update --branch <branch>",
    "node A1.js update <branch>",
    "node A1.js update <version-tag>",
    "node A1.js update <commit>"
  ],
  description:
    "For source checkouts only. Requires Git on PATH. Without an argument, fast-forwards the current branch from origin, or reconnects from detached HEAD to the remembered or default origin branch first. You can also target a branch explicitly with --branch <branch> or a bare branch name. Version tags and short/full commit hashes move the current or remembered branch to that exact revision when possible, falling back to detached HEAD only when no branch can be recovered."
};

export async function execute(context) {
  const { branchName, target } = parseUpdateArgs(context.args);

  ensureGitAvailable(context.projectRoot);
  ensureCleanTrackedFiles(context.projectRoot);

  console.log(`Fetching updates from ${DEFAULT_REMOTE}...`);
  fetchRemote(context.projectRoot, DEFAULT_REMOTE);

  if (branchName) {
    updateBranch(context.projectRoot, DEFAULT_REMOTE, branchName);
    return 0;
  }

  if (target) {
    const targetBranch = resolveBranchTarget(context.projectRoot, DEFAULT_REMOTE, target);
    if (targetBranch && !resolveTargetRevision(context.projectRoot, DEFAULT_REMOTE, target)) {
      updateBranch(context.projectRoot, DEFAULT_REMOTE, targetBranch);
      return 0;
    }

    checkoutTargetRevision(context.projectRoot, DEFAULT_REMOTE, target);
    return 0;
  }

  updateBranch(context.projectRoot, DEFAULT_REMOTE);
  return 0;
}
