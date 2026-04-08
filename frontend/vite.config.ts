import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { syncWorkbookProductBatch, syncWorkbookProductFiles } from "./dev/workbook-sync.js";

const importMetaUrl = (import.meta as ImportMeta & { url: string }).url;
const workbookCsvPath = new URL("./public/content/stitchfix-home.csv", importMetaUrl).pathname;
const workbookXlsxPath = new URL("./public/content/stitchfix-home.xlsx", importMetaUrl).pathname;

type JsonResponse = {
  end: (chunk?: string) => void;
  setHeader: (name: string, value: string) => void;
  statusCode: number;
};

type JsonRequest = {
  method?: string;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  setEncoding?: (encoding: string) => void;
};

type WorkbookMutationPayload = Parameters<typeof syncWorkbookProductFiles>[2];
type WorkbookBatchPayload = {
  mutations: WorkbookMutationPayload[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWorkbookMutationPayload(value: Record<string, unknown>): value is WorkbookMutationPayload {
  if (!("operation" in value) || !("product" in value)) {
    return false;
  }

  if (value.operation !== "upsert" && value.operation !== "delete") {
    return false;
  }

  if (!isRecord(value.product)) {
    return false;
  }

  return typeof value.product.id === "string" && typeof value.product.name === "string";
}

function isWorkbookBatchPayload(value: Record<string, unknown>): value is WorkbookBatchPayload {
  if (!Array.isArray(value.mutations) || value.mutations.length === 0) {
    return false;
  }

  return value.mutations.every((mutation) => isRecord(mutation) && isWorkbookMutationPayload(mutation));
}

function sendJsonResponse(response: JsonResponse, statusCode: number, body: Record<string, unknown>) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

function readJsonBody(request: JsonRequest) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    let rawBody = "";

    request.setEncoding?.("utf8");
    request.on("data", (chunk) => {
      rawBody += String(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(rawBody || "{}") as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", (error) => {
      reject(error);
    });
  });
}

function workbookSyncPlugin(): Plugin {
  const registerWorkbookMiddleware = (middlewares: {
    use: (...args: unknown[]) => unknown;
  }) => {
    const handler = (request: JsonRequest, response: JsonResponse) => {
      if (request.method !== "POST") {
        sendJsonResponse(response, 405, {
          message: "Method not allowed.",
        });
        return;
      }

      void readJsonBody(request)
        .then(async (payload) => {
          if (!isWorkbookMutationPayload(payload) && !isWorkbookBatchPayload(payload)) {
            sendJsonResponse(response, 400, {
              message: "Invalid workbook sync payload.",
            });
            return;
          }

          const result = isWorkbookBatchPayload(payload)
            ? await syncWorkbookProductBatch(workbookCsvPath, workbookXlsxPath, payload.mutations)
            : await syncWorkbookProductFiles(workbookCsvPath, workbookXlsxPath, payload);

          sendJsonResponse(response, 200, result);
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Workbook sync failed.";

          sendJsonResponse(response, 500, {
            message,
          });
        });
    };

    middlewares.use("/__workbook-sync/products", handler as unknown as (...args: unknown[]) => unknown);
  };

  return {
    name: "workbook-sync-plugin",
    configureServer(server) {
      registerWorkbookMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      registerWorkbookMiddleware(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), workbookSyncPlugin()],
  resolve: {
    alias: {
      "@": new URL("./src", importMetaUrl).pathname,
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:8080",
      "/health": "http://localhost:8080",
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
