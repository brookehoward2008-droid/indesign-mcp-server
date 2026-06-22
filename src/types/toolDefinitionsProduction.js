/**
 * Production tool definitions for handoff package building.
 */
export const productionToolDefinitions = [
    {
        name: 'build_handoff',
        description: 'Build an InDesign document from a production handoff package (manifest JSON + CSV + PNG assets). Generates the JSX and executes it in InDesign via COM. Windows only.',
        inputSchema: {
            type: 'object',
            properties: {
                handoffDir: {
                    type: 'string',
                    description: 'Absolute path to the unzipped handoff package folder containing master_production_manifest.json, production_layout_instructions.csv, and an assets/ subfolder with PNG files.',
                },
                executeInIndesign: {
                    type: 'boolean',
                    description: 'If true (default), generates the JSX AND executes it in InDesign. If false, only generates the JSX file.',
                    default: true,
                },
            },
            required: ['handoffDir'],
        },
    },
    {
        name: 'get_production_status',
        description: 'Check the InDesign automation status: platform, connection method (COM/AppleScript), whether InDesign is reachable, and current document state.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'list_handoff_packages',
        description: 'Scan a directory for handoff packages (folders containing master_production_manifest.json). Returns package names, paths, page counts, and titles.',
        inputSchema: {
            type: 'object',
            properties: {
                searchDir: {
                    type: 'string',
                    description: 'Directory to scan for handoff package subfolders.',
                },
            },
            required: ['searchDir'],
        },
    },
];
