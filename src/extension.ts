import * as vscode from "vscode";
import {
  ShiftresetClient,
  type LspDiagnostic,
} from "./api/ShiftresetClient.js";
import { FANUC_TP_PROVIDER_ID } from "./lsp/lspParser.js";
import { FanucTpInlayHintsProvider } from "./inlayHints.js";

/**
 * Language ID for FANUC TP files.
 */
export const LANGUAGE_ID = "fanuc-tp";

/**
 * Command IDs.
 */
const COMMAND_LINT_FILE = "shiftreset.lintFile";
const COMMAND_FIX_FILE = "shiftreset.fixFile";
const COMMAND_FIX_FILE_UNSAFE = "shiftreset.fixFileUnsafe";
const COMMAND_FORMAT_FILE = "shiftreset.formatFile";
const COMMAND_CHECK_COMPLIANCE = "shiftreset.checkCompliance";

/**
 * Debounce delay in milliseconds for save-triggered linting.
 */
const DEBOUNCE_MS = 500;

/**
 * Output channel for logging debug information.
 */
let outputChannel: vscode.OutputChannel | undefined;

/**
 * Get or create the output channel for logging.
 */
function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("shiftreset.run");
  }
  return outputChannel;
}

/**
 * Log a message to the output channel.
 */
function log(message: string): void {
  const timestamp = new Date().toISOString();
  getOutputChannel().appendLine(`[${timestamp}] ${message}`);
}

/**
 * Map LSP severity number to VS Code DiagnosticSeverity.
 * LSP: 1=Error, 2=Warning, 3=Information, 4=Hint
 */
function mapLspSeverity(severity: 1 | 2 | 3 | 4): vscode.DiagnosticSeverity {
  switch (severity) {
    case 1:
      return vscode.DiagnosticSeverity.Error;
    case 2:
      return vscode.DiagnosticSeverity.Warning;
    case 3:
      return vscode.DiagnosticSeverity.Information;
    case 4:
      return vscode.DiagnosticSeverity.Hint;
    default:
      return vscode.DiagnosticSeverity.Warning;
  }
}

/**
 * Convert an LspDiagnostic to a VS Code Diagnostic.
 * LSP ranges are already 0-indexed, matching VS Code conventions.
 */
function toVscodeDiagnostic(
  lspDiag: LspDiagnostic,
  document: vscode.TextDocument
): vscode.Diagnostic {
  // LSP ranges are already 0-indexed
  const startLine = Math.max(0, Math.min(lspDiag.range.start.line, document.lineCount - 1));
  const endLine = Math.max(0, Math.min(lspDiag.range.end.line, document.lineCount - 1));

  // Get line lengths to clamp character positions
  const startLineText = document.lineAt(startLine).text;
  const endLineText = document.lineAt(endLine).text;

  const startChar = Math.max(0, Math.min(lspDiag.range.start.character, startLineText.length));
  const endChar = Math.max(0, Math.min(lspDiag.range.end.character, endLineText.length));

  const range = new vscode.Range(startLine, startChar, endLine, endChar);

  const diagnostic = new vscode.Diagnostic(
    range,
    lspDiag.message,
    mapLspSeverity(lspDiag.severity)
  );

  if (lspDiag.code !== undefined) {
    diagnostic.code = lspDiag.code;
  }
  diagnostic.source = FANUC_TP_PROVIDER_ID;

  return diagnostic;
}

/**
 * Document symbol provider for FANUC TP programs.
 * Shows program name in outline and breadcrumbs.
 */
class FanucTpSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.DocumentSymbol[] {
    const symbols: vscode.DocumentSymbol[] = [];
    const text = document.getText();

    // Match /PROG followed by program name
    const progRegex = /\/PROG\s+([A-Za-z_][A-Za-z0-9_-]*|-[A-Za-z_][A-Za-z0-9_-]+)/i;
    const match = progRegex.exec(text);

    if (match) {
      const programName = match[1];
      const nameStart = match.index + match[0].indexOf(match[1]);
      const nameEnd = nameStart + programName.length;

      const startPos = document.positionAt(nameStart);
      const endPos = document.positionAt(nameEnd);
      const nameRange = new vscode.Range(startPos, endPos);

      // Full range from /PROG to end of line
      const lineEnd = document.lineAt(startPos.line).range.end;
      const fullRange = new vscode.Range(document.positionAt(match.index), lineEnd);

      const symbol = new vscode.DocumentSymbol(
        programName,
        "Program",
        vscode.SymbolKind.Module,
        fullRange,
        nameRange
      );

      symbols.push(symbol);
    }

