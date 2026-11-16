"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import type { InAppNotification } from "@/lib/notifications/notifications";

export function NotificationBell({ initialNotifications }: { initialNotifications: InAppNotification[] }) {
  const [notifications, setNotifications] = useState<InAppNotification[]>(initialNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Calculer le nombre de notifications récentes (ex. des dernières 24h) non encore vues
    setUnreadCount(notifications.length);
  }, [notifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleMarkAllRead() {
    setUnreadCount(0);
  }

  function formatTime(date: Date | string) {
    const d = new Date(date);
    const diffMin = Math.round((Date.now() - d.getTime()) / (1000 * 60));
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className="relative rounded-full p-2 text-ink-muted hover:bg-surface-elevated hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand"
      >
        <svg
          className="size-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 sm:w-96 rounded-xl border border-line bg-surface p-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-line pb-2 mb-2">
            <span className="text-sm font-semibold">Activité et notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-brand hover:underline"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2">
            {notifications.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-muted">Aucune notification récente.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-lg p-2.5 text-xs transition-colors border ${
                    n.severity === "danger"
                      ? "border-danger/30 bg-danger/5"
                      : n.severity === "warning"
                      ? "border-warning/30 bg-warning/5"
                      : n.severity === "success"
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-line bg-surface-elevated/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-ink">{n.title}</span>
                    <span className="shrink-0 text-[10px] text-ink-muted">{formatTime(n.timestamp)}</span>
                  </div>
                  <p className="mt-1 text-ink-muted leading-relaxed">{n.description}</p>
                  {n.deliveryId && (
                    <div className="mt-2 flex items-center justify-end">
                      <Link
                        href={`/espace/livraisons/${n.deliveryId}`}
                        onClick={() => setIsOpen(false)}
                        className="text-[11px] font-medium text-brand hover:underline"
                      >
                        Voir le colis →
                      </Link>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
