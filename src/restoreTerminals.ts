import * as vscode from "vscode";
import { delay } from "./utils";
import { Configuration, TerminalWindow } from "./model";

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
    terminalWindows = new Map(Object.entries(terminalWindows));
    if (!terminalWindows.size) {
      vscode.window.showInformationMessage(
        "Empty terminal window configuration provided to restore terminals with."
      ); //this might be annoying
      return;
    }

    if (terminalWindows.size > 1) {
      const picked = await vscode.window.showQuickPick(
        Array.from(terminalWindows.keys())
      );
      if (!picked) {
        return;
      }
      terminalWindows = terminalWindows.get(picked) ?? [];
    } else {
      terminalWindows = Array.from(terminalWindows.values())[0];
    }
  }

  if (!terminalWindows.length) {
    vscode.window.showInformationMessage(
      "Empty terminal window configuration provided to restore terminals with."
    ); //this might be annoying
    return;
  }

  if (vscode.window.activeTerminal && !keepExistingTerminalsOpen) {
    vscode.window.terminals.forEach((terminal) => {
      //i think calling terminal.dispose before creating the new termials causes error because the terminal has disappeard and it fux up. we can do it after, and check that the terminal we are deleting is not in the list of terminals we just created
      console.log(`Disposing terminal ${terminal.name}`);
      terminal.dispose();
    });
  }
  await delay(artificialDelayMilliseconds ?? DEFAULT_ARTIFICAL_DELAY); //without delay it starts bugging out

  let commandsToRunInTerms: {
    commands: string[];
    shouldRunCommands: boolean;
    terminal: vscode.Terminal;
  }[] = [];
  //create the terminals sequentially so theres no glitches, but run the commands in parallel
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

  // When the quick pick is closed without accepting
  quickPick.onDidHide(() => {
    quickPick.dispose();
  });

  // Show the quick pick interface
  quickPick.show();
  return new Promise((resolve) => {
    quickPick.onDidAccept(() => {
      const selectedIndices = quickPick.selectedItems.map((item) =>
        Number(item.label.split(".")[0])
      );
      resolve(selectedIndices);
      quickPick.hide();
    });
  });
}
