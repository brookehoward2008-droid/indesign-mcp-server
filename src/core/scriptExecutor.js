/**
 * Cross-platform script execution for InDesign.
 * macOS: AppleScript (osascript)
 * Windows: Python COM bridge (pywin32)
 */
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { WindowsScriptExecutor } from './windowsScriptExecutor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_WINDOWS = os.platform() === 'win32';

export class ScriptExecutor {
    /**
     * Execute AppleScript command (macOS only)
     * @param {string} script - The AppleScript to execute
     * @returns {string} The result of the AppleScript execution
     */
    static async executeAppleScript(script) {
        if (IS_WINDOWS) {
            throw new Error('AppleScript is not available on Windows. Use executeInDesignScript() instead.');
        }
        try {
            const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8' });
            return result.trim();
        } catch (error) {
            throw new Error(`AppleScript execution failed: ${error.message}`);
        }
    }

    /**
     * Execute InDesign script (cross-platform).
     * Routes to AppleScript on macOS, COM bridge on Windows.
     * @param {string} script - The ExtendScript to execute
     * @returns {string} The result of the script execution
     */
    static async executeInDesignScript(script) {
        if (IS_WINDOWS) {
            return WindowsScriptExecutor.executeInDesignScript(script);
        }

        // macOS path: AppleScript
        try {
            // Write script to temporary file
            const tempScriptPath = path.join(__dirname, '../../temp_script.jsx');
            fs.writeFileSync(tempScriptPath, script);

            // Execute via AppleScript with persistent session
            const appleScript = `
        tell application "Adobe InDesign 2025"
          activate
          do script POSIX file "${tempScriptPath}" language javascript
        end tell
      `;

            const result = await this.executeAppleScript(appleScript);

            // Clean up temporary file
            try {
                fs.unlinkSync(tempScriptPath);
            } catch (cleanupError) {
                // Ignore cleanup errors
            }

            return result;
        } catch (error) {
            throw new Error(`Error executing tool: ${error.message}`);
        }
    }

    /**
     * Check if InDesign automation is available on this platform.
     * @returns {{ available: boolean, platform: string, method: string }}
     */
    static checkAvailability() {
        if (IS_WINDOWS) {
            const available = WindowsScriptExecutor.isAvailable();
            return {
                available,
                platform: 'windows',
                method: 'COM (pywin32)',
                note: available ? 'Ready' : 'Install pywin32: pip install pywin32',
            };
        } else if (os.platform() === 'darwin') {
            return {
                available: true,
                platform: 'macos',
                method: 'AppleScript (osascript)',
                note: 'Ensure InDesign is running',
            };
        } else {
            return {
                available: false,
                platform: os.platform(),
                method: 'none',
                note: 'InDesign automation requires Windows or macOS',
            };
        }
    }
}
