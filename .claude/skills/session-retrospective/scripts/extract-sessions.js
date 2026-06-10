#!/usr/bin/env node

/**
 * Session data extractor for Claude Code JSONL session files.
 *
 * Reads all .jsonl session files from the project's Claude session directory,
 * extracts lightweight summaries (user text, assistant text, tool names, metadata),
 * and writes a single JSON summary file suitable for Claude analysis.
 *
 * Usage:
 *   node extract-sessions.js <project-session-dir> <output-path> [--since YYYY-MM-DD] [--until YYYY-MM-DD]
 *
 * Output: JSON file with session summaries (~200KB for 36 sessions).
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error(
    "Usage: node extract-sessions.js <session-dir> <output-path> [--since YYYY-MM-DD] [--until YYYY-MM-DD]"
  );
  process.exit(1);
}

const sessionDir = args[0];
const outputPath = args[1];

let sinceDate = null;
let untilDate = null;

for (let i = 2; i < args.length; i++) {
  if (args[i] === "--since" && args[i + 1]) {
    sinceDate = new Date(args[i + 1]);
    i++;
  } else if (args[i] === "--until" && args[i + 1]) {
    untilDate = new Date(args[i + 1]);
    untilDate.setHours(23, 59, 59, 999);
    i++;
  }
}

// Patterns that indicate IDE/system-injected content in user messages
const SYSTEM_MESSAGE_INDICATORS = [
  "<ide_",
  "<system-reminder>",
  "<command-name>",
  "The user opened the file",
];

function isRealUserText(text) {
  if (!text || text.trim().length === 0) return false;
  for (const indicator of SYSTEM_MESSAGE_INDICATORS) {
    if (text.trimStart().startsWith(indicator)) return false;
  }
  return true;
}

// Extract plain user text from a content array, filtering out system messages
function extractUserText(contentArray) {
  const texts = [];
  for (const block of contentArray) {
    if (block.type === "text" && isRealUserText(block.text)) {
      // Strip any embedded system-reminder tags from otherwise real messages
      let cleaned = block.text
        .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
        .replace(/<ide_[^>]*>[\s\S]*?<\/ide_[^>]*>/g, "")
        .trim();
      if (cleaned.length > 0) {
        texts.push(cleaned);
      }
    }
  }
  return texts.join("\n");
}

// Extract assistant text (no thinking blocks, no tool_use)
function extractAssistantText(contentArray) {
  const texts = [];
  for (const block of contentArray) {
    if (block.type === "text" && block.text && block.text.trim().length > 0) {
      texts.push(block.text.trim());
    }
  }
  return texts.join("\n");
}

// Extract tool names from assistant content (tool_use blocks)
function extractToolNames(contentArray) {
  const tools = [];
  for (const block of contentArray) {
    if (block.type === "tool_use" && block.name) {
      tools.push(block.name);
    }
  }
  return tools;
}

// Check if a tool_result contains an error (only check tool_result blocks, not free text)
function hasToolError(contentArray) {
  for (const block of contentArray) {
    if (block.type !== "tool_result") continue;
    if (block.is_error) return true;
    // Only check text content within tool_result blocks for error signals
    if (
      typeof block.content === "string" &&
      (block.content.includes("Error:") ||
        block.content.includes("error:") ||
        block.content.includes("FAILED") ||
        block.content.includes("Exit code"))
    ) {
      return true;
    }
  }
  return false;
}

async function processSession(filePath) {
  const sessionId = path.basename(filePath, ".jsonl");
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const session = {
    sessionId,
    title: null,
    startTime: null,
    endTime: null,
    gitBranch: null,
    entrypoint: null,
    version: null,
    userMessages: [],
    assistantMessages: [],
    toolsUsed: {},
    errorCount: 0,
    totalUserTokens: 0,
    totalAssistantTokens: 0,
    messageCount: { user: 0, assistant: 0, toolUse: 0, toolResult: 0 },
    skillInvocations: [],
  };

  for await (const line of rl) {
    if (!line.trim()) continue;

    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    const timestamp = obj.timestamp;

    // Track time range
    if (timestamp) {
      const ts = new Date(timestamp);
      if (!session.startTime || ts < new Date(session.startTime)) session.startTime = timestamp;
      if (!session.endTime || ts > new Date(session.endTime)) session.endTime = timestamp;
    }

    // Extract metadata
    if (obj.gitBranch && !session.gitBranch) session.gitBranch = obj.gitBranch;
    if (obj.entrypoint && !session.entrypoint) session.entrypoint = obj.entrypoint;
    if (obj.version && !session.version) session.version = obj.version;

    switch (obj.type) {
      case "ai-title":
        session.title = obj.aiTitle;
        break;

      case "user": {
        const content = obj.message?.content;
        if (!Array.isArray(content)) break;

        session.messageCount.user++;
        const userText = extractUserText(content);
        if (userText) {
          session.userMessages.push({
            timestamp,
            text: userText,
            gitBranch: obj.gitBranch || session.gitBranch,
          });
        }

        // Check tool results for errors
        if (hasToolError(content)) {
          session.errorCount++;
          session.messageCount.toolResult++;
        }
        break;
      }

      case "assistant": {
        const content = obj.message?.content;
        if (!Array.isArray(content)) break;

        session.messageCount.assistant++;

        // Token usage
        const usage = obj.message?.usage;
        if (usage) {
          session.totalUserTokens += usage.input_tokens || 0;
          session.totalAssistantTokens += usage.output_tokens || 0;
        }

        // Extract text
        const assistantText = extractAssistantText(content);
        if (assistantText) {
          session.assistantMessages.push({
            timestamp,
            text: assistantText.substring(0, 2000), // cap per-message to avoid bloat
          });
        }

        // Extract tool names
        const tools = extractToolNames(content);
        for (const tool of tools) {
          session.toolsUsed[tool] = (session.toolsUsed[tool] || 0) + 1;
          session.messageCount.toolUse++;

          // Detect skill invocations (capture all Skill tool_use blocks)
          if (tool === "Skill") {
            const skillBlocks = content.filter(
              (b) => b.type === "tool_use" && b.name === "Skill"
            );
            for (const sb of skillBlocks) {
              if (sb.input?.skill && !session.skillInvocations.includes(sb.input.skill + "@" + timestamp)) {
                session.skillInvocations.push(sb.input.skill);
              }
            }
          }
        }
        break;
      }
    }
  }

  return session;
}

async function main() {
  const files = fs
    .readdirSync(sessionDir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => path.join(sessionDir, f));

  console.error(`Found ${files.length} session files`);

  const sessions = [];
  for (const file of files) {
    try {
      const session = await processSession(file);

      // Apply date filters using overlap logic:
      // Include session if its time range overlaps with the requested range
      if (sinceDate && session.endTime && new Date(session.endTime) < sinceDate) continue;
      if (untilDate && session.startTime && new Date(session.startTime) > untilDate) continue;

      // Skip empty sessions (no real user messages)
      if (session.userMessages.length === 0) continue;

      sessions.push(session);
    } catch (err) {
      console.error(`Error processing ${file}: ${err.message}`);
    }
  }

  // Sort by start time
  sessions.sort((a, b) => {
    if (!a.startTime || !b.startTime) return 0;
    return new Date(a.startTime) - new Date(b.startTime);
  });

  // Compute aggregate stats
  const stats = {
    totalSessions: sessions.length,
    dateRange: {
      from: sessions[0]?.startTime || null,
      to: sessions[sessions.length - 1]?.endTime || null,
    },
    totalUserMessages: sessions.reduce((s, sess) => s + sess.userMessages.length, 0),
    totalAssistantMessages: sessions.reduce((s, sess) => s + sess.assistantMessages.length, 0),
    totalToolCalls: sessions.reduce(
      (s, sess) => s + Object.values(sess.toolsUsed).reduce((a, b) => a + b, 0),
      0
    ),
    totalErrors: sessions.reduce((s, sess) => s + sess.errorCount, 0),
    allSkillsUsed: [
      ...new Set(sessions.flatMap((s) => s.skillInvocations)),
    ],
    allToolsUsed: (() => {
      const merged = {};
      for (const sess of sessions) {
        for (const [tool, count] of Object.entries(sess.toolsUsed)) {
          merged[tool] = (merged[tool] || 0) + count;
        }
      }
      return merged;
    })(),
    branchesWorkedOn: [...new Set(sessions.map((s) => s.gitBranch).filter(Boolean))],
  };

  const output = { stats, sessions };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.error(`Wrote ${sessions.length} session summaries to ${outputPath}`);
  console.error(
    `Total user messages: ${stats.totalUserMessages}, Total text size: ${Math.round(
      JSON.stringify(output).length / 1024
    )}KB`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
