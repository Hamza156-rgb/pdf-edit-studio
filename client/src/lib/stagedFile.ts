let stagedFile: File | null = null;
let stagedSession: import("./session").RecoveredSession | null = null;

export function stagePdfFile(file: File) {
  stagedFile = file;
}

export function consumeStagedPdfFile() {
  const file = stagedFile;
  stagedFile = null;
  return file;
}

export function stageEditorSession(session: import("./session").RecoveredSession) {
  stagedSession = session;
}

export function consumeStagedEditorSession() {
  const session = stagedSession;
  stagedSession = null;
  return session;
}

/** Reads the staged file and session without clearing them, for use during render. */
export function peekStagedEditorInput() {
  return { file: stagedFile, session: stagedSession };
}

/** Clears what the editor picked up; call from an effect, once the editor has actually mounted. */
export function clearStagedEditorInput() {
  stagedFile = null;
  stagedSession = null;
}
