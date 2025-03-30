const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { rimraf } = require('rimraf'); // Use rimraf for robust deletion

const app = express();
const port = process.env.PORT || 3000;
const WORKSPACE_DIR = '/workspace'; // Directory inside the container

app.use(express.json()); // Middleware to parse JSON bodies

// --- Helper Function to Execute Shell Commands ---
function executeCommand(command, options = {}) {
    console.log(`Executing: ${command}`);
    return new Promise((resolve, reject) => {
        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${error.message}`);
                console.error(`Stderr: ${stderr}`);
                // Include stdout in error if present, it might contain useful info
                reject({ error: error.message, stderr, stdout });
                return;
            }
            console.log(`Stdout: ${stdout}`);
            if (stderr) { // Log stderr even if command succeeded (e.g., warnings)
                console.warn(`Stderr: ${stderr}`);
            }
            resolve({ stdout, stderr });
        });
    });
}

// --- API Endpoints ---

// POST /clone
// Clones a Git repository into the workspace
app.post('/clone', async (req, res) => {
    const { repoUrl, branch, projectId } = req.body;

    if (!repoUrl || !projectId) {
        return res.status(400).json({ error: 'Missing required fields: repoUrl, projectId' });
    }

    const projectPath = path.join(WORKSPACE_DIR, projectId);

    try {
        // Clean up existing directory if it exists
        console.log(`Cleaning up existing directory (if any): ${projectPath}`);
        await rimraf(projectPath); // Use rimraf

        // Create the directory structure (needed by git clone)
        // Although git clone creates the final dir, ensuring parent exists is safe.
        // fs.mkdirSync(WORKSPACE_DIR, { recursive: true }); // WORKSPACE_DIR created in Dockerfile

        // Construct git clone command
        let cloneCommand = `git clone --depth 1`;
        if (branch) {
            cloneCommand += ` --branch ${branch}`;
        }
        cloneCommand += ` ${repoUrl} ${projectPath}`; // Clone directly into the target path

        await executeCommand(cloneCommand); // No cwd needed here

        res.status(200).json({ message: `Repository ${repoUrl} cloned successfully into ${projectPath}` });

    } catch (err) {
        console.error('Clone failed:', err);
        res.status(500).json({ error: 'Failed to clone repository', details: err });
    }
});

// POST /test
// Runs Godot tests within a specified project
app.post('/test', async (req, res) => {
    const { projectId, testCommandArgs = [] } = req.body; // e.g., ["--script", "res://test/run_tests.gd"]

    if (!projectId) {
        return res.status(400).json({ error: 'Missing required field: projectId' });
    }
     if (!Array.isArray(testCommandArgs) || testCommandArgs.length === 0) {
        return res.status(400).json({ error: 'Missing or invalid testCommandArgs array' });
    }

    const projectPath = path.join(WORKSPACE_DIR, projectId);

    if (!fs.existsSync(path.join(projectPath, 'project.godot'))) {
         return res.status(404).json({ error: `Project not found or invalid at ${projectPath}` });
    }

    try {
        // Construct Godot command
        // Use --headless for server/CI environments
        // Always use --quit to ensure Godot exits after the script finishes
        // Consider forcing opengl3 rendering driver for compatibility in headless environments
        const godotArgs = [
            '--headless',
            '--rendering-driver opengl3', // Often more reliable in headless/CI
            ...testCommandArgs,
            '--quit' // Ensure Godot exits
        ];
        const command = `godot ${godotArgs.join(' ')}`;

        // Execute command within the project directory
        const result = await executeCommand(command, { cwd: projectPath });

        res.status(200).json({ message: 'Tests executed successfully', output: result });

    } catch (err) {
        console.error('Test execution failed:', err);
        // Send back error details including stdout/stderr if available
        res.status(500).json({ error: 'Failed to execute tests', details: err });
    }
});

// POST /build
// Exports a Godot project build
app.post('/build', async (req, res) => {
    const { projectId, exportPreset, outputName, buildDir = 'build' } = req.body;
    // exportPreset: e.g., "Linux/X11", "Windows Desktop", "Web"
    // outputName: e.g., "mygame" (without extension)
    // buildDir: relative path within the project where build output goes, e.g., "build/linux"

    if (!projectId || !exportPreset || !outputName) {
        return res.status(400).json({ error: 'Missing required fields: projectId, exportPreset, outputName' });
    }

    const projectPath = path.join(WORKSPACE_DIR, projectId);
    const absoluteBuildDir = path.join(projectPath, buildDir);
    const outputPath = path.join(absoluteBuildDir, outputName); // Godot adds extensions automatically

     if (!fs.existsSync(path.join(projectPath, 'project.godot'))) {
         return res.status(404).json({ error: `Project not found or invalid at ${projectPath}` });
    }
     if (!fs.existsSync(path.join(projectPath, 'export_presets.cfg'))) {
         return res.status(400).json({ error: `export_presets.cfg not found in project root: ${projectPath}` });
     }

    try {
        // Ensure the output directory exists inside the project
        console.log(`Ensuring build directory exists: ${absoluteBuildDir}`);
        fs.mkdirSync(absoluteBuildDir, { recursive: true });

        // Construct Godot command
        // Use --headless, --export-release (or --export-debug), and --quit
        // Use quotes around preset name and path in case they contain spaces
        const godotArgs = [
             '--headless',
             '--rendering-driver opengl3', // Safer for headless
             '--export-release', // Or make this configurable (debug vs release)
             `"${exportPreset}"`,
             `"${outputPath}"`,
             '--quit'
        ];
        const command = `godot ${godotArgs.join(' ')}`;

        // Execute command within the project directory
        const result = await executeCommand(command, { cwd: projectPath });

        res.status(200).json({ message: `Build successful for preset "${exportPreset}". Output at: ${outputPath}`, output: result });

    } catch (err) {
        console.error('Build failed:', err);
        res.status(500).json({ error: 'Failed to build project', details: err });
    }
});

// POST /cleanup (Optional but Recommended)
// Removes a cloned project directory
app.post('/cleanup', async (req, res) => {
    const { projectId } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'Missing required field: projectId' });
    }

    const projectPath = path.join(WORKSPACE_DIR, projectId);

    if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: `Project directory not found: ${projectPath}` });
    }

    try {
        console.log(`Attempting to remove directory: ${projectPath}`);
        await rimraf(projectPath); // Use rimraf for robust deletion
        res.status(200).json({ message: `Successfully cleaned up project: ${projectId}` });
    } catch (err) {
        console.error(`Cleanup failed for ${projectId}:`, err);
        res.status(500).json({ error: 'Failed to cleanup project directory', details: err });
    }
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Godot CI server listening on port ${port}`);
    console.log(`Workspace directory: ${WORKSPACE_DIR}`);
    if (!fs.existsSync(WORKSPACE_DIR)) {
        console.warn(`Workspace directory ${WORKSPACE_DIR} does not exist! It should be created by the Dockerfile.`);
    }
});
