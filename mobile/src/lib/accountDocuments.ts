import type { AccountDocumentInput } from "../../../client/src/lib/accountDocuments";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { DOCUMENTS_QUERY_KEY } from "./auth";
import { restApi } from "./native";

/** REST version of the website's account-activity recorder (aliased in vite.config.ts). */
export function useRecordAccountDocument() {
  const queryClient = useQueryClient();
  return useCallback(async (input: AccountDocumentInput) => {
    await restApi("/documents", { method: "POST", body: JSON.stringify(input) });
    void queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
  }, [queryClient]);
}
