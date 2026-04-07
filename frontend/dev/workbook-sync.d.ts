type WorkbookSyncProductVariant = {
    sku: string;
    label: string;
    size?: string;
    color?: string;
    price: number;
    stock: number;
};
export type WorkbookSyncProduct = {
    id: string;
    name: string;
    description: string;
    price: number;
    stock: number;
    category: string;
    brand: string;
    tags: string[];
    status: string;
    sku: string;
    variants: WorkbookSyncProductVariant[];
    image_url: string;
    image_urls: string[];
};
export type WorkbookProductMutation = {
    operation: "upsert" | "delete";
    product: WorkbookSyncProduct;
};
export type WorkbookTable = {
    headers: string[];
    rows: FlatWorkbookRow[];
};
type FlatWorkbookRow = Record<string, string>;
export declare function applyWorkbookProductMutation(table: WorkbookTable, mutation: WorkbookProductMutation): {
    headers: string[];
    rows: {
        [x: string]: string;
    }[];
};
export declare function syncWorkbookProductFiles(csvPath: string, xlsxPath: string, mutation: WorkbookProductMutation): Promise<{
    message: string;
}>;
export {};
