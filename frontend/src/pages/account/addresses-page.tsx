import { Link } from "react-router-dom";

import { AccountPageLayout } from "@/features/account/components/account-page-layout";
import { useSavedAddresses } from "@/features/account/hooks/use-saved-addresses";
import { useAuth } from "@/features/auth/hooks/use-auth";
import "@/styles/pages/account/addresses-page.css";

export function AddressesPage() {
  const { token } = useAuth();
  const { addresses, isLoading } = useSavedAddresses(token);

  return (
    <AccountPageLayout>
      <div className="addresses-route">
        <header className="addresses-route-head">
          <div>
            <h1>Addresses</h1>
            <p>
              Manage your saved delivery contacts for a faster checkout experience and easier
              order follow-up.
            </p>
          </div>

          <Link className="addresses-route-primary" to="/checkout">
            Add New Address
          </Link>
        </header>

        {isLoading ? (
          <div className="page-state">Đang tải sổ địa chỉ...</div>
        ) : addresses.length === 0 ? (
          <div className="empty-card history-empty addresses-route-empty">
            <h3>No saved addresses yet</h3>
            <p>Save a delivery address during checkout and it will appear here.</p>
            <Link className="addresses-route-primary" to="/checkout">
              Go to Checkout
            </Link>
          </div>
        ) : (
          <div className="addresses-route-grid">
            {addresses.map((address, index) => (
              <article className="addresses-route-card" key={address.id}>
                <div className="addresses-route-card-head">
                  <div className="addresses-route-card-title">
                    <span className="addresses-route-icon">{index === 0 ? "H" : "A"}</span>
                    <h3>{address.is_default ? "Home" : `Address ${index + 1}`}</h3>
                  </div>

                  {address.is_default ? (
                    <span className="addresses-route-badge">Default</span>
                  ) : null}
                </div>

                <div className="addresses-route-block">
                  <span>Resident</span>
                  <strong>{address.recipient_name}</strong>
                </div>

                <div className="addresses-route-block">
                  <span>Contact</span>
                  <strong>{address.phone || "No phone saved"}</strong>
                </div>

                <div className="addresses-route-block">
                  <span>Location</span>
                  <p>{address.location || "No delivery location saved"}</p>
                </div>

                <div className="addresses-route-actions">
                  <Link className="addresses-route-action" to="/checkout">
                    Edit
                  </Link>
                  <Link
                    className="addresses-route-action addresses-route-action-danger"
                    to="/checkout"
                  >
                    Use at Checkout
                  </Link>
                </div>
              </article>
            ))}

            <Link className="addresses-route-placeholder" to="/checkout">
              <span className="addresses-route-placeholder-icon">+</span>
              <strong>New Address</strong>
              <span>Add a new destination for your upcoming purchases.</span>
            </Link>
          </div>
        )}
      </div>
    </AccountPageLayout>
  );
}
