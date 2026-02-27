import fs from "fs";

const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error("GITHUB_TOKEN is missing.");
  process.exit(1);
}

const START_DATE = "2026-01-01";
const END_DATE = "2026-12-31";
const README_PATH = "README.md";

// Read existing repos from README
function getExistingRepos() {
  if (!fs.existsSync(README_PATH)) return new Set();

  const content = fs.readFileSync(README_PATH, "utf-8");
  const regex = /\| \[([^\]]+)\]\(https:\/\/github\.com\/[^\)]+\)/g;
  const existing = new Set();
  let match;
  while ((match = regex.exec(content)) !== null) {
    existing.add(match[1]);
  }
  return existing;
}

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

function generateMarkdown(repos) {
  let output = `# 📁 Portfolio Repositories (2026)

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
  const existingRepos = getExistingRepos();

  let allRepos = [];
  let page = 1;

  while (true) {
    const data = await fetchRepos(page);

    if (!data.items || data.items.length === 0) break;

    // Filter out repos already in README
    const newRepos = data.items.filter(repo => !existingRepos.has(repo.name));

    allRepos.push(...newRepos);

    if (data.items.length < 100 || page === 10) break; // 1000 max
    page++;
  }

  if (allRepos.length === 0) {
    console.log("No new repositories to add.");
    return;
  }

  const markdown = generateMarkdown(allRepos);

  fs.writeFileSync(README_PATH, markdown, { flag: "a" }); // append new repos

  console.log(`Added ${allRepos.length} new repositories to README.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
