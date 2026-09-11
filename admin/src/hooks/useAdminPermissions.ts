import { useEffect, useState } from "react";
import api from "@/api/axios";

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

  const can = (key: keyof AdminPermissions) => perms[key];

  return { perms, loading, can };
}
