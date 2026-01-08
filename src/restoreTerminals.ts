import * as vscode from "vscode";
import { delay } from "./utils";
import { Configuration, Preset, TerminalWindow, isPresetObject } from "./model";

const DEFAULT_ARTIFICAL_DELAY = 300;
const SPLIT_TERM_CHECK_DELAY = 100;
const MAX_TERM_CHECK_ATTEMPTS = 500; //this times SPLIT_TERM_CHECK_DELAY is the timeout

export default async function restoreTerminals(configuration: Configuration) {
  console.log("restoring terminals", configuration);
  let {
    keepExistingTerminalsOpen,
    artificialDelayMilliseconds,
    terminalWindows,
  } = configuration;
  let activeWindow = null;

  if (!terminalWindows) {
    // vscode.window.showInformationMessage("No terminal window configuration provided to restore terminals with.") //this might be annoying
    return;
  }

  if (!(terminalWindows instanceof Array) && terminalWindows !== null) {
    terminalWindows = new Map(Object.entries(terminalWindows)) as Map<
      string,
      TerminalWindow[] | Preset
    >;
    if (!terminalWindows.size) {
      vscode.window.showInformationMessage(
        "Empty terminal window configuration provided to restore terminals with."
      ); //this might be annoying
      return;
    }

    let selectedPreset: TerminalWindow[] | Preset | undefined;
    if (terminalWindows.size > 1) {
      const picked = await vscode.window.showQuickPick(
        Array.from(terminalWindows.keys())
      );
      if (!picked) {
        return;
      }
      selectedPreset = terminalWindows.get(picked);
    } else {
      selectedPreset = Array.from(terminalWindows.values())[0];
    }

    // Handle both legacy array format and new Preset object format
    if (selectedPreset && isPresetObject(selectedPreset)) {
      // New format: preset is an object with optional keepExistingTerminalsOpen
      // Preset-level setting overrides global setting
      if (selectedPreset.keepExistingTerminalsOpen !== undefined) {
        keepExistingTerminalsOpen = selectedPreset.keepExistingTerminalsOpen;
      }
      terminalWindows = selectedPreset.terminals;
    } else {
      // Legacy format: preset is just an array of TerminalWindow
      terminalWindows = selectedPreset ?? [];
    }
  }

  if (!terminalWindows.length) {
    vscode.window.showInformationMessage(
      "Empty terminal window configuration provided to restore terminals with."
    ); //this might be annoying
    return;
  }

  // Handle checkbox selection FIRST (before disposal)
  if (
    terminalWindows.some(
      (terminalWindow) => terminalWindow.defaultSelected != null
    )
  ) {
    const enumartedTerminalWindows: Map<number, TerminalWindow> = new Map(
      terminalWindows.map((terminalWindow, index) => [index, terminalWindow])
    );

    terminalWindows = (await promptForCheckboxes(enumartedTerminalWindows)).map(
      (index) => enumartedTerminalWindows.get(index) as TerminalWindow
    );
  }

  // Collect terminal names from the SELECTED terminals (after checkbox filtering)
  const terminalNamesToCreate = new Set<string>();
  for (const terminalWindow of terminalWindows) {
    if (terminalWindow.splitTerminals) {
      for (const splitTerminal of terminalWindow.splitTerminals) {
        if (splitTerminal.name) {
          terminalNamesToCreate.add(splitTerminal.name);
        }
      }
    }
  }

  if (!keepExistingTerminalsOpen) {
    // Close all existing terminals
    vscode.window.terminals.forEach((terminal) => {
      console.log(`Disposing terminal ${terminal.name}`);
      terminal.dispose();
    });
  } else {
    // keepExistingTerminalsOpen is true - only close terminals with same names as new ones
    // This ensures we don't have duplicate terminal names
    vscode.window.terminals.forEach((terminal) => {
      if (terminalNamesToCreate.has(terminal.name)) {
        console.log(`Disposing terminal with duplicate name: ${terminal.name}`);
        terminal.dispose();
      }
    });
  }
  await delay(artificialDelayMilliseconds ?? DEFAULT_ARTIFICAL_DELAY); //without delay it starts bugging out

  let commandsToRunInTerms: {
    commands: string[];
    shouldRunCommands: boolean;
    terminal: vscode.Terminal;
  }[] = [];

  for (const terminalWindow of terminalWindows) {
    if (!terminalWindow.splitTerminals) {
      // vscode.window.showInformationMessage("No split terminal configuration provided to restore terminals with.") //this might be annoying
      return;
    }

    let term!: vscode.Terminal;
    let name = terminalWindow.splitTerminals[0]?.name;

    term = vscode.window.createTerminal({
      name: name,
      // cwd: vscode.window.activeTextEditor?.document.uri.fsPath, //i think this happens by default
    });

    term.show();

    //the first terminal split is already created from when we called createTerminal
    if (terminalWindow.splitTerminals.length > 0) {
      const { commands, shouldRunCommands } = terminalWindow.splitTerminals[0];
      commands &&
        commandsToRunInTerms.push({
          commands,
          shouldRunCommands: shouldRunCommands ?? true,
          terminal: term,
        });
    }
    await delay(artificialDelayMilliseconds ?? DEFAULT_ARTIFICAL_DELAY);

    for (let i = 1; i < terminalWindow.splitTerminals.length; i++) {
      const splitTerminal = terminalWindow.splitTerminals[i];
      const createdSplitTerm = await createNewSplitTerminal(splitTerminal.name);

      const { commands, shouldRunCommands } = splitTerminal;
      commands &&
        commandsToRunInTerms.push({
          commands,
          shouldRunCommands: shouldRunCommands ?? true,
          terminal: createdSplitTerm,
        });
      await delay(artificialDelayMilliseconds ?? DEFAULT_ARTIFICAL_DELAY);
    }

    if (terminalWindow.setAsActive && !activeWindow) {
      activeWindow = term;
    }
  }
  await delay(artificialDelayMilliseconds ?? DEFAULT_ARTIFICAL_DELAY);
  //we run the actual commands in parallel
  commandsToRunInTerms.forEach(async (el) => {
    await runCommands(el.commands, el.terminal, el.shouldRunCommands);
  });

  //for some reason running a command in the terminal makes it be shown again so this
  //needs to be ran after all the commands are executed
  if (activeWindow) {
    activeWindow.show();
  }
}

