/**
 * Guest Cart Utilities - Backward Compatibility Layer
 * Re-exports from the new cart storage module
 */

export {
  createEmptyGuestCart,
  readGuestCart,
  saveGuestCart,
  clearGuestCart,
} from "./cart/storage";
