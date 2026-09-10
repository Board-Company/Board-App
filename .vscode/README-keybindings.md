# Optional: Cmd+Option+B -> Board stack

VS Code/Cursor does not load workspace keybinding files automatically. To run **Board Stack: Redis + open services (iOS)** with **Cmd+Option+B**:

1. **Command Palette** → **Preferences: Open Keyboard Shortcuts (JSON)**.
2. Add this object inside the **outer JSON array** (comma after the previous entry if needed):

```json
  {
    "key": "cmd+alt+b",
    "command": "workbench.action.tasks.runTask",
    "args": "Board Stack: Redis + open services (iOS)"
  }
```

The task also remains the default **Run Build Task**, but Cursor may reserve **Cmd+Shift+B** for browser-related commands depending on your setup. The snippet above gives the Board stack its own shortcut.
