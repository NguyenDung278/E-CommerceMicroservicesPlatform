"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { AccountShell } from "@/components/account-shell";
import {
  EmptyState,
  InlineAlert,
  LoadingScreen,
  StatusPill,
  SurfaceCard,
  TextInput,
} from "@/components/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { userApi } from "@/lib/api";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import type { Address } from "@/types/api";

const emptyAddressForm = {
  recipient_name: "",
  phone: "",
  street: "",
  ward: "",
  district: "",
  city: "",
  is_default: false,
};

export function AddressesPageView() {
  const { token } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyAddressForm);

  const reload = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await userApi.listAddresses(token);
      setAddresses(response.data);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

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
      resetForm();
      await reload();
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
      await reload();
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
      await reload();
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
              value={form.street}
              onChange={(event) => setForm((current) => ({ ...current, street: event.target.value }))}
            />
            <TextInput
              placeholder="Phường / xã"
              value={form.ward}
              onChange={(event) => setForm((current) => ({ ...current, ward: event.target.value }))}
            />
            <TextInput
              placeholder="Quận / huyện"
              value={form.district}
              onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))}
            />
            <TextInput
              placeholder="Tỉnh / thành phố"
              value={form.city}
              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
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

        <div>
          {isLoading ? (
            <LoadingScreen label="Đang tải sổ địa chỉ..." />
          ) : addresses.length === 0 ? (
            <EmptyState
              title="Chưa có địa chỉ"
              description="Tạo địa chỉ đầu tiên để checkout nhanh hơn trong các lần mua tiếp theo."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {addresses.map((address) => (
                <SurfaceCard key={address.id} className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-primary">{address.recipient_name}</p>
                      <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                        {address.street}
                        <br />
                        {[address.ward, address.district, address.city].filter(Boolean).join(", ")}
                      </p>
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
                        setForm({ ...address, ward: address.ward || "" });
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
                  </div>
                </SurfaceCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </AccountShell>
  );
}
