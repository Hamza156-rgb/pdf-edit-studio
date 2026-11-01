import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

export type AccountDocumentInput = { name: string; originalFileName: string; pageCount: number; byteSize: number };

/**
 * Records a saved document in the signed-in user's account activity. The website uses tRPC;
 * the mobile app swaps this module for a REST implementation (mobile/src/lib/accountDocuments.ts).
 */
export function useRecordAccountDocument() {
  const mutation = trpc.documents.create.useMutation();
  const { mutateAsync } = mutation;
  return useCallback(async (input: AccountDocumentInput) => { await mutateAsync(input); }, [mutateAsync]);
}
