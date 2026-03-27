import { spawnSync } from "node:child_process";

const DEFAULT_REMOTE = "origin";
const COMMIT_HASH_PATTERN = /^[0-9a-f]{7,40}$/i;

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

function parseUpdateArgs(args) {
  if (args.length > 1) {
    throw new Error("Update accepts at most one optional version or commit argument.");
  }

  return {
    target: args[0] || null
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

function hasRemoteBranch(projectRoot, remoteName, branchName) {
  const result = runGit(
    projectRoot,
    ["show-ref", "--verify", "--quiet", `refs/remotes/${remoteName}/${branchName}`],
    { check: false }
  );

  return result.status === 0;
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

function updateCurrentBranch(projectRoot, remoteName) {
  const branchName = readCurrentBranch(projectRoot);
  if (!branchName) {
    throw new Error("Update without a version requires an attached branch. Specify a tag or commit when running from detached HEAD.");
  }

  if (!hasRemoteBranch(projectRoot, remoteName, branchName)) {
    throw new Error(`Remote ${remoteName} does not have branch ${branchName}.`);
  }

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

function checkoutTargetRevision(projectRoot, remoteName, target) {
  const resolvedTarget = resolveTargetRevision(projectRoot, remoteName, target);
  if (!resolvedTarget) {
    throw new Error(`Could not resolve "${target}" as an exact tag or a short/full commit hash from ${remoteName}.`);
  }

  runGit(projectRoot, ["checkout", "--detach", resolvedTarget.revision]);
  const shortCommit = readShortCommit(projectRoot);
  console.log(`Checked out ${resolvedTarget.label} at ${shortCommit}.`);
}

export const help = {
  name: "update",
  summary: "Fetch and apply updates from the git repository.",
  usage: [
    "node A1.js update",
    "node A1.js update <version-tag>",
    "node A1.js update <commit>"
  ],
  description:
    "Without an argument, fast-forwards the current branch from origin. With a version tag or a short/full commit hash, fetches from origin and checks out that exact revision in detached HEAD mode."
};

export async function execute(context) {
  const { target } = parseUpdateArgs(context.args);

  ensureCleanTrackedFiles(context.projectRoot);

  console.log(`Fetching updates from ${DEFAULT_REMOTE}...`);
  fetchRemote(context.projectRoot, DEFAULT_REMOTE);

  if (target) {
    checkoutTargetRevision(context.projectRoot, DEFAULT_REMOTE, target);
    return 0;
  }

  updateCurrentBranch(context.projectRoot, DEFAULT_REMOTE);
  return 0;
}
