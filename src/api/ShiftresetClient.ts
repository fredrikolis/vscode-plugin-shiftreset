/**
 * HTTP client for the shiftreset.run API.
 *
 * @example Basic usage:
 * ```typescript
 * const client = new ShiftresetClient();
 * const result = await client.check(fileContent);
 *
 * if (result.success) {
 *   console.log('Diagnostics:', result.data.diagnostics);
 * } else {
 *   console.error('Check failed:', result.error);
 * }
 * ```
 *
 * @example With auto-fix:
 * ```typescript
 * const result = await client.check(content, { fix: true });
 * ```
 *
 * @example Format code:
 * ```typescript
 * const result = await client.format(content);
 * if (result.success) {
 *   console.log('Formatted:', result.data.content);
 * }
 * ```
 */

// =============================================================================
// API Constants
// =============================================================================

const API_BASE_URL = "https://shiftreset.run";
const DEFAULT_TIMEOUT_MS = 30000;

// =============================================================================
// Request/Response Types
// =============================================================================

/**
 * Options for configuring the ShiftresetClient.
 */
export interface ShiftresetClientOptions {
  /** Default timeout in milliseconds (optional, defaults to 30000) */
  readonly timeoutMs?: number;
}

/**
 * Options for check endpoint.
 */
export interface CheckOptions {
  /** Return LSP-formatted diagnostics (default: true) */
  readonly lsp?: boolean;
  /** Auto-fix issues (default: false) */
  readonly fix?: boolean;
  /** Apply unsafe fixes (default: false) */
  readonly fixUnsafe?: boolean;
  /** Request timeout in milliseconds (overrides client default) */
  readonly timeoutMs?: number;
  /** AbortSignal for cancellation */
  readonly signal?: AbortSignal;
}

/**
 * Options for format endpoint.
 */
export interface FormatOptions {
  /** Request timeout in milliseconds (overrides client default) */
  readonly timeoutMs?: number;
  /** AbortSignal for cancellation */
  readonly signal?: AbortSignal;
}

/**
 * Options for compliance endpoint.
 */
export interface ComplianceOptions {
  /** Return LSP-formatted diagnostics (default: true) */
  readonly lsp?: boolean;
  /** Specific rules to check */
  readonly select?: string[];
  /** Rules to ignore */
  readonly ignore?: string[];
  /** Filter by severity */
  readonly severity?: string;
  /** Compliance standard */
  readonly standard?: string;
  /** Request timeout in milliseconds (overrides client default) */
  readonly timeoutMs?: number;
  /** AbortSignal for cancellation */
  readonly signal?: AbortSignal;
}

/**
 * Response from check endpoint.
 */
export interface CheckResponse {
  /** Array of diagnostics for the document */
  readonly diagnostics: LspDiagnostic[];
}

/**
 * Response from format endpoint.
 */
export interface FormatResponse {
  /** Formatted content */
  readonly content: string;
}

/**
 * Response from compliance endpoint.
 */
export interface ComplianceResponse {
  /** Array of diagnostics for the document */
  readonly diagnostics: LspDiagnostic[];
}

/**
 * Structured result with success/failure discrimination.
 */
export type ApiResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: ShiftresetApiError };

// =============================================================================
// LSP Diagnostic Types
// =============================================================================

/**
 * Position in a text document (0-indexed).
 * Matches LSP Position interface.
 */
export interface LspPosition {
  /** 0-indexed line number */
  readonly line: number;
  /** 0-indexed character offset */
  readonly character: number;
}

/**
 * Range in a text document.
 * Matches LSP Range interface.
 */
export interface LspRange {
  /** Start position (inclusive) */
  readonly start: LspPosition;
  /** End position (exclusive) */
  readonly end: LspPosition;
}

/**
 * Diagnostic from the linter API.
 * Matches LSP Diagnostic interface.
 *
 * Severity values: 1=Error, 2=Warning, 3=Information, 4=Hint
 */
export interface LspDiagnostic {
  /** Range where the diagnostic applies */
  readonly range: LspRange;
  /** Severity: 1=Error, 2=Warning, 3=Information, 4=Hint */
  readonly severity: 1 | 2 | 3 | 4;
  /** Diagnostic code (e.g., "E001") */
  readonly code?: string | number;
  /** Source of the diagnostic (e.g., "fanuc-tp") */
  readonly source?: string;
  /** Human-readable message */
  readonly message: string;
}

