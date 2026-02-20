/**
 * Project Tooling Detection (Python + Node.js)
 *
 * Goal: provide a single source of truth for "what commands should we run".
 *
 * Design principles:
 * - Detect primarily from repo files (lockfiles/config), not from what's installed.
 * - Still report whether a tool appears installed (best-effort) to reduce confusion.
 * - Provide a small set of canonical commands used by skills/hooks.
 */

const fs = require('fs');
const path = require('path');

const { readFile, commandExists } = require('./utils');
const { getPackageManager } = require('./package-manager');

function fileExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readText(p) {
  return readFile(p) || '';
}

function joinCmd(parts) {
  return parts.filter(Boolean).join(' ');
}

function prefixCmd(prefixParts, cmdParts) {
  return joinCmd([...(prefixParts || []), ...(cmdParts || [])]);
}

function detectPythonTooling(projectDir = process.cwd()) {
  const pyprojectPath = path.join(projectDir, 'pyproject.toml');
  const hasPyproject = fileExists(pyprojectPath);
  const pyproject = hasPyproject ? readText(pyprojectPath) : '';

  const hasUvLock = fileExists(path.join(projectDir, 'uv.lock'));
  const hasPoetryLock = fileExists(path.join(projectDir, 'poetry.lock'));
  const hasPdmLock = fileExists(path.join(projectDir, 'pdm.lock'));
  const hasPipfile = fileExists(path.join(projectDir, 'Pipfile'));
  const hasRequirements =
    fileExists(path.join(projectDir, 'requirements.txt')) ||
    fileExists(path.join(projectDir, 'requirements-dev.txt')) ||
    fileExists(path.join(projectDir, 'requirements-dev.in')) ||
    fileExists(path.join(projectDir, 'requirements.in'));

  // Detect from strong signals first.
  if (hasUvLock || /\[tool\.uv\]/.test(pyproject)) {
    return {
      manager: 'uv',
      source: hasUvLock ? 'uv.lock' : 'pyproject.toml',
      installed: commandExists('uv'),
      runnerPrefix: ['uv', 'run']
    };
  }

  if (hasPoetryLock || /\[tool\.poetry\]/.test(pyproject)) {
    return {
      manager: 'poetry',
      source: hasPoetryLock ? 'poetry.lock' : 'pyproject.toml',
      installed: commandExists('poetry'),
      runnerPrefix: ['poetry', 'run']
    };
  }

  if (hasPdmLock || /\[tool\.pdm\]/.test(pyproject)) {
    return {
      manager: 'pdm',
      source: hasPdmLock ? 'pdm.lock' : 'pyproject.toml',
      installed: commandExists('pdm'),
      runnerPrefix: ['pdm', 'run']
    };
  }

  if (hasPipfile) {
    return {
      manager: 'pipenv',
      source: 'Pipfile',
      installed: commandExists('pipenv'),
      runnerPrefix: ['pipenv', 'run']
    };
  }

  if (hasPyproject) {
    // Generic pyproject (PEP 621 / setuptools / hatch / etc.)
    // Prefer plain python -m invocations; optionally advise uv if installed.
    return {
      manager: 'pyproject',
      source: 'pyproject.toml',
      installed: commandExists('python') || commandExists('python3'),
      runnerPrefix: []
    };
  }

  if (hasRequirements) {
    return {
      manager: 'pip',
      source: 'requirements*.txt',
      installed: commandExists('python') || commandExists('python3'),
      runnerPrefix: []
    };
  }

  return {
    manager: 'unknown',
    source: 'none',
    installed: commandExists('python') || commandExists('python3'),
    runnerPrefix: []
  };
}

function detectNodeTooling(projectDir = process.cwd()) {
  const pkgJson = path.join(projectDir, 'package.json');
  const hasPackageJson = fileExists(pkgJson);
  if (!hasPackageJson) {
    return {
      present: false,
      packageManager: null,
      source: null,
      installed: false
    };
  }

  const pm = getPackageManager({ projectDir });
  return {
    present: true,
    packageManager: pm.name,
    source: pm.source,
    installed: commandExists(pm.name)
  };
}