async function runCommands(
  commands: string[],
  terminal: vscode.Terminal,
  shouldRunCommands: boolean = true
) {
  for (let j = 0; j < commands?.length; j++) {
    const command = commands[j] + (shouldRunCommands ? "" : ";"); //add semicolon so all commands can run properly after user presses enter
    terminal.sendText(command, shouldRunCommands);
  }
}

async function createNewSplitTerminal(
  name: string | undefined
): Promise<vscode.Terminal> {
  return new Promise(async (resolve, reject) => {
    const numTermsBefore = vscode.window.terminals.length;
    await vscode.commands.executeCommand("workbench.action.terminal.split");
    if (name) {
      await vscode.commands.executeCommand(
        "workbench.action.terminal.renameWithArg",
        {
          name,
        }
      );
    }
    let attemptCount = 0;
    while (true) {
      const numTermsNow = vscode.window.terminals?.length;
      if (attemptCount > MAX_TERM_CHECK_ATTEMPTS) {
        reject();
        break;
      }
      if (numTermsNow > numTermsBefore) {
        resolve(vscode.window.terminals[numTermsNow - 1]);
        break; //we know the terminal has now been split
      } else {
        await delay(SPLIT_TERM_CHECK_DELAY);
        attemptCount++;
      }
    }
  });
}

function promptForCheckboxes(
  terminalWindows: Map<number, TerminalWindow>
): Promise<number[]> {
  return new Promise((resolve) => {
    const quickPick = vscode.window.createQuickPick();
    quickPick.canSelectMany = true;

    // Define the options for the user to select from
    quickPick.items = Array.from(terminalWindows.entries()).map(
      ([index, window]) => ({
        label:
          `${index.toString()}. ` +
          (window.splitTerminals
            ? window.splitTerminals[0].name ?? "unnamed"
            : "empty"),
        description: window.splitTerminals
          ? window.splitTerminals[0].commands?.join(", ") || "No commands"
          : "No config",
      })
    );

    quickPick.selectedItems = quickPick.items.filter(
      (item) =>
        terminalWindows.get(Number(item.label.split(".")[0]))?.defaultSelected
    );

    // Placeholder text
    quickPick.placeholder = "Choose options (check to select)";

    let accepted = false;

    quickPick.onDidAccept(() => {
      accepted = true;
      const selectedIndices = quickPick.selectedItems.map((item) =>
        Number(item.label.split(".")[0])
      );
      resolve(selectedIndices);
      quickPick.hide();
    });

    // When the quick pick is closed without accepting (e.g. Escape)
    quickPick.onDidHide(() => {
      quickPick.dispose();
      if (!accepted) {
        // User cancelled - resolve with empty array
        resolve([]);
      }
    });

    // Show the quick pick interface
    quickPick.show();
  });
}
