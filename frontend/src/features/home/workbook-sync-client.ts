import type { Product } from "@/types/api";
import { publishHomeWorkbookSyncSignal } from "./use-home-workbook";

export type WorkbookMutationOperation = "upsert" | "delete";

export type WorkbookProductMutation = {
  operation: WorkbookMutationOperation;
  product: Product;
};

type WorkbookSyncResponse = {
  message?: string;
};

function toErrorMessage(reason: unknown) {
  if (reason instanceof Error && reason.message.trim()) {
    return reason.message;
  }

  return "Khong the dong bo workbook CSV/XLSX.";
}

export async function syncWorkbookProductMutations(mutations: WorkbookProductMutation[]) {
  if (mutations.length === 0) {
    return {
      message: "Khong co thay doi nao de dong bo workbook CSV/XLSX.",
    };
  }

  try {
    const response = await fetch("/__workbook-sync/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        mutations.length === 1
          ? mutations[0]
          : {
              mutations,
            }
      ),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as WorkbookSyncResponse | null;
      throw new Error(
        payload?.message?.trim() ||
          `Workbook sync request failed with status ${response.status}.`
      );
    }

    const payload = (await response.json().catch(() => ({}))) as WorkbookSyncResponse;
    publishHomeWorkbookSyncSignal();

    return {
      message: payload.message?.trim() || "Workbook CSV/XLSX da duoc cap nhat.",
    };
  } catch (reason) {
    throw new Error(toErrorMessage(reason));
  }
}

export async function syncWorkbookProductMutation(
  operation: WorkbookMutationOperation,
  product: Product
) {
  return syncWorkbookProductMutations([{ operation, product }]);
}
