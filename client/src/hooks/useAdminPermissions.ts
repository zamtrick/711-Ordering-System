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
  }, []);

  const isSuperadmin = user?.role === "superadmin";
  // Superadmin always has full access; admin is read-only when toggle OFF.
  const can = (key: keyof AdminPermissions) => isSuperadmin || perms[key];

  return { perms, loading, isSuperadmin, can };
}
