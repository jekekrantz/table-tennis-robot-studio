(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NovaProtocolDebug = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MACROS = Object.freeze({
    STATUS: { type: "request", expectedOpcode: 0x02, hex: "020000", timeoutMs: 3500, label: "status" },
    HEARTBEAT: { type: "request", expectedOpcode: 0x83, hex: "830600", timeoutMs: 3500, label: "heartbeat" },
    STOP: { type: "request", expectedOpcode: 0x80, hex: "80010001", timeoutMs: 6000, label: "stop" },
    PAUSE: { type: "request", expectedOpcode: 0x80, hex: "80010002", timeoutMs: 6000, label: "pause" },
    CONTINUE: { type: "request", expectedOpcode: 0x80, hex: "80010003", timeoutMs: 6000, label: "continue" },
  });

  function stripComment(line) {
    const hash = line.indexOf("#");
    const slash = line.indexOf("//");
    let cut = line.length;
    if (hash >= 0) cut = Math.min(cut, hash);
    if (slash >= 0) cut = Math.min(cut, slash);
    return line.slice(0, cut).trim();
  }

  function normalizeHex(text) {
    const tokens = String(text || "")
      .replace(/,/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(token => token.replace(/^0x/i, ""));
    const joined = tokens.join("");
    if (!joined) throw new Error("missing hex bytes");
    if (!/^[0-9a-f]+$/i.test(joined)) throw new Error(`invalid hex bytes: ${text}`);
    if (joined.length % 2) throw new Error("hex data has an odd number of digits");
    return joined.toLowerCase();
  }

  function parseDuration(text) {
    const match = String(text || "").trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(ms|s)?$/i);
    if (!match) throw new Error(`invalid duration: ${text}`);
    const value = Number(match[1]);
    const ms = (match[2] || "ms").toLowerCase() === "s" ? value * 1000 : value;
    if (!(ms >= 0 && Number.isFinite(ms))) throw new Error(`invalid duration: ${text}`);
    if (ms > 300000) throw new Error("one WAIT may not exceed 5 minutes");
    return Math.round(ms);
  }

  function parseOpcode(text) {
    const clean = String(text || "").replace(/^0x/i, "");
    if (!/^[0-9a-f]{1,2}$/i.test(clean)) throw new Error(`invalid expected opcode: ${text}`);
    return parseInt(clean, 16);
  }

  function parseLine(rawLine, lineNumber) {
    const text = stripComment(rawLine);
    if (!text) return null;
    const firstSpace = text.search(/\s/);
    const command = (firstSpace < 0 ? text : text.slice(0, firstSpace)).toUpperCase();
    const rest = firstSpace < 0 ? "" : text.slice(firstSpace).trim();

    if (MACROS[command] && !rest) return { ...MACROS[command], lineNumber, source: rawLine.trim() };
    if (command === "MARK") {
      if (!rest) throw new Error("MARK needs some text");
      return { type: "mark", text: rest, lineNumber, source: rawLine.trim() };
    }
    if (command === "WAIT") {
      return { type: "wait", durationMs: parseDuration(rest), lineNumber, source: rawLine.trim() };
    }
    if (command === "TX" || command === "SEND") {
      return { type: "send", hex: normalizeHex(rest), lineNumber, source: rawLine.trim() };
    }
    if (command === "REQ" || command === "REQUEST") {
      const parts = rest.split(/\s+/).filter(Boolean);
      if (parts.length < 2) throw new Error("REQ syntax: REQ <expected-opcode> <hex bytes...> [TIMEOUT <duration>]");
      const expectedOpcode = parseOpcode(parts.shift());
      let timeoutMs = 5000;
      const timeoutIndex = parts.findIndex(part => /^TIMEOUT$/i.test(part));
      let hexParts = parts;
      if (timeoutIndex >= 0) {
        if (timeoutIndex !== parts.length - 2) throw new Error("TIMEOUT must be the last option in REQ");
        timeoutMs = parseDuration(parts[timeoutIndex + 1]);
        hexParts = parts.slice(0, timeoutIndex);
      }
      return { type: "request", expectedOpcode, hex: normalizeHex(hexParts.join(" ")), timeoutMs, lineNumber, source: rawLine.trim(), label: "debug request" };
    }
    throw new Error(`unknown command '${command}'`);
  }

  function parseScript(source) {
    const text = String(source || "");
    if (text.length > 200000) throw new Error("Debug script is too large (200 kB maximum)");
    const actions = [];
    const errors = [];
    text.split(/\r?\n/).forEach((line, index) => {
      try {
        const action = parseLine(line, index + 1);
        if (action) actions.push(action);
      } catch (error) {
        errors.push({ lineNumber: index + 1, message: error.message, source: line });
      }
    });
    return { actions, errors };
  }

  function summarize(actions) {
    const counts = { send: 0, request: 0, wait: 0, mark: 0 };
    let waitMs = 0;
    for (const action of actions || []) {
      if (counts[action.type] != null) counts[action.type] += 1;
      if (action.type === "wait") waitMs += action.durationMs;
    }
    return { ...counts, total: (actions || []).length, waitMs };
  }

  return Object.freeze({ MACROS, stripComment, normalizeHex, parseDuration, parseOpcode, parseLine, parseScript, summarize });
});
