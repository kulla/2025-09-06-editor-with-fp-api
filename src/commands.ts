export enum Command {
  InsertText = 'insertText',
}

interface CommandPayloads {
  [Command.InsertText]: [string]
}

export type CommandPayload<C extends Command> = C extends keyof CommandPayloads
  ? CommandPayloads[C]
  : []