/**
 * Response containing LSP diagnostics from the API.
 */
export interface LspDiagnosticResponse {
  /** Array of diagnostics for the document */
  readonly diagnostics: LspDiagnostic[];
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Client-side error codes.
 */
export type ShiftresetErrorCode =
  | "INVALID_RESPONSE"
  | "NETWORK_ERROR"
  | "ABORTED"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "CLIENT_ERROR";

/**
 * Structured error from the API client.
 */
export class ShiftresetApiError extends Error {
  /** Error code */
  readonly code: ShiftresetErrorCode | string;
  readonly statusCode?: number;

  constructor(
    code: ShiftresetErrorCode | string,
    message: string,
    options?: {
      statusCode?: number;
      cause?: unknown;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = "ShiftresetApiError";
    this.code = code;
    this.statusCode = options?.statusCode;
  }

  /**
   * Check if this error is retriable.
   */
  get isRetriable(): boolean {
    return (
      this.code === "NETWORK_ERROR" ||
      this.code === "RATE_LIMITED" ||
      this.code === "SERVER_ERROR"
    );
  }
}

// =============================================================================
// Client Implementation
// =============================================================================

/**
 * HTTP client for the shiftreset.run API.
 *
 * Provides access to check, format, and compliance endpoints.
 * No authentication required - uses public API.
 */
export class ShiftresetClient {
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;

  constructor(options: ShiftresetClientOptions = {}) {
    this.baseUrl = API_BASE_URL;
    this.defaultTimeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Check file content for syntax errors with optional auto-fix.
   *
   * @param content - The file content to check
   * @param options - Check options (lsp, fix, fixUnsafe, timeout, signal)
   * @returns Structured result with diagnostics
   */
  async check(
    content: string,
    options: CheckOptions = {}
  ): Promise<ApiResult<CheckResponse>> {
    const queryParams: Record<string, string> = {
      lsp: String(options.lsp ?? true),
      fix: String(options.fix ?? false),
      fix_unsafe: String(options.fixUnsafe ?? false),
    };

    return this.makeRequest<CheckResponse>(
      "/check",
      content,
      queryParams,
      {
        timeoutMs: options.timeoutMs,
        signal: options.signal,
      }
    );
  }

  /**
   * Lint file content (backward compatibility wrapper for check).
   *
   * @param content - The file content to lint
   * @param options - Check options (excluding lsp which is always true)
   * @returns Structured result with diagnostics
   */
  async lint(
    content: string,
    options: Omit<CheckOptions, "lsp"> = {}
  ): Promise<ApiResult<CheckResponse>> {
    return this.check(content, { ...options, lsp: true });
  }

  /**
   * Format file content.
   *
   * @param content - The file content to format
   * @param options - Format options (timeout, signal)
   * @returns Structured result with formatted content
   */
  async format(
    content: string,
    options: FormatOptions = {}
  ): Promise<ApiResult<FormatResponse>> {
    return this.makeRequest<FormatResponse>(
      "/format",
      content,
      {},
      {
        timeoutMs: options.timeoutMs,
        signal: options.signal,
      }
    );
  }

  /**
   * Check file content for compliance violations.
   *
   * @param content - The file content to check
   * @param options - Compliance options (lsp, select, ignore, severity, standard, timeout, signal)
   * @returns Structured result with compliance diagnostics
   */
  async compliance(
    content: string,
    options: ComplianceOptions = {}
  ): Promise<ApiResult<ComplianceResponse>> {
    const queryParams: Record<string, string> = {
      lsp: String(options.lsp ?? true),
    };

    if (options.select && options.select.length > 0) {
      queryParams.select = options.select.join(",");
    }
    if (options.ignore && options.ignore.length > 0) {
      queryParams.ignore = options.ignore.join(",");
    }
    if (options.severity) {
      queryParams.severity = options.severity;
    }
    if (options.standard) {
      queryParams.standard = options.standard;
    }

    return this.makeRequest<ComplianceResponse>(
      "/compliance",
      content,
      queryParams,
      {
        timeoutMs: options.timeoutMs,
        signal: options.signal,
      }
    );
  }

  /**
   * Make a generic HTTP request to the API.
   */
  private async makeRequest<T>(
    endpoint: string,
    content: string,
    queryParams: Record<string, string>,
    options: { timeoutMs?: number; signal?: AbortSignal }
  ): Promise<ApiResult<T>> {
    const effectiveTimeout = options.timeoutMs ?? this.defaultTimeoutMs;

    // Build URL with query parameters
    const url = new URL(endpoint, this.baseUrl);
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }

    // Create timeout abort controller
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), effectiveTimeout);

