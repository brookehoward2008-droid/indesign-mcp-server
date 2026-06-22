/**
 * Windows script execution via Python COM bridge (pywin32).
 * Replaces AppleScript on Windows for InDesign automation.
 */
import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WindowsScriptExecutor {
    /**
     * Execute ExtendScript in InDesign via Python COM bridge.
     * @param {string} script - The ExtendScript/JavaScript to execute
     * @returns {string} The result of the script execution
     */
    static async executeInDesignScript(script) {
        try {
            // Write script to temporary file
            const tempScriptPath = path.join(__dirname, '../../temp_script.jsx');
            fs.writeFileSync(tempScriptPath, script, 'utf8');

            // Execute via Python COM bridge
            const pythonScript = `
import sys, json
try:
    import win32com.client
except ImportError:
    print("ERROR: pywin32 not installed. Run: pip install pywin32", file=sys.stderr)
    sys.exit(1)

PROGIDS = [
    "InDesign.Application",
    "InDesign.Application.CC.2024",
    "InDesign.Application.2024",
    "InDesign.Application.CC.2023",
    "InDesign.Application.2023",
    "InDesign.Application.CC.2022",
    "InDesign.Application.CC.2021",
]

app = None
for progid in PROGIDS:
    try:
        app = win32com.client.Dispatch(progid)
        break
    except Exception:
        continue

if app is None:
    print("ERROR: Could not connect to InDesign. Is it running?", file=sys.stderr)
    sys.exit(1)

try:
    app.ScriptPreferences.UserInteractionLevel = 1699640946  # NEVER_INTERACT
except Exception:
    pass

jsx_path = r"${tempScriptPath.replace(/\\/g, '\\\\')}"
JAVASCRIPT = 1246973031

try:
    result = app.DoScript(jsx_path, JAVASCRIPT)
    if result is not None:
        print(str(result))
    else:
        print("OK")
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`;

            const tempPyPath = path.join(__dirname, '../../temp_executor.py');
            fs.writeFileSync(tempPyPath, pythonScript, 'utf8');

            const result = execFileSync('python', [tempPyPath], {
                encoding: 'utf8',
                timeout: 120000, // 2 minute timeout for long builds
                windowsHide: true,
            });

            // Clean up temp files
            try { fs.unlinkSync(tempScriptPath); } catch (_) {}
            try { fs.unlinkSync(tempPyPath); } catch (_) {}

            return result.trim();
        } catch (error) {
            throw new Error(`InDesign COM execution failed: ${error.message}`);
        }
    }

    /**
     * Execute a .jsx file directly in InDesign.
     * @param {string} jsxPath - Absolute path to the .jsx file
     * @returns {string} Result of execution
     */
    static async executeJsxFile(jsxPath) {
        const pythonCode = `
import sys
try:
    import win32com.client
except ImportError:
    print("ERROR: pywin32 not installed", file=sys.stderr)
    sys.exit(1)

PROGIDS = [
    "InDesign.Application",
    "InDesign.Application.CC.2024",
    "InDesign.Application.2024",
    "InDesign.Application.CC.2023",
    "InDesign.Application.2023",
]

app = None
for progid in PROGIDS:
    try:
        app = win32com.client.Dispatch(progid)
        break
    except Exception:
        continue

if app is None:
    print("ERROR: Could not connect to InDesign", file=sys.stderr)
    sys.exit(1)

try:
    app.ScriptPreferences.UserInteractionLevel = 1699640946
except Exception:
    pass

try:
    result = app.DoScript(r"${jsxPath.replace(/\\/g, '\\\\')}", 1246973031)
    print(str(result) if result else "OK")
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`;

        try {
            const result = execSync(`python -c "${pythonCode.replace(/"/g, '\\"')}"`, {
                encoding: 'utf8',
                timeout: 300000, // 5 min for full builds
                windowsHide: true,
            });
            return result.trim();
        } catch (error) {
            throw new Error(`JSX file execution failed: ${error.message}`);
        }
    }

    /**
     * Check if Windows COM bridge is available.
     * @returns {boolean}
     */
    static isAvailable() {
        try {
            execSync('python -c "import win32com.client; print(\'OK\')"', {
                encoding: 'utf8',
                timeout: 5000,
                windowsHide: true,
            });
            return true;
        } catch (_) {
            return false;
        }
    }
}
