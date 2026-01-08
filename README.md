# Restore Terminals

Automatically open terminal windows, split them, and run commands when VS Code starts.

## Features

- 🚀 Auto-restore terminals on VS Code startup
- 📑 Split terminals in any configuration
- 🎯 Multiple presets to choose from
- ☑️ Optional checkbox prompt to select which terminals to open
- 🔄 Smart terminal replacement (no duplicates)

---

## Quick Start

Add this to your VS Code `settings.json`:

```json
"restoreTerminals.terminals": [
  {
    "splitTerminals": [
      { "name": "server", "commands": ["npm run dev"] },
      { "name": "client", "commands": ["npm run client"] }
    ]
  }
]
```

This creates one terminal window with two split panes: "server" and "client".

---

## Configuration Examples

### Basic: Single Terminal

```json
"restoreTerminals.terminals": [
  {
    "splitTerminals": [
      { "name": "dev", "commands": ["npm run dev"] }
    ]
  }
]
```

### Multiple Terminal Windows with Splits

```json
"restoreTerminals.terminals": [
  {
    "splitTerminals": [
      { "name": "server", "commands": ["npm run dev"] },
      { "name": "client", "commands": ["npm run client"] }
    ]
  },
  {
    "splitTerminals": [
      { "name": "tests", "commands": ["npm test -- --watch"] }
    ]
  }
]
```

This creates:

- **Window 1**: "server" | "client" (split)
- **Window 2**: "tests"

### Presets: Switch Between Configurations

Use an object instead of an array to define named presets. You'll be prompted to choose one when restoring:

```json
"restoreTerminals.terminals": {
  "dev": [
    {
      "splitTerminals": [
        { "name": "server", "commands": ["npm run dev"] },
        { "name": "logs", "commands": ["npm run logs"] }
      ]
    }
  ],
  "test": [
    {
      "splitTerminals": [
        { "name": "test", "commands": ["npm test"] }
      ]
    }
  ]
}
```

### Presets with Per-Preset Settings

Wrap your terminals in an object to add preset-specific settings like `keepExistingTerminalsOpen`:

```json
"restoreTerminals.terminals": {
  "dev": {
    "keepExistingTerminalsOpen": false,
    "terminals": [
      {
        "splitTerminals": [
          { "name": "server", "commands": ["npm run dev"] }
        ]
      }
    ]
  },
  "add-logs": {
    "keepExistingTerminalsOpen": true,
    "terminals": [
      {
        "splitTerminals": [
          { "name": "logs", "commands": ["npm run logs"] }
        ]
      }
    ]
  }
}
```

### Checkbox Selection

Add `defaultSelected` to any terminal to enable a checkbox prompt, letting you choose which terminals to open:

```json
"restoreTerminals.terminals": [
  {
    "defaultSelected": true,
    "splitTerminals": [
      { "name": "server", "commands": ["npm run dev"] }
    ]
  },
  {
    "defaultSelected": false,
    "splitTerminals": [
      { "name": "e2e", "commands": ["npm run e2e"] }
    ]
  }
]
```

---

## Settings Reference

| Setting                                        | Type            | Default | Description                                      |
| ---------------------------------------------- | --------------- | ------- | ------------------------------------------------ |
| `restoreTerminals.terminals`                   | array \| object | —       | Terminal configuration (see examples above)      |
| `restoreTerminals.runOnStartup`                | boolean         | `true`  | Restore terminals when VS Code starts            |
| `restoreTerminals.keepExistingTerminalsOpen`   | boolean         | `false` | Keep existing terminals open when restoring      |
| `restoreTerminals.artificialDelayMilliseconds` | number          | `150`   | Delay between operations (increase if glitching) |

### Terminal Options

| Property            | Type     | Description                                                           |
| ------------------- | -------- | --------------------------------------------------------------------- |
| `name`              | string   | Terminal display name                                                 |
| `commands`          | string[] | Commands to run on open                                               |
| `shouldRunCommands` | boolean  | If `false`, paste commands without running (default: `true`)          |
| `setAsActive`       | boolean  | Make this the focused terminal after restore                          |
| `defaultSelected`   | boolean  | Pre-select in checkbox prompt (enables prompt if set on any terminal) |

---

## How `keepExistingTerminalsOpen` Works

| Value             | Behavior                                                             |
| ----------------- | -------------------------------------------------------------------- |
| `false` (default) | Close **all** existing terminals, then create new ones               |
| `true`            | Only close terminals with the **same name** as new ones, keep others |

This prevents duplicate terminals while preserving unrelated ones.

---

## Tips

- **Manual trigger**: Run `Restore Terminals` from the Command Palette
- **Custom config file**: Create `.vscode/restore-terminals.json` in your workspace (takes priority over settings.json)
- **Glitching?**: Increase `artificialDelayMilliseconds` to `500` or `1000`
- **No splits?**: Just put one item in the `splitTerminals` array

---

## Credits

- Original extension: [EthanSK](https://github.com/EthanSK/restore-terminals-vscode)
- Active window feature: [Gharsnull](https://github.com/Gharsnull/restore-terminals-vscode/tree/feature/select-active-window)
