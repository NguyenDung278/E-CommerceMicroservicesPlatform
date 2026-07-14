import { MapPin, Pencil, X } from "lucide-react";
import { Dispatch, FormEvent, SetStateAction, useState } from "react";
import {
  createAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
} from "../../services/user-service";
import { useAuth } from "../../state/auth-context";
import type { Address } from "../../types/api";

const emptyAddressForm = {
  recipient_name: "",
  phone: "",
  location: "",
  is_default: false,
};

/**
 * Sổ địa chỉ: tạo/sửa/xóa/đặt mặc định. Danh sách address do
 * useAccountData sở hữu (stat grid cũng dùng) nên nhận setter từ page.
 */
export function AddressSection({
  addresses,
  setAddresses,
  onError,
}: {
  addresses: Address[];
  setAddresses: Dispatch<SetStateAction<Address[]>>;
  onError: (message: string | null) => void;
}) {
  const { token } = useAuth();
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editAddressForm, setEditAddressForm] = useState(emptyAddressForm);
  const [addressSubmitting, setAddressSubmitting] = useState(false);

  const defaultAddress = addresses.find((address) => address.is_default);

  async function handleCreateAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    try {
      setAddressSubmitting(true);
      onError(null);
      const created = await createAddress(token, {
        ...addressForm,
        is_default: addressForm.is_default || addresses.length === 0,
      });
      setAddresses((current) => {
        const currentAddresses = Array.isArray(current) ? current : [];
        const rest = created.is_default
          ? currentAddresses.map((address) => ({ ...address, is_default: false }))
          : currentAddresses;
        return [created, ...rest];
      });
      setAddressForm(emptyAddressForm);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tạo được địa chỉ");
    } finally {
      setAddressSubmitting(false);
    }
  }

  function startEditAddress(address: Address) {
    setEditingAddressId(address.id);
    setEditAddressForm({
      recipient_name: address.recipient_name,
      phone: address.phone,
      location: address.location,
      is_default: address.is_default,
    });
  }

  async function handleUpdateAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !editingAddressId) {
      return;
    }

    try {
      setAddressSubmitting(true);
      onError(null);
      const updated = await updateAddress(token, editingAddressId, editAddressForm);
      setAddresses((current) =>
        (Array.isArray(current) ? current : []).map((address) => {
          if (updated.is_default && address.id !== updated.id) {
            return { ...address, is_default: false };
          }
          return address.id === updated.id ? updated : address;
        }),
      );
      setEditingAddressId(null);
      setEditAddressForm(emptyAddressForm);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không cập nhật được địa chỉ");
    } finally {
      setAddressSubmitting(false);
    }
  }

  function cancelEditAddress() {
    setEditingAddressId(null);
    setEditAddressForm(emptyAddressForm);
  }

  async function handleSetDefaultAddress(addressId: string) {
    if (!token) {
      return;
    }

    const updated = await setDefaultAddress(token, addressId).catch((err) => {
      onError(err instanceof Error ? err.message : "Không đặt được địa chỉ mặc định");
      return null;
    });
    if (!updated) {
      return;
    }

    setAddresses((current) =>
      (Array.isArray(current) ? current : []).map((address) => ({
        ...address,
        is_default: address.id === updated.id,
      })),
    );
  }

  async function handleDeleteAddress(addressId: string) {
    if (!token) {
      return;
    }

    await deleteAddress(token, addressId)
      .then(() => {
        setAddresses((current) =>
          (Array.isArray(current) ? current : []).filter((address) => address.id !== addressId),
        );
      })
      .catch((err) => {
        onError(err instanceof Error ? err.message : "Không xóa được địa chỉ");
      });
  }

  return (
    <section className="surface-section" id="addresses">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Address book</span>
          <h2>Sổ địa chỉ</h2>
          <p>
            {defaultAddress ? `Mặc định: ${defaultAddress.location}` : "Chưa có địa chỉ mặc định"}
          </p>
        </div>
        <MapPin size={24} />
      </div>
      <div className="account-split">
        <form className="address-form" onSubmit={handleCreateAddress}>
          <label>
            Người nhận
            <input
              value={addressForm.recipient_name}
              onChange={(event) =>
                setAddressForm((current) => ({
                  ...current,
                  recipient_name: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            Số điện thoại
            <input
              value={addressForm.phone}
              onChange={(event) =>
                setAddressForm((current) => ({ ...current, phone: event.target.value }))
              }
              required
            />
          </label>
          <label>
            Địa chỉ
            <input
              value={addressForm.location}
              onChange={(event) =>
                setAddressForm((current) => ({ ...current, location: event.target.value }))
              }
              required
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={addressForm.is_default}
              onChange={(event) =>
                setAddressForm((current) => ({
                  ...current,
                  is_default: event.target.checked,
                }))
              }
            />
            Đặt làm mặc định
          </label>
          <button className="button button--secondary" type="submit" disabled={addressSubmitting}>
            {addressSubmitting ? "Đang lưu" : "Thêm địa chỉ"}
          </button>
        </form>

        <div className="address-list">
          {addresses.length === 0 ? (
            <p>Chưa có địa chỉ.</p>
          ) : (
            addresses.map((address) => {
              const isEditing = editingAddressId === address.id;
              return (
                <article key={address.id} className="address-card">
                  {isEditing ? (
                    <form className="address-edit-form" onSubmit={handleUpdateAddress}>
                      <label>
                        Người nhận
                        <input
                          value={editAddressForm.recipient_name}
                          onChange={(event) =>
                            setEditAddressForm((current) => ({
                              ...current,
                              recipient_name: event.target.value,
                            }))
                          }
                          required
                        />
                      </label>
                      <label>
                        Số điện thoại
                        <input
                          value={editAddressForm.phone}
                          onChange={(event) =>
                            setEditAddressForm((current) => ({
                              ...current,
                              phone: event.target.value,
                            }))
                          }
                          required
                        />
                      </label>
                      <label>
                        Địa chỉ
                        <input
                          value={editAddressForm.location}
                          onChange={(event) =>
                            setEditAddressForm((current) => ({
                              ...current,
                              location: event.target.value,
                            }))
                          }
                          required
                        />
                      </label>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={editAddressForm.is_default}
                          onChange={(event) =>
                            setEditAddressForm((current) => ({
                              ...current,
                              is_default: event.target.checked,
                            }))
                          }
                        />
                        Đặt làm mặc định
                      </label>
                      <div className="inline-actions">
                        <button
                          className="button button--secondary"
                          type="submit"
                          disabled={addressSubmitting}
                        >
                          Lưu
                        </button>
                        <button
                          className="button button--ghost"
                          type="button"
                          onClick={cancelEditAddress}
                        >
                          <X size={16} />
                          Hủy
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div>
                        <strong>{address.recipient_name}</strong>
                        <p>{address.phone}</p>
                        <p>{address.location}</p>
                      </div>
                      {address.is_default ? (
                        <span className="status-pill is-good">Mặc định</span>
                      ) : null}
                      <div className="inline-actions">
                        {!address.is_default ? (
                          <button
                            className="button button--secondary"
                            type="button"
                            onClick={() => void handleSetDefaultAddress(address.id)}
                          >
                            Đặt mặc định
                          </button>
                        ) : null}
                        <button
                          className="button button--ghost"
                          type="button"
                          onClick={() => startEditAddress(address)}
                        >
                          <Pencil size={16} />
                          Sửa
                        </button>
                        <button
                          className="button button--ghost"
                          type="button"
                          onClick={() => void handleDeleteAddress(address.id)}
                        >
                          Xóa
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
