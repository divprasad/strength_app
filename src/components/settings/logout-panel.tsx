"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { clearDatabaseForUserSwitch } from "@/lib/db";

export function LogoutPanel() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await clearDatabaseForUserSwitch();
      window.location.href = "/login";
    } catch (e) {
      console.error("Failed to logout:", e);
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <LogOut className="w-5 h-5 text-red-400" />
          Account
        </h2>
        <p className="text-zinc-400 text-sm mt-1">
          Sign out of your account on this device.
        </p>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        <p className="text-sm text-zinc-500">
          Logging out will clear the local device cache. Your data is safely stored on the server.
        </p>
        <button
          onClick={handleLogout}
          disabled={loading}
          className="w-full bg-red-500/10 text-red-400 font-medium py-2.5 rounded-lg border border-red-500/20 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:bg-red-500/20"
        >
          {loading ? "Signing out..." : "Sign Out"}
        </button>
      </div>
    </div>
  );
}
