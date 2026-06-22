/**
 * Production Handlers - Handoff package building and batch production tools.
 * Windows-specific: Uses Python COM bridge for full automation.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { ScriptExecutor } from '../core/scriptExecutor.js';
import { isOneDrivePath, getSafeOutputDir, validateNotOneDrive } from '../core/windowsScriptExecutor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IS_WINDOWS = os.platform() === 'win32';

export class ProductionHandlers {
    /**
     * Build InDesign document from a handoff package (manifest + CSV + PNGs).
     * Generates a JSX and optionally executes it in InDesign.
     */
    static async buildHandoff(args) {
        const { handoffDir, executeInIndesign = true } = args;

        if (!handoffDir) {
            return { content: [{ type: 'text', text: 'ERROR: handoffDir is required (path to the unzipped handoff package folder)' }] };
        }

        if (!fs.existsSync(handoffDir)) {
            return { content: [{ type: 'text', text: `ERROR: handoffDir not found: ${handoffDir}` }] };
        }

        // Check for manifest
        const manifestPath = path.join(handoffDir, 'master_production_manifest.json');
        if (!fs.existsSync(manifestPath)) {
            return { content: [{ type: 'text', text: `ERROR: No master_production_manifest.json found in ${handoffDir}` }] };
        }

        if (!IS_WINDOWS) {
            return { content: [{ type: 'text', text: 'ERROR: build_handoff requires Windows with InDesign and pywin32 installed.' }] };
        }

        // Look for build_from_handoff.py in known locations
        const possiblePaths = [
            path.join(__dirname, '../../python/build_from_handoff.py'),
            path.join(__dirname, '../../scripts/build_from_handoff.py'),
        ];

        let buildScript = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                buildScript = p;
                break;
            }
        }

        if (!buildScript) {
            return { content: [{ type: 'text', text: 'ERROR: build_from_handoff.py not found. Place it in the python/ or scripts/ directory.' }] };
        }

        try {
            // Step 1: Generate JSX
            const genResult = execSync(
                `python "${buildScript}" "${handoffDir}"`,
                { encoding: 'utf8', timeout: 60000, windowsHide: true }
            );

            if (!executeInIndesign) {
                return { content: [{ type: 'text', text: `JSX generated successfully.\n${genResult}` }] };
            }

            // Step 2: Find the generated JSX
            const repoRoot = path.resolve(__dirname, '../../');
            const jsxPath = path.join(repoRoot, 'visceral-production-route', 'templates', 'indesign-handoff-build.jsx');

            if (!fs.existsSync(jsxPath)) {
                return { content: [{ type: 'text', text: `JSX generation reported success but file not found at: ${jsxPath}\n${genResult}` }] };
            }

            // Step 3: Execute in InDesign via COM
            const comScript = `
import sys, time
import win32com.client

PROGIDS = ["InDesign.Application", "InDesign.Application.CC.2024", "InDesign.Application.2024",
           "InDesign.Application.CC.2023", "InDesign.Application.2023"]

app = None
for progid in PROGIDS:
    try:
        app = win32com.client.Dispatch(progid)
        break
    except Exception:
        continue

if app is None:
    print("ERROR: Could not connect to InDesign")
    sys.exit(1)

try:
    app.ScriptPreferences.UserInteractionLevel = 1699640946
except Exception:
    pass

start = time.time()
try:
    app.DoScript(r"${jsxPath.replace(/\\/g, '\\\\')}", 1246973031)
    elapsed = time.time() - start
    print(f"Build complete in {elapsed:.1f}s")
except Exception as e:
    print(f"ERROR executing JSX: {e}")
    sys.exit(1)
`;
            const tempPy = path.join(repoRoot, 'temp_handoff_build.py');
            fs.writeFileSync(tempPy, comScript, 'utf8');

            const buildResult = execSync(`python "${tempPy}"`, {
                encoding: 'utf8',
                timeout: 300000,
                windowsHide: true,
            });

            try { fs.unlinkSync(tempPy); } catch (_) {}

            return { content: [{ type: 'text', text: `Handoff build executed in InDesign.\n${genResult}\n${buildResult}` }] };

        } catch (error) {
            return { content: [{ type: 'text', text: `ERROR during handoff build: ${error.message}` }] };
        }
    }

    /**
     * Get production status — check InDesign connection + document state.
     */
    static async getProductionStatus(args) {
        const status = ScriptExecutor.checkAvailability();

        let docInfo = 'Not connected';
        if (status.available && IS_WINDOWS) {
            try {
                const result = execSync(`python -c "
import win32com.client, json
app = win32com.client.Dispatch('InDesign.Application')
if app.Documents.Count == 0:
    print(json.dumps({'status': 'connected', 'documents': 0}))
else:
    doc = app.ActiveDocument
    print(json.dumps({
        'status': 'connected',
        'documents': app.Documents.Count,
        'active_document': doc.Name,
        'pages': doc.Pages.Count,
        'saved': doc.Saved
    }))
"`, { encoding: 'utf8', timeout: 10000, windowsHide: true });
                docInfo = result.trim();
            } catch (e) {
                docInfo = `Connection test failed: ${e.message}`;
            }
        }

        const info = {
            platform: status.platform,
            method: status.method,
            available: status.available,
            note: status.note,
            indesign: docInfo,
        };

        return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
    }

    /**
     * List available handoff packages in a directory.
     */
    static async listHandoffPackages(args) {
        const { searchDir } = args;
        if (!searchDir || !fs.existsSync(searchDir)) {
            return { content: [{ type: 'text', text: 'ERROR: searchDir is required and must exist.' }] };
        }

        const results = [];
        const entries = fs.readdirSync(searchDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const manifest = path.join(searchDir, entry.name, 'master_production_manifest.json');
                if (fs.existsSync(manifest)) {
                    const data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
                    results.push({
                        name: entry.name,
                        path: path.join(searchDir, entry.name),
                        pages: data.pages?.length || 'unknown',
                        title: data.title || data.project_title || entry.name,
                    });
                }
            }
        }

        if (results.length === 0) {
            return { content: [{ type: 'text', text: `No handoff packages found in ${searchDir}` }] };
        }

        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
}
