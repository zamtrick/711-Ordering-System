import { useEffect, useState } from "react";
import api from "@/api/axios";
import { useAuth } from "@/hooks/useAuth";

export type AdminPermissions = {
  canManageProducts: boolean;
  canManageCategories: boolean;
  canManageRiders: boolean;
  canManageAds: boolean;
};

// Fail-closed: before the fetch resolves (or if it fails), branch admins
// see read-only UI. Superadmin short-circuits to true in `can()` below.
const DEFAULTS: AdminPermissions = {
  canManageProducts: false,
  canManageCategories: false,
  canManageRiders: false,
  canManageAds: false,
};

export function useAdminPermissions() {
  const { user } = useAuth();
  const [perms, setPerms] = useState<AdminPermissions>(DEFAULTS);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    // Superadmin always has full permissions — no need to fetch.
    // No setState here: `loading` is derived below instead.
    if (user?.role === "superadmin") return;

    let mounted = true;
    api
      .get("/settings/admin-permissions")
      .then((res) => {
        if (!mounted) return;
        const d = res.data?.data;
        if (d) {
          setPerms({
            canManageProducts: d.canManageProducts ?? false,
            canManageCategories: d.canManageCategories ?? false,
            canManageRiders: d.canManageRiders ?? false,
            canManageAds: d.canManageAds ?? false,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setFetching(false);
      });
    return () => {
      mounted = false;
    };
  }, [user?.role]);

  // Superadmins are ready immediately — no fetch in flight for them.
  const loading = user?.role === "superadmin" ? false : fetching;

  // Superadmin always returns true regardless of stored settings
  const can = (key: keyof AdminPermissions) => {
    if (user?.role === "superadmin") return true;
    return perms[key];
  };

  return { perms, loading, can };
}
