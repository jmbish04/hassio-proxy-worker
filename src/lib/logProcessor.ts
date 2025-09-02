/**
 * Log processing utilities for Home Assistant logs
 * Condenses, deduplicates, and filters logs for AI analysis
 */

export interface LogEntry {
	timestamp?: string;
	level?: string;
	message?: string;
	logger?: string;
	source?: string;
	exception?: string;
	[key: string]: unknown;
}

export interface ProcessedLogs {
	errorCount: number;
	warningCount: number;
	uniqueErrors: LogEntry[];
	recentErrors: LogEntry[];
	summary: string;
	timeRange: {
		start?: string;
		end?: string;
	};
}

/**
 * Condenses and processes Home Assistant logs for AI analysis
 */
export function processHomeLogs(logs: LogEntry[]): ProcessedLogs {
	if (!Array.isArray(logs) || logs.length === 0) {
		return {
			errorCount: 0,
			warningCount: 0,
			uniqueErrors: [],
			recentErrors: [],
			summary: "No logs available for processing",
			timeRange: {},
		};
	}

	const errorLogs = logs.filter((log) => log.level?.toUpperCase() === "ERROR");
	const warningLogs = logs.filter(
		(log) => log.level?.toUpperCase() === "WARNING",
	);

	// Deduplicate errors by message content
	const uniqueErrorsMap = new Map<string, LogEntry>();
	const recentErrors: LogEntry[] = [];

	// Sort logs by timestamp (most recent first)
	const sortedLogs = [...logs].sort((a, b) => {
		if (!a.timestamp || !b.timestamp) return 0;
		return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
	});

	for (const log of sortedLogs) {
		if (log.level?.toUpperCase() === "ERROR" && log.message) {
			// Create a simplified key for deduplication
			const messageKey = simplifyErrorMessage(log.message);

			if (!uniqueErrorsMap.has(messageKey)) {
				uniqueErrorsMap.set(messageKey, log);
			}

			// Collect recent errors (last 10)
			if (recentErrors.length < 10) {
				recentErrors.push(log);
			}
		}
	}

	const uniqueErrors = Array.from(uniqueErrorsMap.values());

	// Create summary
	const timestamps = logs
		.map((log) => log.timestamp)
		.filter(Boolean)
		.sort();

	const timeRange = {
		start: timestamps[0],
		end: timestamps[timestamps.length - 1],
	};

	const summary = createLogSummary(
		logs.length,
		errorLogs.length,
		warningLogs.length,
		uniqueErrors.length,
	);

	return {
		errorCount: errorLogs.length,
		warningCount: warningLogs.length,
		uniqueErrors,
		recentErrors,
		summary,
		timeRange,
	};
}

/**
 * Simplifies error messages for deduplication
 */
function simplifyErrorMessage(message: string): string {
	return (
		message
			// Remove timestamps
			.replace(
				/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*[Z]?/g,
				"[TIMESTAMP]",
			)
			// Remove IP addresses
			.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP]")
			// Remove UUIDs
			.replace(
				/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
				"[UUID]",
			)
			// Remove file paths
			.replace(/\/[a-zA-Z0-9_\-./]+/g, "[PATH]")
			// Remove URLs
			.replace(/https?:\/\/[^\s]+/g, "[URL]")
			// Normalize whitespace
			.replace(/\s+/g, " ")
			.trim()
			.toLowerCase()
	);
}

/**
 * Creates a human-readable summary of log processing results
 */
function createLogSummary(
	totalLogs: number,
	errors: number,
	warnings: number,
	uniqueErrors: number,
): string {
	const parts = [`Processed ${totalLogs} log entries`];

	if (errors > 0) {
		parts.push(`${errors} errors (${uniqueErrors} unique)`);
	}

	if (warnings > 0) {
		parts.push(`${warnings} warnings`);
	}

	if (errors === 0 && warnings === 0) {
		parts.push("no errors or warnings found");
	}

	return parts.join(", ");
}

/**
 * Formats logs for AI analysis prompt
 */
export function formatLogsForAI(processedLogs: ProcessedLogs): string {
	const sections = [];

	sections.push(`## Home Assistant Log Analysis Summary`);
	sections.push(`${processedLogs.summary}`);

	if (processedLogs.timeRange.start && processedLogs.timeRange.end) {
		sections.push(
			`Time range: ${processedLogs.timeRange.start} to ${processedLogs.timeRange.end}`,
		);
	}

	if (processedLogs.uniqueErrors.length > 0) {
		sections.push(
			`\n## Unique Error Types (${processedLogs.uniqueErrors.length}):`,
		);
		processedLogs.uniqueErrors.slice(0, 5).forEach((error, index) => {
			sections.push(
				`${index + 1}. ${error.logger || "Unknown"}: ${error.message || "No message"}`,
			);
			if (error.exception) {
				sections.push(`   Exception: ${error.exception}`);
			}
		});
	}

	if (processedLogs.recentErrors.length > 0) {
		sections.push(
			`\n## Recent Errors (${Math.min(3, processedLogs.recentErrors.length)}):`,
		);
		processedLogs.recentErrors.slice(0, 3).forEach((error, index) => {
			sections.push(
				`${index + 1}. [${error.timestamp || "Unknown time"}] ${error.message || "No message"}`,
			);
		});
	}

	return sections.join("\n");
}

/**
 * Parse Home Assistant error log text into structured log entries.
 */
export function parseErrorLogText(logText: string): LogEntry[] {
  const lines = logText.split("\n").filter((line) => line.trim());
  const logs: LogEntry[] = [];

  for (const line of lines) {
    const match = line.match(
      /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+(\w+)\s+([^:]+):\s*(.+)$/,
    );
    if (match) {
      logs.push({
        timestamp: match[1],
        level: match[2],
        logger: match[3].trim(),
        message: match[4].trim(),
      });
    } else if (line.trim()) {
      logs.push({
        timestamp: new Date().toISOString(),
        level: "INFO",
        logger: "unknown",
        message: line.trim(),
      });
    }
  }

  return logs;
}

/**
 * Extract error information from Home Assistant states.
 */
export function extractErrorsFromStates(states: unknown[]): LogEntry[] {
  const logs: LogEntry[] = [];
  const now = new Date().toISOString();

  if (Array.isArray(states)) {
    for (const state of states) {
      if (
        typeof state === "object" &&
        state !== null &&
        "state" in state &&
        "entity_id" in state
      ) {
        const stateObj = state as {
          state: string;
          entity_id: string;
          last_changed?: string;
        };
        if (stateObj.state === "unavailable" || stateObj.state === "unknown") {
          logs.push({
            timestamp: stateObj.last_changed || now,
            level: "WARNING",
            logger: "entity_state",
            message: `Entity ${stateObj.entity_id} is ${stateObj.state}`,
            source: "state_analysis",
          });
        }
      }
    }
  }

  return logs;
}
