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
