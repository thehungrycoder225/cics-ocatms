"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { formatMilestoneNotification } from "@/lib/notification-copy";

interface NotificationItem {
  id: string;
  kind: "ARRIVAL" | "CHECKOUT";
  activityTitle: string;
  participantName: string;
  destination: string;
  receivedAt: string;
  validationStatus: "PENDING" | "FLAGGED_FOR_REVIEW" | "VERIFIED";
  readAt: string | null;
}

interface NotificationResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNotificationItem(value: unknown): value is NotificationItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.kind === "ARRIVAL" || value.kind === "CHECKOUT") &&
    typeof value.activityTitle === "string" &&
    typeof value.participantName === "string" &&
    typeof value.destination === "string" &&
    typeof value.receivedAt === "string" &&
    Number.isFinite(Date.parse(value.receivedAt)) &&
    (value.validationStatus === "PENDING" ||
      value.validationStatus === "FLAGGED_FOR_REVIEW" ||
      value.validationStatus === "VERIFIED") &&
    (typeof value.readAt === "string" || value.readAt === null)
  );
}

function isNotificationResponse(value: unknown): value is NotificationResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.notifications) &&
    value.notifications.every(isNotificationItem) &&
    typeof value.unreadCount === "number" &&
    Number.isInteger(value.unreadCount) &&
    value.unreadCount >= 0
  );
}

async function readResponseBody(response: Response, errorMessage: string): Promise<unknown> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`${errorMessage} (HTTP ${response.status}).`);
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error(`${errorMessage} (HTTP ${response.status}; invalid server response).`);
  }
}

function responseError(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.error === "string" && value.error.trim()
    ? value.error
    : fallback;
}

export function NotificationInbox() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [panelTop, setPanelTop] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = await readResponseBody(response, "Notifications could not be loaded.");
      if (!response.ok) {
        throw new Error(responseError(body, `Notifications could not be loaded (HTTP ${response.status}).`));
      }
      if (!isNotificationResponse(body)) {
        throw new Error("Notifications could not be loaded because the server returned an invalid response.");
      }
      const result = body;
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Notifications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimeout = window.setTimeout(() => void loadNotifications(), 0);
    const intervalId = window.setInterval(() => void loadNotifications(), 30_000);
    return () => {
      window.clearTimeout(initialTimeout);
      window.clearInterval(intervalId);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;

    const updatePanelPosition = () => {
      if (window.matchMedia("(max-width: 640px)").matches && triggerRef.current) {
        setPanelTop(triggerRef.current.getBoundingClientRect().bottom + 8);
      } else {
        setPanelTop(null);
      }
    };

    window.addEventListener("resize", updatePanelPosition);
    document.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      document.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  async function markAsRead(id: string) {
    setMarkingId(id);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = await readResponseBody(response, "Notification could not be marked as read.");
      if (!response.ok) {
        throw new Error(
          responseError(body, `Notification could not be marked as read (HTTP ${response.status}).`),
        );
      }
      if (!isRecord(body) || body.id !== id || typeof body.readAt !== "string") {
        throw new Error("Notification could not be marked as read because the server returned an invalid response.");
      }
      await loadNotifications();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Notification could not be marked as read.");
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div className="monitoring-notification-inbox">
      <button
        ref={triggerRef}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-controls="monitoring-notification-panel"
        className="button-secondary monitoring-notification-trigger"
        onClick={() => {
          const nextOpen = !open;
          if (nextOpen && window.matchMedia("(max-width: 640px)").matches) {
            const trigger = triggerRef.current;
            setPanelTop(trigger ? trigger.getBoundingClientRect().bottom + 8 : null);
          } else {
            setPanelTop(null);
          }
          setOpen(nextOpen);
          if (nextOpen) void loadNotifications();
        }}
        type="button"
        title="Notifications"
      >
        <Bell aria-hidden="true" size={20} strokeWidth={2} />
        {unreadCount > 0 ? (
          <span aria-hidden="true" className="monitoring-notification-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <section
          aria-busy={loading}
          aria-label="Milestone notifications"
          className="monitoring-notification-panel"
          id="monitoring-notification-panel"
          style={panelTop === null ? undefined : { top: panelTop }}
        >
          <h2>Milestone notifications</h2>
          <p className="monitoring-notification-refresh-note">
            Updates automatically while this dashboard is open.
          </p>
          {errorMessage ? <p role="alert">{errorMessage}</p> : null}
          {loading && notifications.length === 0 ? (
            <p role="status">Loading notifications…</p>
          ) : notifications.length ? (
            <ul className="monitoring-notification-list">
              {notifications.map((notification) => {
                const content = formatMilestoneNotification(notification);
                return (
                  <li
                    className={notification.readAt ? "" : "monitoring-notification-unread"}
                    key={notification.id}
                  >
                    <strong>{content.title}</strong>
                    <span>{content.message}</span>
                    <span>{content.status}</span>
                    {!notification.readAt ? (
                      <button
                        className="button-text"
                        disabled={markingId === notification.id}
                        onClick={() => void markAsRead(notification.id)}
                        type="button"
                      >
                        {markingId === notification.id ? "Updating…" : "Mark as read"}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : !loading && !errorMessage ? (
            <p role="status">No milestone notifications.</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
