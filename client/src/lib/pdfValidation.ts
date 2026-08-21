export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export function validatePdfFile(file: File) {
  if (file.size === 0) return "This file is empty. Choose a valid PDF document.";
  if (file.size > MAX_PDF_BYTES) return "This file is over the 50 MB guest-session limit.";
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Only PDF files can be opened in the editor.";
  return null;
}
