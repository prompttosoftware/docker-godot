# Simple run (builds stay inside the container)
docker run -d -p 3000:3000 --name godot-runner godot-node-controller

# Run with export templates mounted from host (adjust host path as needed)
# Assumes templates for the specific Godot version are at the host path
# Note: The path inside the container corresponds to the 'node' user's home
docker run -d -p 3000:3000 \
  -v "$HOME/.local/share/godot/export_templates:/home/node/.local/share/godot/export_templates" \
  --name godot-runner godot-node-controller