    return symbols;
  }
}

/**
 * Manages the extension's linting, fixing, formatting, and compliance checking.
 */
class ExtensionManager implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly diagnosticCollection: vscode.DiagnosticCollection;
  private readonly complianceDiagnosticCollection: vscode.DiagnosticCollection;
  private readonly statusBarItem: vscode.StatusBarItem;
  private readonly pendingLints: Map<string, { timer: NodeJS.Timeout; cancel: vscode.CancellationTokenSource }> = new Map();
  private activeLintCount = 0;
  private readonly client: ShiftresetClient;
  private readonly programNameDecorationType: vscode.TextEditorDecorationType;

  constructor(_context: vscode.ExtensionContext) {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection("shiftreset");
    this.disposables.push(this.diagnosticCollection);

    this.complianceDiagnosticCollection = vscode.languages.createDiagnosticCollection("shiftreset-compliance");
    this.disposables.push(this.complianceDiagnosticCollection);

    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.text = "$(sync~spin) Linting...";
    this.disposables.push(this.statusBarItem);

    this.client = new ShiftresetClient();

    // Yellow background with red text decoration for program name
    this.programNameDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: "#FFD100", // Yellow background
      color: "#C8102E",           // Red text
      fontWeight: "bold",
      borderRadius: "3px",
    });
    this.disposables.push(this.programNameDecorationType);

    this.registerEventHandlers();
    this.registerCommands();
    this.registerProviders();
  }

  /**
   * Lint a document.
   * @param document The document to lint
   * @param tokenSource Optional cancellation token source for external cancellation
   */
  async lintDocument(document: vscode.TextDocument, tokenSource?: vscode.CancellationTokenSource): Promise<void> {
    if (document.languageId !== LANGUAGE_ID) {
      return;
    }

    const ownedTokenSource = tokenSource ?? new vscode.CancellationTokenSource();
    if (!tokenSource) {
      this.disposables.push(ownedTokenSource);
    }

    this.showLintingStatus();
    const documentVersion = document.version;

    try {
      if (ownedTokenSource.token.isCancellationRequested) {
        return;
      }

      const content = document.getText();
      const filename = document.fileName.split(/[/\\]/).pop() ?? "stdin.ls";

      // Create AbortController for cancellation
      const abortController = new AbortController();
      const cancellationListener = ownedTokenSource.token.onCancellationRequested(() => {
        abortController.abort();
      });

      try {
        log(`Linting ${filename} (${content.length} bytes)`);

        const result = await this.client.lint(content, {
          signal: abortController.signal,
        });

        // Check if document version changed during the API call
        if (document.version !== documentVersion) {
          log(`Document version changed during lint, discarding results`);
          return;
        }

        if (!result.success) {
          log(`Lint API error: ${result.error.message} (${result.error.code})`);
          void vscode.window.showErrorMessage(`shiftreset.run: ${result.error.message}`);
          return;
        }

        const { diagnostics } = result.data;
        log(`Parsed ${diagnostics.length} diagnostics from output`);

        const vscodeDiagnostics = diagnostics.map((lspDiag) => toVscodeDiagnostic(lspDiag, document));
        this.diagnosticCollection.set(document.uri, vscodeDiagnostics);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`Unexpected error during lint: ${message}`);
      } finally {
        cancellationListener.dispose();
      }
    } finally {
      this.hideLintingStatus();
      if (!tokenSource) {
        ownedTokenSource.dispose();
      }
    }
  }

  /**
   * Fix issues in a document with optional unsafe fixes.
   * @param document The document to fix
   * @param unsafe Whether to apply unsafe fixes
   */
  async fixDocument(document: vscode.TextDocument, unsafe: boolean = false): Promise<void> {
    if (document.languageId !== LANGUAGE_ID) {
      void vscode.window.showInformationMessage("Current file is not a supported file (.tp or .ls)");
      return;
    }

    const statusMessage = unsafe ? "Fixing (unsafe)..." : "Fixing...";
    this.statusBarItem.text = `$(sync~spin) ${statusMessage}`;
    this.statusBarItem.show();

    try {
      const content = document.getText();
      const filename = document.fileName.split(/[/\\]/).pop() ?? "stdin.ls";

      log(`Fixing ${filename} (unsafe=${unsafe})`);

      const result = await this.client.check(content, {
        fix: true,
        fixUnsafe: unsafe,
      });

      if (!result.success) {
        log(`Fix API error: ${result.error.message} (${result.error.code})`);
        void vscode.window.showErrorMessage(`shiftreset.run: ${result.error.message}`);
        return;
      }

      // Note: The new API doesn't return fixed content directly from /check
      // We need to re-run the check to get the updated diagnostics
      // For now, just show that fixes were attempted and re-lint
      const fixedCount = result.data.diagnostics.length;

      if (fixedCount === 0) {
        void vscode.window.showInformationMessage("No issues to fix");
      } else {
        void vscode.window.showInformationMessage(`Attempted to fix ${fixedCount} issue(s). Re-linting...`);
      }

      // Re-lint to show remaining issues
      await this.lintDocument(document);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Unexpected error during fix: ${message}`);
      void vscode.window.showErrorMessage(`Fix failed: ${message}`);
    } finally {
      this.statusBarItem.hide();
    }
  }

  /**
   * Format a document.
   * @param document The document to format
   * @returns Array of TextEdits to apply
   */
  async formatDocument(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
    if (document.languageId !== LANGUAGE_ID) {
      return [];
    }

    try {
      const content = document.getText();
      const filename = document.fileName.split(/[/\\]/).pop() ?? "stdin.ls";

      log(`Formatting ${filename}`);

      const result = await this.client.format(content);

      if (!result.success) {
        log(`Format API error: ${result.error.message} (${result.error.code})`);
        void vscode.window.showErrorMessage(`shiftreset.run: ${result.error.message}`);
        return [];
      }

      const formattedContent = result.data.content;
      log(`Formatting completed successfully`);

      // Return a full document replacement
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );

      return [vscode.TextEdit.replace(fullRange, formattedContent)];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Unexpected error during format: ${message}`);
      void vscode.window.showErrorMessage(`Format failed: ${message}`);
      return [];
    }
  }

  /**
   * Check compliance for a document.
   * @param document The document to check
   * @param rules Optional specific rules to check
   */
  async checkCompliance(document: vscode.TextDocument, rules?: string[]): Promise<void> {
    if (document.languageId !== LANGUAGE_ID) {
      void vscode.window.showInformationMessage("Current file is not a supported file (.tp or .ls)");
      return;
    }

    this.statusBarItem.text = "$(sync~spin) Checking compliance...";
    this.statusBarItem.show();

    try {
      const content = document.getText();
      const filename = document.fileName.split(/[/\\]/).pop() ?? "stdin.ls";

      log(`Checking compliance for ${filename}`);

      const result = await this.client.compliance(content, {
        select: rules,
      });

      if (!result.success) {
        log(`Compliance API error: ${result.error.message} (${result.error.code})`);
        void vscode.window.showErrorMessage(`shiftreset.run: ${result.error.message}`);
        return;
      }

      const { diagnostics } = result.data;
      log(`Found ${diagnostics.length} compliance issues`);

      // Convert to VS Code diagnostics with compliance source
      const vscodeDiagnostics = diagnostics.map((lspDiag) => {
        const diag = toVscodeDiagnostic(lspDiag, document);
        diag.source = "fanuc-tp-compliance";
        return diag;
      });

      this.complianceDiagnosticCollection.set(document.uri, vscodeDiagnostics);

      if (diagnostics.length === 0) {
        void vscode.window.showInformationMessage("No compliance issues found");
      } else {
        void vscode.window.showInformationMessage(`Found ${diagnostics.length} compliance issue(s)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Unexpected error during compliance check: ${message}`);
      void vscode.window.showErrorMessage(`Compliance check failed: ${message}`);
    } finally {
      this.statusBarItem.hide();
    }
  }

  /**
   * Schedule a debounced lint for a document.
   * Cancels any pending lint for the same document.
   */
  scheduleLint(document: vscode.TextDocument): void {
    const key = document.uri.toString();

    // Cancel any pending lint for this document
    const pending = this.pendingLints.get(key);
    if (pending) {
      clearTimeout(pending.timer);
      pending.cancel.cancel();
      pending.cancel.dispose();
    }

    // Create new cancellation token for this lint
    const cancel = new vscode.CancellationTokenSource();

    // Schedule new debounced lint
    const timer = setTimeout(() => {
      this.pendingLints.delete(key);
      void this.lintDocument(document, cancel);
    }, DEBOUNCE_MS);

    this.pendingLints.set(key, { timer, cancel });
  }

  /**
   * Show the status bar item indicating linting is in progress.
   */
  private showLintingStatus(): void {
    this.activeLintCount++;
    this.statusBarItem.show();
  }

  /**
   * Hide the status bar item when linting completes.
   */
  private hideLintingStatus(): void {
    this.activeLintCount--;
    if (this.activeLintCount <= 0) {
      this.activeLintCount = 0;
      this.statusBarItem.hide();
    }
  }

  /**
   * Clear diagnostics for a document.
   */
  clearDiagnostics(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
    this.complianceDiagnosticCollection.delete(uri);
  }

  /**
   * Find program name in document and return its range.
   */
  private findProgramName(document: vscode.TextDocument): vscode.Range | null {
    const text = document.getText();

    // Match /PROG followed by program name
    const progRegex = /\/PROG\s+([A-Za-z_][A-Za-z0-9_-]*|-[A-Za-z_][A-Za-z0-9_-]+)/i;
    const match = progRegex.exec(text);

    if (match) {
      // Get the position of the program name (capture group 1)
      const nameStart = match.index + match[0].indexOf(match[1]);
      const nameEnd = nameStart + match[1].length;

      const startPos = document.positionAt(nameStart);
      const endPos = document.positionAt(nameEnd);
      return new vscode.Range(startPos, endPos);
    }

    return null;
  }

  /**
   * Apply decorations to program name in an editor.
   */
  private decorateProgramName(editor: vscode.TextEditor): void {
    const document = editor.document;
    if (document.languageId !== LANGUAGE_ID) {
      return;
    }

    const range = this.findProgramName(document);
    if (range) {
      editor.setDecorations(this.programNameDecorationType, [{ range }]);
    } else {
      editor.setDecorations(this.programNameDecorationType, []);
    }
  }

  /**
   * Update decorations for all visible editors.
   */
  updateAllDecorations(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.languageId === LANGUAGE_ID) {
        this.decorateProgramName(editor);
      }
    }
  }

  private registerEventHandlers(): void {
    // Lint on document save with debounce
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId === LANGUAGE_ID) {
          this.scheduleLint(document);
        }
      })
    );

    // Clear diagnostics and cancel pending lints when document closes
    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument((document) => {
        // Cancel any pending lint for this document
        const key = document.uri.toString();
        const pending = this.pendingLints.get(key);
        if (pending) {
          clearTimeout(pending.timer);
          pending.cancel.cancel();
          pending.cancel.dispose();
          this.pendingLints.delete(key);
        }
        this.clearDiagnostics(document.uri);
      })
    );

    // Update decorations when active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.languageId === LANGUAGE_ID) {
          this.decorateProgramName(editor);
        }
      })
    );

    // Update decorations when document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document && editor.document.languageId === LANGUAGE_ID) {
          this.decorateProgramName(editor);
        }
      })
    );

    // Update decorations when visible editors change
    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors(() => {
        this.updateAllDecorations();
      })
    );
  }

  /**
   * Register VSCode providers.
   */
  private registerProviders(): void {
    // Document symbol provider (shows program name in outline/breadcrumbs)
    this.disposables.push(
      vscode.languages.registerDocumentSymbolProvider(
        LANGUAGE_ID,
        new FanucTpSymbolProvider()
      )
    );

    // Document formatting provider
    this.disposables.push(
      vscode.languages.registerDocumentFormattingEditProvider(
        LANGUAGE_ID,
        {
          provideDocumentFormattingEdits: async (document) => {
            return this.formatDocument(document);
          }
        }
      )
    );

    // Inlay hints provider
    this.disposables.push(
      vscode.languages.registerInlayHintsProvider(
        LANGUAGE_ID,
        new FanucTpInlayHintsProvider()
      )
    );

    // Code action provider for quick fixes
    this.disposables.push(
      vscode.languages.registerCodeActionsProvider(
        LANGUAGE_ID,
        {
          provideCodeActions: async (_document, _range, context) => {
            const actions: vscode.CodeAction[] = [];

            // Provide fix actions for diagnostics
            for (const diagnostic of context.diagnostics) {
              if (diagnostic.source === FANUC_TP_PROVIDER_ID) {
                const action = new vscode.CodeAction(
                  `Fix: ${diagnostic.message}`,
                  vscode.CodeActionKind.QuickFix
                );
                action.command = {
                  command: COMMAND_FIX_FILE,
                  title: 'Fix issue',
                };
                action.diagnostics = [diagnostic];
                actions.push(action);
              }
            }

            return actions;
          }
        }
      )
    );
  }

  /**
   * Register extension commands.
   */
  private registerCommands(): void {
    // Manual lint command
    this.disposables.push(
      vscode.commands.registerCommand(COMMAND_LINT_FILE, async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          void vscode.window.showInformationMessage("No active editor");
          return;
        }

        const document = editor.document;
        if (document.languageId !== LANGUAGE_ID) {
          void vscode.window.showInformationMessage("Current file is not a supported file (.tp or .ls)");
          return;
        }

        // Cancel any pending lint and run immediately
        const key = document.uri.toString();
        const pending = this.pendingLints.get(key);
        if (pending) {
          clearTimeout(pending.timer);
          pending.cancel.cancel();
          pending.cancel.dispose();
          this.pendingLints.delete(key);
        }

        await this.lintDocument(document);
      })
    );

    // Fix file command
    this.disposables.push(
      vscode.commands.registerCommand(COMMAND_FIX_FILE, async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          void vscode.window.showInformationMessage("No active editor");
          return;
        }

        await this.fixDocument(editor.document, false);
      })
    );

    // Fix file (unsafe) command
    this.disposables.push(
      vscode.commands.registerCommand(COMMAND_FIX_FILE_UNSAFE, async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          void vscode.window.showInformationMessage("No active editor");
          return;
        }

        await this.fixDocument(editor.document, true);
      })
    );

    // Format file command
    this.disposables.push(
      vscode.commands.registerCommand(COMMAND_FORMAT_FILE, async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          void vscode.window.showInformationMessage("No active editor");
          return;
        }

        const document = editor.document;
        if (document.languageId !== LANGUAGE_ID) {
          void vscode.window.showInformationMessage("Current file is not a supported file (.tp or .ls)");
          return;
        }

        const edits = await this.formatDocument(document);
        if (edits.length > 0) {
          const workspaceEdit = new vscode.WorkspaceEdit();
          workspaceEdit.set(document.uri, edits);
          await vscode.workspace.applyEdit(workspaceEdit);
        }
      })
    );

    // Check compliance command
    this.disposables.push(
      vscode.commands.registerCommand(COMMAND_CHECK_COMPLIANCE, async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          void vscode.window.showInformationMessage("No active editor");
          return;
        }

        await this.checkCompliance(editor.document);
      })
    );
  }

  dispose(): void {
    // Cancel all pending lints
    for (const pending of this.pendingLints.values()) {
      clearTimeout(pending.timer);
      pending.cancel.cancel();
      pending.cancel.dispose();
    }
    this.pendingLints.clear();

    // Dispose output channel
    if (outputChannel) {
      outputChannel.dispose();
      outputChannel = undefined;
    }

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }
}

let extensionManager: ExtensionManager | undefined;

/**
 * Activate the extension.
 */
export function activate(context: vscode.ExtensionContext): void {
  extensionManager = new ExtensionManager(context);
  context.subscriptions.push(extensionManager);

  // Lint and decorate any already-open documents
  for (const document of vscode.workspace.textDocuments) {
    if (document.languageId === LANGUAGE_ID) {
      void extensionManager.lintDocument(document);
    }
  }

  // Apply decorations to visible editors
  extensionManager.updateAllDecorations();
}

/**
 * Deactivate the extension.
 */
export function deactivate(): void {
  extensionManager?.dispose();
  extensionManager = undefined;
}

/**
 * Get the extension manager instance for testing.
 */
export function getExtensionManager(): ExtensionManager | undefined {
  return extensionManager;
}
