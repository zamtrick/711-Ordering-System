import { useEffect, useState } from "react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";

export type AdminPermissions = {
  canManageProducts: boolean;
  canManageCategories: boolean;
  canManageRiders: boolean;
};

const DEFAULTS: AdminPermissions = {
  canManageProducts: true,
  canManageCategories: true,
  canManageRiders: true,
};

export function useAdminPermissions() {
  const { user } = useAuth();
  const [perms, setPerms] = useState<AdminPermissions>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Superadmin always has full permissions — no need to fetch
    if (user?.role === "superadmin") {
      setLoading(false);
      return;
    }

    let mounted = true;
    api
      .get("/settings/admin-permissions")
      .then((res) => {
        if (!mounted) return;
        const d = res.data?.data;
        if (d) {
          setPerms({
            canManageProducts: d.canManageProducts ?? true,
            canManageCategories: d.canManageCategories ?? true,
            canManageRiders: d.canManageRiders ?? true,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [user?.role]);

  // Superadmin always returns true regardless of stored settings
  const can = (key: keyof AdminPermissions) => {
    if (user?.role === "superadmin") return true;
    return perms[key];
  };

  return { perms, loading, can };
}
