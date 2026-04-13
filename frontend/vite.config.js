import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { syncWorkbookProductBatch, syncWorkbookProductFiles } from "./dev/workbook-sync.js";
const importMetaUrl = import.meta.url;
const workbookCsvPath = new URL("./public/content/stitchfix-home.csv", importMetaUrl).pathname;
const workbookXlsxPath = new URL("./public/content/stitchfix-home.xlsx", importMetaUrl).pathname;
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function isWorkbookMutationPayload(value) {
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
function isWorkbookBatchPayload(value) {
    if (!Array.isArray(value.mutations) || value.mutations.length === 0) {
        return false;
    }
    return value.mutations.every((mutation) => isRecord(mutation) && isWorkbookMutationPayload(mutation));
}
function sendJsonResponse(response, statusCode, body) {
    response.statusCode = statusCode;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(body));
}
function readJsonBody(request) {
    return new Promise((resolve, reject) => {
        let rawBody = "";
        request.setEncoding?.("utf8");
        request.on("data", (chunk) => {
            rawBody += String(chunk);
        });
        request.on("end", () => {
            try {
                resolve(JSON.parse(rawBody || "{}"));
            }
            catch (error) {
                reject(error);
            }
        });
        request.on("error", (error) => {
            reject(error);
        });
    });
}
function workbookSyncPlugin() {
    const registerWorkbookMiddleware = (middlewares) => {
        const handler = (request, response) => {
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
        middlewares.use("/__workbook-sync/products", handler);
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
    test: {
        environment: "jsdom",
        coverage: {
            provider: "v8",
            reporter: ["text", "cobertura"],
            reportsDirectory: "./coverage",
            include: [
                "src/features/admin/components/admin-returns-section.tsx",
                "src/services/api/modules/admin-api.ts",
            ],
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes("node_modules")) {
                        return undefined;
                    }
                    if (id.includes("/xlsx/")) {
                        return "xlsx-vendor";
                    }
                    if (id.includes("/react-router") || id.includes("@remix-run")) {
                        return "router-vendor";
                    }
                    if (id.includes("/react/") || id.includes("/react-dom/")) {
                        return "react-vendor";
                    }
                    return "vendor";
                },
            },
        },
    },
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
