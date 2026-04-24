"use client";

import { useState, type FormEvent } from "react";

import { AccountShell } from "@/components/account-shared/account-shell";
import {
  EmptyState,
  InlineAlert,
  LoadingScreen,
  StatusPill,
  SurfaceCard,
  TextInput,
} from "@/components/storefront-shared/storefront-ui";
import { useAuthState } from "@/hooks/useAuth";
import { useSavedAddresses } from "@/hooks/useSavedAddresses";
import { userApi } from "@/lib/api";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import { invalidateSavedAddressesResource } from "@/lib/resources/account-resources";

const emptyAddressForm = {
  recipient_name: "",
  phone: "",
  location: "",
  is_default: false,
};

export function AddressesPageView() {
  const { token } = useAuthState();
  const {
    addresses,
    isLoading,
    error,
    refreshAddresses,
  } = useSavedAddresses(token);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyAddressForm);

  function resetForm() {
    setEditingId("");
    setForm(emptyAddressForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    try {
      setBusy(true);
      if (editingId) {
        await userApi.updateAddress(token, editingId, form);
        setFeedback("Địa chỉ đã được cập nhật.");
      } else {
        await userApi.createAddress(token, form);
        setFeedback("Địa chỉ mới đã được lưu.");
      }
      invalidateSavedAddressesResource(token);
      resetForm();
      await refreshAddresses(true);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(addressId: string) {
    if (!token) {
      return;
    }

    try {
      setBusy(true);
      await userApi.deleteAddress(token, addressId);
      setFeedback("Địa chỉ đã được xóa.");
      invalidateSavedAddressesResource(token);
      await refreshAddresses(true);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function handleSetDefault(addressId: string) {
    if (!token) {
      return;
    }

    try {
      setBusy(true);
      await userApi.setDefaultAddress(token, addressId);
      setFeedback("Đã cập nhật địa chỉ mặc định.");
      invalidateSavedAddressesResource(token);
      await refreshAddresses(true);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell
      title="Địa chỉ giao hàng"
      description="Quản lý đầy đủ create, update, delete và set default cho địa chỉ người dùng bằng API thật của user-service."
    >
      {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}
      {!feedback && error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <SurfaceCard className="p-6">
          <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
            {editingId ? "Cập nhật địa chỉ" : "Thêm địa chỉ mới"}
          </h2>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <TextInput
              placeholder="Tên người nhận"
              value={form.recipient_name}
              onChange={(event) =>
                setForm((current) => ({ ...current, recipient_name: event.target.value }))
              }
            />
            <TextInput
              placeholder="Số điện thoại"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
            <TextInput
              placeholder="Địa chỉ"
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
            />
            <label className="flex items-center gap-3 text-sm text-on-surface-variant">
              <input
                checked={form.is_default}
                type="checkbox"
                onChange={(event) =>
                  setForm((current) => ({ ...current, is_default: event.target.checked }))
                }
              />
              Đặt làm địa chỉ mặc định
            </label>
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                className={`${buttonStyles({ size: "lg" })} w-full`}
                disabled={busy}
              >
                {busy ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Tạo địa chỉ"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className={`${buttonStyles({ variant: "secondary", size: "lg" })} w-full`}
                  onClick={resetForm}
                >
                  Hủy chỉnh sửa
                </button>
              ) : null}
            </div>
          </form>
        </SurfaceCard>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-[#ddd5cc] bg-white/74 px-6 py-7 shadow-[0_28px_48px_-30px_rgba(27,28,25,0.16)] backdrop-blur md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="eyebrow">Address book</p>
                <h2 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary md:text-4xl">
                  Saved delivery contacts
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-on-surface-variant md:text-base">
                  Quản lý địa chỉ giao hàng để checkout nhanh hơn và theo dõi đơn thuận tiện hơn ở mọi lần mua.
                </p>
              </div>

              <button
                type="button"
                className={buttonStyles({ variant: "secondary" })}
                onClick={resetForm}
              >
                {editingId ? "Tạo địa chỉ mới" : "Làm mới form"}
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Saved addresses
                </p>
                <p className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                  {addresses.length}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Default ready
                </p>
                <p className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                  {addresses.some((address) => address.is_default) ? "Yes" : "No"}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Checkout route
                </p>
                <a
                  className="mt-4 inline-flex text-sm font-medium text-primary underline"
                  href="/checkout"
                >
                  Open checkout
                </a>
              </div>
            </div>
          </div>

          {isLoading ? (
            <LoadingScreen label="Đang tải sổ địa chỉ..." />
          ) : addresses.length === 0 ? (
            <EmptyState
              title="Chưa có địa chỉ"
              description="Tạo địa chỉ đầu tiên để checkout nhanh hơn trong các lần mua tiếp theo."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {addresses.map((address, index) => (
                <SurfaceCard key={address.id} className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">
                        {address.is_default ? "H" : String(index + 1).padStart(2, "0")}
                      </div>
                      <p className="font-semibold text-primary">{address.recipient_name}</p>
                      <p className="mt-2 text-sm leading-7 text-on-surface-variant">{address.location}</p>
                      <p className="mt-2 text-sm text-on-surface-variant">{address.phone}</p>
                    </div>
                    {address.is_default ? <StatusPill status="default" /> : null}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className={buttonStyles({ variant: "secondary" })}
                      onClick={() => {
                        setEditingId(address.id);
                        setForm({
                          recipient_name: address.recipient_name,
                          phone: address.phone,
                          location: address.location,
                          is_default: address.is_default,
                        });
                      }}
                    >
                      Sửa
                    </button>
                    {!address.is_default ? (
                      <button
                        type="button"
                        className={buttonStyles({ variant: "secondary" })}
                        onClick={() => void handleSetDefault(address.id)}
                      >
                        Đặt mặc định
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={buttonStyles({ variant: "tertiary" })}
                      onClick={() => void handleDelete(address.id)}
                    >
                      Xóa
                    </button>
                    <a href="/checkout" className={buttonStyles({ variant: "tertiary" })}>
                      Use at checkout
                    </a>
                  </div>
                </SurfaceCard>
              ))}

              <button
                type="button"
                className="flex min-h-[17rem] flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-dashed border-outline-variant bg-transparent px-6 py-8 text-center transition hover:border-primary hover:bg-surface-container-low"
                onClick={resetForm}
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-2xl text-on-primary">
                  +
                </span>
                <strong className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                  New Address
                </strong>
                <span className="max-w-xs text-sm leading-7 text-on-surface-variant">
                  Add a new destination for your upcoming purchases.
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </AccountShell>
  );
}