    // Combine with user-provided signal if present
    const combinedSignal = options.signal
      ? this.combineAbortSignals(options.signal, timeoutController.signal)
      : timeoutController.signal;

    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
        body: content,
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      return this.handleResponse<T>(response);
    } catch (error) {
      clearTimeout(timeoutId);
      return { success: false, error: this.handleFetchError(error) };
    }
  }

  /**
   * Process the HTTP response and return a structured result.
   */
  private async handleResponse<T>(response: Response): Promise<ApiResult<T>> {
    // Handle non-OK status codes
    if (!response.ok) {
      return {
        success: false,
        error: this.createHttpError(response.status, response.statusText),
      };
    }

    // Check Content-Type to determine how to parse response
    const contentType = response.headers.get("Content-Type") || "";

    if (contentType.includes("application/json")) {
      // Parse JSON response
      let json: unknown;
      try {
        json = await response.json();
      } catch (error) {
        return {
          success: false,
          error: new ShiftresetApiError(
            "INVALID_RESPONSE",
            "Failed to parse API response as JSON",
            { statusCode: response.status, cause: error }
          ),
        };
      }

      return { success: true, data: json as T };
    } else if (contentType.includes("text/plain")) {
      // Parse plain text response (for format endpoint)
      try {
        const text = await response.text();
        return { success: true, data: { content: text } as T };
      } catch (error) {
        return {
          success: false,
          error: new ShiftresetApiError(
            "INVALID_RESPONSE",
            "Failed to read API response as text",
            { statusCode: response.status, cause: error }
          ),
        };
      }
    } else {
      return {
        success: false,
        error: new ShiftresetApiError(
          "INVALID_RESPONSE",
          `Unexpected Content-Type: ${contentType}`,
          { statusCode: response.status }
        ),
      };
    }
  }

  /**
   * Create an appropriate error based on HTTP status code.
   */
  private createHttpError(status: number, statusText: string): ShiftresetApiError {
    if (status === 429) {
      return new ShiftresetApiError(
        "RATE_LIMITED",
        "Rate limit exceeded. Please try again later.",
        { statusCode: status }
      );
    } else if (status >= 500) {
      return new ShiftresetApiError(
        "SERVER_ERROR",
        `Server error: ${statusText}`,
        { statusCode: status }
      );
    } else if (status >= 400) {
      return new ShiftresetApiError(
        "CLIENT_ERROR",
        `Client error: ${statusText}`,
        { statusCode: status }
      );
    } else {
      return new ShiftresetApiError(
        "INVALID_RESPONSE",
        `Unexpected HTTP status: ${status} ${statusText}`,
        { statusCode: status }
      );
    }
  }

  /**
   * Convert fetch errors into structured API errors.
   */
  private handleFetchError(error: unknown): ShiftresetApiError {
    if (error instanceof Error) {
      // Handle abort (user cancellation or client-side timeout)
      if (error.name === "AbortError") {
        return new ShiftresetApiError(
          "ABORTED",
          "Request was cancelled",
          { cause: error }
        );
      }

      // Handle network errors
      if (
        error.name === "TypeError" ||
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        return new ShiftresetApiError(
          "NETWORK_ERROR",
          "Network error: Unable to reach the API server. Check your internet connection.",
          { cause: error }
        );
      }

      // Generic error
      return new ShiftresetApiError("NETWORK_ERROR", error.message, {
        cause: error,
      });
    }

    // Unknown error type
    return new ShiftresetApiError(
      "NETWORK_ERROR",
      "An unknown error occurred while making the request"
    );
  }

  /**
   * Combine multiple AbortSignals into one.
   */
  private combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason);
        return controller.signal;
      }

      signal.addEventListener(
        "abort",
        () => controller.abort(signal.reason),
        { once: true }
      );
    }

    return controller.signal;
  }
}