function pythonCommands(tooling) {
  const mgr = tooling.manager;
  const prefix = tooling.runnerPrefix || [];

  // Small set of commands used in skills.
  if (mgr === 'uv') {
    return {
      install: 'uv sync',
      format: 'uv run ruff format .',
      lint: 'uv run ruff check .',
      types: 'uv run mypy .',
      tests: 'uv run pytest -q',
      testsCoverage: 'uv run pytest -q --cov=. --cov-report=term-missing',
      sanity: 'uv run python -m compileall -q .'
    };
  }

  if (mgr === 'poetry') {
    return {
      install: 'poetry install',
      format: 'poetry run ruff format .',
      lint: 'poetry run ruff check .',
      types: 'poetry run mypy .',
      tests: 'poetry run pytest -q',
      testsCoverage: 'poetry run pytest -q --cov=. --cov-report=term-missing',
      sanity: 'poetry run python -m compileall -q .'
    };
  }

  if (mgr === 'pdm') {
    return {
      install: 'pdm install',
      format: 'pdm run ruff format .',
      lint: 'pdm run ruff check .',
      types: 'pdm run mypy .',
      tests: 'pdm run pytest -q',
      testsCoverage: 'pdm run pytest -q --cov=. --cov-report=term-missing',
      sanity: 'pdm run python -m compileall -q .'
    };
  }

  if (mgr === 'pipenv') {
    return {
      install: 'pipenv install --dev',
      format: 'pipenv run ruff format .',
      lint: 'pipenv run ruff check .',
      types: 'pipenv run mypy .',
      tests: 'pipenv run pytest -q',
      testsCoverage: 'pipenv run pytest -q --cov=. --cov-report=term-missing',
      sanity: 'pipenv run python -m compileall -q .'
    };
  }

  // Generic fallback (works without assuming a specific tool)
  return {
    install: mgr === 'pip' ? 'python -m pip install -r requirements.txt' : 'python -m pip install -e .',
    format: prefixCmd(prefix, ['ruff', 'format', '.']) || 'ruff format .',
    lint: prefixCmd(prefix, ['ruff', 'check', '.']) || 'ruff check .',
    types: prefixCmd(prefix, ['mypy', '.']) || 'mypy .',
    tests: prefixCmd(prefix, ['pytest', '-q']) || 'pytest -q',
    testsCoverage: prefixCmd(prefix, ['pytest', '-q', '--cov=.', '--cov-report=term-missing']) ||
      'pytest -q --cov=. --cov-report=term-missing',
    sanity: prefixCmd(prefix, ['python', '-m', 'compileall', '-q', '.']) || 'python -m compileall -q .'
  };
}

function nodeCommands(tooling) {
  if (!tooling.present) return null;

  const pm = tooling.packageManager || 'npm';

  // Prefer local dependency execution; avoid dlx/npx auto-installs.
  if (pm === 'pnpm') {
    return {
      install: 'pnpm install',
      test: 'pnpm test',
      build: 'pnpm build',
      lint: 'pnpm lint',
      prettier: 'pnpm exec prettier --write .',
      tsc: 'pnpm exec tsc --noEmit'
    };
  }

  if (pm === 'yarn') {
    return {
      install: 'yarn install',
      test: 'yarn test',
      build: 'yarn build',
      lint: 'yarn lint',
      prettier: 'yarn prettier --write .',
      tsc: 'yarn tsc --noEmit'
    };
  }

  if (pm === 'bun') {
    return {
      install: 'bun install',
      test: 'bun test',
      build: 'bun run build',
      lint: 'bun run lint',
      // bunx may download if missing; prefer local node_modules/.bin first.
      prettier: 'bunx prettier --write .',
      tsc: 'bunx tsc --noEmit'
    };
  }

  // npm (default)
  return {
    install: 'npm install',
    test: 'npm test',
    build: 'npm run build',
    lint: 'npm run lint',
    prettier: 'npx --no-install prettier --write .',
    tsc: 'npx --no-install tsc --noEmit'
  };
}

function computeToolingState(projectDir = process.cwd()) {
  const py = detectPythonTooling(projectDir);
  const node = detectNodeTooling(projectDir);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    python: {
      ...py,
      commands: pythonCommands(py)
    },
    node: {
      ...node,
      commands: nodeCommands(node)
    }
  };
}

module.exports = {
  detectPythonTooling,
  detectNodeTooling,
  computeToolingState
};
