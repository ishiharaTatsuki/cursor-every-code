/**
 * Hook input normalizer
 *
 * Claude Code sends hook input JSON with fields like:
 * - tool_name
 * - tool_input.command / tool_input.file_path
 * - tool_response (object)
 *
 * Cursor third-party hooks aim to be compatible, but field names can vary.
 * These helpers try common aliases to keep hooks resilient.
 */

function getToolName(input) {
  return (
    input?.tool_name ||
    input?.tool ||
    input?.toolName ||
    input?.tool_name_mapped || // defensive
    ''
  );
}

function getToolInput(input) {
  return input?.tool_input || input?.toolInput || {};
}

function getCommand(input) {
  const ti = getToolInput(input);
  return (
    ti?.command ||
    ti?.cmd ||
    ti?.shell_command ||
    input?.command ||
    input?.cmd ||
    ''
  );
}

function getFilePath(input) {
  const ti = getToolInput(input);
  return (
    ti?.file_path ||
    ti?.filePath ||
    ti?.path ||
    input?.file_path ||
    input?.filePath ||
    input?.path ||
    ''
  );
}

/**
 * Best-effort extraction of "text output" from a tool response.
 * For Bash, Claude Code typically includes tool_response with stdout/stderr.
 */
function getToolResponseText(input) {
  const r = input?.tool_response ?? input?.toolResponse ?? input?.tool_output ?? input?.toolOutput ?? input?.output;
  if (!r) return '';
  if (typeof r === 'string') return r;

  // Common patterns for shell output
  const stdout = r?.stdout ?? r?.Stdout ?? r?.out ?? r?.output ?? '';
  const stderr = r?.stderr ?? r?.Stderr ?? r?.err ?? '';
  const combined = [stdout, stderr].filter(Boolean).join('\n').trim();
  if (combined) return combined;

  try {
    return JSON.stringify(r);
  } catch {
    return String(r);
  }
}

module.exports = {
  getToolName,
  getToolInput,
  getCommand,
  getFilePath,
  getToolResponseText
};
