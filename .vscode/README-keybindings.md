# Optional: Cmd+Shift+R → Board stack

VS Code/Cursor does not load workspace keybinding files automatically. To run **Board Stack: Redis + open services** with **Cmd+Shift+R**:

1. **Command Palette** → **Preferences: Open Keyboard Shortcuts (JSON)**.
2. Add this object inside the **outer JSON array** (comma after the previous entry if needed):

```json
  {
    "key": "cmd+shift+r",
    "command": "workbench.action.tasks.runTask",
    "args": "Board Stack: Redis + open services"
  }
```

The default **Run Build Task** (**Cmd+Shift+B**) is set in `tasks.json` to **Board Stack: Redis + open services** (Docker Compose Redis, then Terminal tabs). If **Cmd+Shift+R** still does something else (e.g. reload), the snippet above overrides it for this workspace’s keybindings file only when you add it yourself.
