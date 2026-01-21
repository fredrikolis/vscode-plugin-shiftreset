# shiftreset.run - FANUC TP Support

VS Code extension providing comprehensive FANUC TP (.tp, .ls) language support via the public shiftreset.run API.

## Features

- **Syntax Highlighting** - Full TextMate grammar for FANUC TP
- **Real-time Linting** - Lint on save with inline diagnostics
- **Auto-fix** - Automatically fix syntax errors
- **Code Formatting** - Format code with standard style
- **Compliance Checking** - Validate against coding standards
- **Zero Configuration** - Works immediately after installation

## Installation

### Direct Download (Recommended)

Download the latest release directly:
```bash
curl -L -O https://github.com/fredrikolis/vscode-plugin-shiftreset/releases/latest/download/shiftreset-run.vsix
code --install-extension shiftreset-run.vsix
```

Or visit the [releases page](https://github.com/fredrikolis/vscode-plugin-shiftreset/releases) to download manually.

### From VSIX File in VS Code

1. Download the `.vsix` file from the [releases page](https://github.com/fredrikolis/vscode-plugin-shiftreset/releases)
2. In VS Code, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run "Extensions: Install from VSIX..."
4. Select the downloaded `.vsix` file

### From Marketplace

Search for "shiftreset.run" in the Extensions view (when published).

## Usage

### Linting

Files are automatically linted when saved. View diagnostics in:
- Inline squiggly underlines in the editor
- Problems panel (`Ctrl+Shift+M` / `Cmd+Shift+M`)

**Manual lint:**
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run "shiftreset.run: Lint Current File"

### Auto-fix

**Quick fix via code actions:**
1. Click the lightbulb icon on a diagnostic
2. Select "Fix: [issue description]"

**Manual fix all:**
1. Open Command Palette
2. Run "shiftreset.run: Fix Current File"

**Unsafe fixes:**
Some fixes may be considered "unsafe" (e.g., changing program behavior). To apply these:
1. Open Command Palette
2. Run "shiftreset.run: Fix Current File (Unsafe)"

### Formatting

**Keyboard shortcut:**
- Windows/Linux: `Shift+Alt+F`
- macOS: `Shift+Option+F`

**Manual format:**
1. Open Command Palette
2. Run "shiftreset.run: Format Current File"

**Format on save:**
Enable VSCode's built-in format-on-save setting:
```json
{
  "editor.formatOnSave": true
}
```

### Compliance Checking

Check code against compliance standards:
1. Open Command Palette
2. Run "shiftreset.run: Check Compliance"

Compliance diagnostics appear separately from syntax diagnostics and can be filtered in the Problems panel by source (`fanuc-tp-compliance`).

## Requirements

- **Internet connection** - Extension uses public API at shiftreset.run
- **VS Code 1.85.0 or later**

## Known Limitations

- **Network dependency** - All features require connection to shiftreset.run
- **No offline mode** - Extension cannot function without API access
- **Rate limiting** - Excessive requests may be throttled (debouncing minimizes this)

## Troubleshooting

### No diagnostics appear

1. Verify file has `.tp` or `.ls` extension
2. Check internet connection to https://shiftreset.run
3. Open Output panel (`View` → `Output`) and select "shiftreset.run" for debug logs

### Formatting not working

1. Ensure cursor is in a `.tp` or `.ls` file
2. Try the manual format command first
3. Check Output panel for API errors

### Rate limit errors

The extension debounces save events automatically. If you encounter rate limits:
1. Avoid rapid repeated saves
2. Wait a few seconds before triggering another operation

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
npm test

# Package as VSIX
npx vsce package --out shiftreset-run.vsix
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Creating a Release

```bash
# Bump version and create git tag
./scripts/bump-and-tag.sh

# Push to trigger GitHub Actions release build
git push && git push --tags
```

The GitHub Actions workflow will automatically build and release `shiftreset-run.vsix` to the releases page.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on the [GitHub repository](https://github.com/fredrikolis/vscode-plugin-shiftreset).
