"use client";

export function LogoutButton({ className }: { className?: string }) {
  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <button
      onClick={handleLogout}
      className={className}
    >
      Log out
    </button>
  );
}
