# docker-godot

This project provides a Dockerized Node.js Express application that exposes an API to control headless Godot Engine operations, such as cloning Git repositories, running tests, and exporting builds.

It uses an official Node.js base image and installs the specified Godot Engine editor (headless capable) version along with necessary dependencies like Git and Mesa OpenGL libraries for software rendering.

## Features

*   **Dockerized:** Runs in an isolated container.
*   **API Controlled:** Manage Godot tasks via simple HTTP endpoints.
*   **Git Integration:** Clone specific branches of Godot projects from Git repositories.
*   **Headless Testing:** Execute Godot test scripts (e.g., using GUT) via the API.
*   **Headless Builds:** Export Godot projects using specified presets via the API.
*   **Configurable Godot Version:** Easily change the Godot version used in the container at build time.
*   **Non-Root User:** Runs the Node.js application as a non-root user for better security.

## Prerequisites

*   **Docker:** You need Docker installed and running on your machine. [Install Docker](https://docs.docker.com/engine/install/)

## Setup & Build

1.  **Clone the repository (or create the files):** Ensure you have `Dockerfile`, `server.js`, `package.json`, and `.gitignore` in your project directory.
2.  **Build the Docker Image:** Open a terminal in the project directory and run:

    ```bash
    # Build with the default Godot version (check Dockerfile ARG)
    docker build -t godot-node-controller .

    # Or build with a specific Godot version
    docker build --build-arg GODOT_VERSION=4.1.3 -t godot-node-controller:4.1.3 .
    ```

## Running the Container

You need to map the container's port (default: 3000) to a host port. For the `/build` endpoint to work, you **must** mount your Godot export templates into the container.

```bash
# Run in detached mode, mapping port 3000
# Mount export templates from your host (adjust host path if necessary)
# This example assumes templates are in $HOME/.local/share/godot/export_templates
# The container path maps to the non-root 'node' user's expected location

docker run -d \
  -p 3000:3000 \
  -v "$HOME/.local/share/godot/export_templates:/home/node/.local/share/godot/export_templates" \
  --name godot-runner \
  godot-node-controller

# Verify the container is running
docker ps
