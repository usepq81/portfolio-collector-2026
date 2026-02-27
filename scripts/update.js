import fs from "fs";

const TOKEN = process.env.GITHUB_TOKEN; // Can be PAT or GITHUB_TOKEN

if (!TOKEN) {
  console.error("GITHUB_TOKEN (or PAT) is missing.");
  process.exit(1);
}

const START_DATE = "2026-01-01";
const END_DATE = "2026-12-31";
const README_PATH = "README.md";

// Read existing repo names from README
function getExistingRepos() {
  if (!fs.existsSync(README_PATH)) return new Map();

  const content = fs.readFileSync(README_PATH, "utf-8");
  const regex = /\| \[([^\]]+)\]\(https:\/\/github\.com\/([^\)]+)\) \| ([^\|]+) \| (\d+) \| (\d{4}-\d{2}-\d{2}) \|/g;
  const existing = new Map();
  let match;
  while ((match = regex.exec(content)) !== null) {
    existing.set(match[1], {
      name: match[1],
      html_url: `https://github.com/${match[2]}`,
      owner: { login: match[3].trim() },
      stargazers_count: parseInt(match[4], 10),
      pushed_at: match[5]
    });
  }
  return existing;
}

// Fetch repositories from GitHub
async function fetchRepos(page = 1) {
  const query = `portfolio in:name pushed:${START_DATE}..${END_DATE} fork:false`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(
    query
  )}&sort=updated&order=desc&per_page=100&page=${page}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json"
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API Error ${response.status}: ${error}`);
  }

  return response.json();
}

// Generate README content
function generateMarkdown(repos) {
  let output = `# 📁 Portfolio Repositories (2026)

> ℹ️ If your portfolio repository is missing, feel free to submit a PR to add it.

| Repository | Owner | ⭐ Stars | Last Push |
|------------|--------|----------|------------|
`;

  for (const repo of repos) {
    const date = repo.pushed_at.split("T")[0];
    output += `| [${repo.name}](${repo.html_url}) | ${repo.owner.login} | ${repo.stargazers_count} | ${date} |\n`;
  }

  return output;
}

async function main() {
  const existingMap = getExistingRepos();
  let allNewRepos = [];
  let page = 1;

  while (true) {
    const data = await fetchRepos(page);

    if (!data.items || data.items.length === 0) break;

    const newRepos = data.items.filter(repo => !existingMap.has(repo.name));
    allNewRepos.push(...newRepos);

    if (data.items.length < 100 || page === 10) break; // 1000 max
    page++;
  }

  // Merge old and new repos
  for (const repo of allNewRepos) {
    existingMap.set(repo.name, repo);
  }

  // Convert Map to array and sort A → Z
  const sortedRepos = Array.from(existingMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  const markdown = generateMarkdown(sortedRepos);
  fs.writeFileSync(README_PATH, markdown);
  console.log(`Updated README with ${allNewRepos.length} new repositories.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
