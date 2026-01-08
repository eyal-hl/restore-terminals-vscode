export interface TerminalConfig {
  commands?: string[];
  name?: string;
  shouldRunCommands?: boolean; //whether to actually run the commands, or just paste them in
}

export interface TerminalWindow {
  splitTerminals?: TerminalConfig[];
  setAsActive?: boolean; //whether to keep the display of the terminal window open even if more windows were opened after this one
  defaultSelected?: boolean;
}

// A preset can either be a plain array of TerminalWindow (legacy) or an object with settings
export interface Preset {
  keepExistingTerminalsOpen?: boolean;
  terminals: TerminalWindow[];
}

// Type guard to check if a preset value is the new Preset object format
export function isPresetObject(
  value: TerminalWindow[] | Preset
): value is Preset {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "terminals" in value
  );
}

export interface Configuration {
  keepExistingTerminalsOpen?: boolean;
  artificialDelayMilliseconds?: number;
  terminalWindows?:
    | TerminalWindow[]
    | Map<string, TerminalWindow[] | Preset>
    | { [key: string]: TerminalWindow[] | Preset };
  runOnStartup?: boolean;
}

export interface JsonConfiguration {
  keepExistingTerminalsOpen?: boolean;
  artificialDelayMilliseconds?: number;
  terminals?: TerminalWindow[] | { [key: string]: TerminalWindow[] | Preset }; //supports array, object with array presets, or object with Preset objects
  runOnStartup?: boolean;
}
