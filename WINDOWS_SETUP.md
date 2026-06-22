# Windows Setup Guide

This MCP server now supports Windows via Python COM bridge (pywin32) in addition to the original macOS AppleScript approach.

## Prerequisites

- **Windows 10/11**
- **Adobe InDesign 2021+** (installed and licensed)
- **Python 3.9+** (you have 3.14)
- **Node.js 18+** (you have 22)

## Quick Setup

```powershell
cd C:\Users\toddl\OneDrive\Documents\GitHub\indesign-mcp-server

# Install Node dependencies
npm install

# Install Python dependencies (for COM bridge + standalone server)
pip install pywin32 mcp pillow

# Register MCP server with Claude Code
$configDir = "$env:APPDATA\Claude"
if (!(Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir }
@'
{
  "mcpServers": {
    "indesign": {
      "command": "node",
      "args": ["C:/Users/toddl/OneDrive/Documents/GitHub/indesign-mcp-server/src/index.js"]
    }
  }
}
'@ | Out-File "$configDir\claude_desktop_config.json" -Encoding UTF8
```

## Two Server Options

### Option 1: Node.js Server (full 135+ tools)

The main server with all document, text, graphics, style, export, and production tools:

```powershell
node src/index.js
```

### Option 2: Python Standalone Server (lightweight, Ollama-friendly)

A simpler Python-only MCP server with 11 core tools. Works with Open Interpreter + Ollama for unlimited local use:

```powershell
python python/indesign_mcp_server.py
```

## Using with Claude Code

After setup, restart Claude Code. Then:

```
"Check production status"         → get_production_status
"Build handoff from C:\path\to\pkg"  → build_handoff
"Create a new A4 document"        → create_document
"Place image on page 3"           → place_image
"Export to PDF"                    → export_pdf
```

## Using with Ollama (unlimited, no cloud)

```powershell
pip install open-interpreter
interpreter --model ollama/qwen3-coder:30b
```

Then tell it to run InDesign commands:
```
"Run this in InDesign: app.activeDocument.pages.length"
→ python -c "import win32com.client; app = win32com.client.Dispatch('InDesign.Application'); print(app.DoScript('app.activeDocument.pages.length', 1246973031))"
```

## How It Works

```
[Claude Code / Ollama Agent]
        ↓ (MCP protocol over stdio)
[Node.js MCP Server OR Python MCP Server]
        ↓ (platform detection)
[Windows: Python COM via pywin32]  OR  [macOS: AppleScript]
        ↓
[Adobe InDesign]
```

## Handoff Package Builder

Place your handoff package (the folder with `master_production_manifest.json`) anywhere. Then ask the agent:

```
"Build the handoff from C:\Users\toddl\Desktop\handoff_package_final"
```

This generates a JSX with exact coordinates for all 50 pages and executes it in InDesign.
