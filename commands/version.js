import { execFileSync } from "node:child_process";

function readGitOutput(projectRoot, args) {
  return execFileSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
}

function readLatestTag(projectRoot) {
  try {
    return readGitOutput(projectRoot, ["describe", "--tags", "--abbrev=0"]);
  } catch (error) {
    return null;
  }
}

function readCommitCount(projectRoot, rangeArgs) {
  return Number(readGitOutput(projectRoot, ["rev-list", "--count", ...rangeArgs]) || "0");
}

export const help = {
  name: "version",
  summary: "Print the git-derived version string.",
  usage: ["node A1.js version", "node A1.js --version"],
  description:
    'Prints the latest git tag plus the number of commits since that tag, for example "v1.15+6". If there are no tags yet, it falls back to "v0.0+<total commits>".'
};

export async function execute(context) {
  const latestTag = readLatestTag(context.projectRoot);
  const baseTag = latestTag || "v0.0";
  const commitCount = latestTag
    ? readCommitCount(context.projectRoot, [`${latestTag}..HEAD`])
    : readCommitCount(context.projectRoot, ["HEAD"]);

  console.log(`${baseTag}+${commitCount}`);
  return 0;
}
