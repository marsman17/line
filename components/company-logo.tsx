"use client";
import { Leaf } from "lucide-react";
import { usePreferences } from "./preferences";
export default function CompanyLogo({
  branchId,
  version,
  name,
}: {
  branchId?: string;
  version?: string | null;
  name?: string;
}) {
  const { t } = usePreferences();
  return version && branchId ? (
    <img
      className="company-logo"
      src={`/api/branches/${encodeURIComponent(branchId)}/logo?v=${encodeURIComponent(version)}`}
      alt={t("Company logo") + (name ? " — " + name : "")}
    />
  ) : (
    <Leaf size={24} />
  );
}
