"use client";
import { LanguageSelector, usePreferences } from "./preferences";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Leaf,
  Minus,
  Plus,
  ShieldCheck,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import CompanyLogo from "./company-logo";
import { api, type Restaurant } from "../lib/client";
type GuestStatus = {
  id: string;
  name: string;
  partySize: number;
  status: "waiting" | "notified" | "served" | "cancelled";
  position: number;
  estimatedMinutes: number;
  joinedAt: string;
  notifiedAt: string | null;
  pushEnabled: boolean;
  smsEligible: boolean;
  restaurant: Restaurant;
};
function GuestFrame({
  restaurant,
  children,
}: {
  restaurant: Restaurant | null;
  children: React.ReactNode;
}) {
  const { t: tx, locale, n } = usePreferences();

  return (
    <main className="guest-page">
      <div className="guest-top">
        <LanguageSelector />
        <a href="/check-in" className="guest-brand">
          <span className="brand-icon">
            {tx("T")}
            <span>{tx("Q")}</span>
          </span>
          {tx("TableQ.")}
        </a>
        <span>
          <Leaf size={13} /> {tx("A better wait.")}
        </span>
      </div>
      <div className="guest-layout">
        <section className="guest-intro">
          <div className="guest-art">
            <DiningArt />
            <span className="art-caption">
              {tx("GOOD FOOD. GOOD COMPANY.")}
            </span>
          </div>
          <span className="guest-logo">
            <CompanyLogo
              branchId={restaurant?.branchId}
              version={restaurant?.logoVersion}
              name={restaurant?.name}
            />
          </span>
          <span className="eyebrow">{tx("YOU’RE IN GOOD COMPANY")}</span>
          <h1>{restaurant?.name || tx("A seat at our table.")}</h1>
          <p>
            {restaurant?.address || tx("A warm welcome is waiting for you.")}
          </p>
          <div className="guest-promise">
            <Clock size={19} />
            <div>
              <strong>{tx("Spend your wait your way.")}</strong>
              <span>{tx("We’ll keep your place. You enjoy the moment.")}</span>
            </div>
          </div>
        </section>
        <section className="guest-content">{children}</section>
      </div>
      <footer className="guest-footer">
        <span>{tx("Hospitality starts before you sit down.")}</span>
        <span>
          {tx("Powered by")} <strong>{tx("TableQ.")}</strong>
        </span>
      </footer>
    </main>
  );
}
export function CheckIn() {
  const { t: tx, locale, n } = usePreferences();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [size, setSize] = useState(2);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState("");
  useEffect(() => {
    const branchId =
      new URLSearchParams(window.location.search).get("branch") || "main";
    api<Restaurant>(`public?branch=${encodeURIComponent(branchId)}`)
      .then(setRestaurant)
      .catch((e) => setError(e.message));
    try {
      const secret =
        localStorage.getItem("tableq-visit:" + branchId) ||
        (branchId === "main" ? localStorage.getItem("tableq-visit") : null);
      if (secret)
        api<GuestStatus>(`guest/${secret}`)
          .then((s) => {
            if (
              s.restaurant.branchId === branchId &&
              ["waiting", "notified"].includes(s.status)
            )
              setResume(secret);
          })
          .catch(() => {});
    } catch {}
  }, []);
  return (
    <GuestFrame restaurant={restaurant}>
      <div className="guest-card">
        <div className="guest-card-heading">
          <span className="guest-icon">
            <ListIcon />
          </span>
          <span className="guest-open">
            <i />{" "}
            {restaurant?.archived
              ? tx("Check-in is closed")
              : restaurant
                ? tx("Check-in is open")
                : tx("Loading restaurant…")}
          </span>
        </div>
        <h2>{tx("A table is worth the wait.")}</h2>
        <p>
          {restaurant?.archived
            ? tx("This branch is closed for check-in.")
            : tx("Join the queue. We’ll take care of the rest.")}
        </p>
        {restaurant?.openingHours && (
          <p>
            {tx("Opening hours:")} {restaurant.openingHours}
          </p>
        )}
        {resume && (
          <a className="resume-visit" href={`/guest/${resume}`}>
            <Clock size={17} />
            {tx("You’re already in the queue. View your visit")}{" "}
            <ArrowRight size={16} />
          </a>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const result = await api<{ token: string }>(
                `join?branch=${encodeURIComponent(restaurant!.branchId)}`,
                "POST",
                {
                  name,
                  phone,
                  email,
                  partySize: size,
                  consent,
                },
              );
              try {
                localStorage.setItem(
                  "tableq-visit:" + restaurant!.branchId,
                  result.token,
                );
              } catch {}
              window.location.href = `/guest/${result.token}`;
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          <label>
            {tx("How many in your party?")}
            <div className="guest-stepper">
              <button
                type="button"
                aria-label={tx("Decrease party size")}
                disabled={size <= 1}
                onClick={() => setSize(size - 1)}
              >
                <Minus size={18} />
              </button>
              <span>
                <Users size={20} />
                <strong>{size}</strong>
                <small>{size === 1 ? tx("guest") : tx("guests")}</small>
              </span>
              <button
                type="button"
                aria-label={tx("Increase party size")}
                disabled={size >= 20}
                onClick={() => setSize(size + 1)}
              >
                <Plus size={18} />
              </button>
            </div>
          </label>
          <label>
            {tx("Your name")}
            <input
              required
              autoComplete="name"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tx("What should we call you?")}
            />
          </label>
          <label>
            {tx("Mobile number")}
            <span className="optional">{tx("with country code")}</span>
            <input
              type="tel"
              autoComplete="tel"
              maxLength={20}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+15551234567"
            />
          </label>
          <label>
            {tx("Email")}{" "}
            <span className="optional">
              {tx("optional if you provide a mobile")}
            </span>
            <input
              type="email"
              autoComplete="email"
              maxLength={200}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={tx("you@example.com")}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              {tx(
                "I agree to receive updates about this visit. No marketing messages.",
              )}
            </span>
          </label>
          {error && (
            <p className="error" role="alert">
              {tx(error)}
            </p>
          )}
          <button
            className="button guest-primary"
            disabled={busy || !restaurant || restaurant.archived}
          >
            {busy ? tx("Saving your place…") : tx("Join the queue")}
            <ArrowRight size={18} />
          </button>
          <div className="guest-estimate">
            <Clock size={14} />
            {restaurant?.waiting
              ? tx("Estimated wait: about {value0} minutes", {
                  value0: restaurant.waiting * 5,
                })
              : tx("Estimated wait: less than 5 minutes")}
          </div>
        </form>
        <div className="guest-safe">
          <ShieldCheck size={15} />
          {tx("Your details are private and used for your visit.")}
        </div>
      </div>
      <p className="guest-help">
        {tx("Need a hand? Our host is happy to help.")}
      </p>
    </GuestFrame>
  );
}
export function GuestVisit({ token }: { token: string }) {
  const { t: tx, locale, n } = usePreferences();

  const [status, setStatus] = useState<GuestStatus | null>(null);
  const [error, setError] = useState("");
  const [pushError, setPushError] = useState("");
  const [pushBusy, setPushBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [offline, setOffline] = useState(false);
  const previous = useRef("");
  const alerted = useRef(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await api<GuestStatus>(`guest/${token}`);
        if (!active) return;
        setStatus(next);
        setOffline(false);
        setError("");
        if (next.status === "notified" && previous.current === "waiting") {
          document.title = "Your table is ready! · TableQ";
          if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
          if (
            !alerted.current &&
            "Notification" in window &&
            Notification.permission === "granted" &&
            !next.pushEnabled
          ) {
            new Notification("Your table is ready!", {
              body: "Please return to the restaurant host.",
              icon: "/icon.svg",
            });
            alerted.current = true;
          }
        }
        previous.current = next.status;
      } catch (e) {
        if (!active) return;
        setOffline(true);
        setError((e as Error).message);
      }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token]);
  async function enablePush() {
    setPushBusy(true);
    setPushError("");
    try {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      )
        throw new Error(
          "This browser does not support push. On iPhone, add this page to your Home Screen and open it there, then enable alerts.",
        );
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw new Error(
          "Notifications are blocked. Enable them in your browser settings or keep this page open.",
        );
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const key = status!.restaurant.vapidKey;
      const padded = (key + "=".repeat((4 - (key.length % 4)) % 4))
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
      const subscription =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        }));
      await api(`guest/${token}/subscribe`, "POST", subscription.toJSON());
      const cache = await caches.open("tableq-guest-route");
      await cache.put(
        `/guest-route/${status!.id}`,
        new Response(`/guest/${token}`),
      );
      setStatus((s) => (s ? { ...s, pushEnabled: true } : s));
    } catch (e) {
      setPushError((e as Error).message);
    } finally {
      setPushBusy(false);
    }
  }
  const ready = status?.status === "notified";
  const done = status?.status === "served";
  const cancelled = status?.status === "cancelled";
  return (
    <GuestFrame restaurant={status?.restaurant || null}>
      <div className={`guest-card status-card ${ready ? "table-ready" : ""}`}>
        {!status ? (
          <>
            <div className="status-illustration">
              <Clock size={38} />
            </div>
            <h2>
              {error
                ? tx("We couldn’t find your visit.")
                : tx("Finding your place…")}
            </h2>
            {error && (
              <p className="error" role="alert">
                {tx(error)}
              </p>
            )}
            <a className="button guest-primary" href="/check-in">
              {tx("Back to check-in")}
            </a>
          </>
        ) : (
          <>
            <div className="status-illustration">
              {ready ? (
                <BellRing size={39} />
              ) : done ? (
                <UtensilsCrossed size={39} />
              ) : cancelled ? (
                <X size={39} />
              ) : (
                <Clock size={39} />
              )}
            </div>
            <span className="eyebrow">
              {ready
                ? tx("THE WAIT IS OVER")
                : done
                  ? tx("MAKE YOURSELF AT HOME")
                  : cancelled
                    ? tx("UNTIL NEXT TIME")
                    : tx("YOUR PLACE IS SAVED")}
            </span>
            <h2>
              {ready
                ? tx("Your table is ready.")
                : done
                  ? tx("Enjoy your meal.")
                  : cancelled
                    ? tx("You’ve left the queue.")
                    : tx("You’re on the list, {value0}.", {
                        value0: status.name.split(" ")[0],
                      })}
            </h2>
            <p>
              {ready
                ? tx(
                    "Please head back to the restaurant and check in with our host. We can’t wait to welcome you.",
                  )
                : done
                  ? tx(
                      "Thanks for spending a little of your day at our table. Here’s to good food and good company.",
                    )
                  : cancelled
                    ? tx(
                        "Your visit has been cancelled. You’re always welcome to join again.",
                      )
                    : tx(
                        "Take a little stroll or catch up with your company. We’ll keep your place in line.",
                      )}
            </p>
            {!done && !cancelled && (
              <>
                <div className="guest-position">
                  <div>
                    <span>
                      {ready ? tx("YOUR STATUS") : tx("YOUR POSITION")}
                    </span>
                    <strong>
                      {ready ? <Check size={37} /> : n(status.position)}
                    </strong>
                    <small>
                      {ready ? tx("Table ready") : tx("in the queue")}
                    </small>
                  </div>
                  <div>
                    <span>
                      {ready ? tx("PARTY SIZE") : tx("ESTIMATED WAIT")}
                    </span>
                    <strong>
                      {ready
                        ? n(status.partySize)
                        : status.estimatedMinutes < 5
                          ? "< " + n(5)
                          : n(status.estimatedMinutes)}
                    </strong>
                    <small>{ready ? tx("guests") : tx("minutes")}</small>
                  </div>
                </div>
                <div className="visit-details">
                  <span>
                    <Users size={16} />
                    {n(status.partySize)}{" "}
                    {status.partySize === 1 ? tx("guest") : tx("guests")}
                  </span>
                  <span>
                    <Clock size={15} />
                    {tx("Joined")}{" "}
                    {new Date(status.joinedAt).toLocaleTimeString(locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {status.restaurant.pushEnabled &&
                  !ready &&
                  (status.pushEnabled ? (
                    <div className="push-enabled">
                      <CheckCheck size={17} />{" "}
                      {tx("Mobile alerts are enabled.")}
                    </div>
                  ) : (
                    <button
                      className="button guest-primary"
                      onClick={enablePush}
                      disabled={pushBusy}
                    >
                      <Bell size={17} />
                      {pushBusy
                        ? tx("Enabling alerts…")
                        : tx("Notify me when it’s ready")}
                    </button>
                  ))}
                {pushError && (
                  <p className="error" role="alert">
                    {pushError}
                  </p>
                )}
                {!ready && (
                  <div className="guest-live-note">
                    <span className="live-indicator">
                      <i /> {tx("Updates live")}
                    </span>
                    <p>
                      {status.pushEnabled
                        ? tx(
                            "You can leave this page. We’ll send a notification.",
                          )
                        : status.restaurant.smsEnabled && status.smsEligible
                          ? tx(
                              "We’ll text the mobile number you provided. Keep this page for live updates.",
                            )
                          : status.restaurant.pushEnabled
                            ? tx(
                                "Enable alerts above to get notified when this page is closed.",
                              )
                            : tx(
                                "Keep this page open for live updates, or check with our host.",
                              )}
                    </p>
                  </div>
                )}
                <button
                  className="leave-queue"
                  onClick={() => setConfirm(true)}
                >
                  {tx("Need to leave? Cancel this visit")}
                </button>
              </>
            )}
            {(done || cancelled) && (
              <a className="button guest-primary" href="/check-in">
                {tx("Join a new visit")}
                <ArrowRight size={16} />
              </a>
            )}
            {offline && (
              <p className="error" role="alert">
                {tx("Connection interrupted. Retrying automatically…")}
              </p>
            )}
            <div className="guest-safe">
              <ShieldCheck size={15} />
              {tx("This is your private visit link. Keep it handy.")}
            </div>
          </>
        )}
      </div>
      {confirm && (
        <div className="modal-backdrop">
          <section
            className="modal light-modal"
            role="dialog"
            aria-modal="true"
            aria-label={tx("Leave the queue?")}
          >
            <h2>{tx("Leave the queue?")}</h2>
            <p>
              {tx(
                "You’ll lose your current place. You can join again at any time.",
              )}
            </p>
            <div className="modal-actions">
              <button
                className="button secondary"
                onClick={() => setConfirm(false)}
              >
                {tx("Keep my place")}
              </button>
              <button
                className="button danger-button"
                disabled={cancelling}
                onClick={async () => {
                  setCancelling(true);
                  try {
                    await api(`guest/${token}/cancel`, "POST");
                    setStatus((s) => (s ? { ...s, status: "cancelled" } : s));
                    setConfirm(false);
                  } catch (e) {
                    setPushError((e as Error).message);
                  } finally {
                    setCancelling(false);
                  }
                }}
              >
                {cancelling ? tx("Leaving…") : tx("Leave queue")}
              </button>
            </div>
          </section>
        </div>
      )}
    </GuestFrame>
  );
}
function ListIcon() {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M9 6h12M9 12h12M9 18h12M3 5h2v3M3 11h2v3M3 17h2v3" />
    </svg>
  );
}
function DiningArt() {
  const { t: tx, locale, n } = usePreferences();

  return (
    <svg
      viewBox="0 0 600 320"
      role="img"
      aria-label={tx("An inviting table with plates, leaves, and fresh food")}
    >
      <defs>
        <pattern
          id="cloth"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <path d="M0 0h40v40H0z" fill="#dedbc7" />
          <path d="M0 20h40M20 0v40" stroke="#d1ceb9" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="600" height="320" fill="url(#cloth)" />
      <circle cx="305" cy="155" r="132" fill="#c5c1a9" opacity=".5" />
      <circle cx="295" cy="143" r="124" fill="#faf8eb" />
      <circle
        cx="295"
        cy="143"
        r="102"
        fill="none"
        stroke="#dedbc7"
        strokeWidth="2"
      />
      <circle cx="295" cy="143" r="88" fill="#e8e0bc" />
      <path
        d="M244 94c30-27 53-20 62 5s-10 40-28 36-53-22-34-41"
        fill="#76825b"
      />
      <path
        d="M302 170c24-30 61-39 72-16s-7 37-30 37-57-4-42-21"
        fill="#8f9b63"
      />
      <path d="M233 159q12-30 43-9t12 37q-46 23-55-28" fill="#d7a54e" />
      <path d="M288 109q20-27 49-13t11 40q-38 22-60-27" fill="#c47c46" />
      <circle cx="277" cy="175" r="16" fill="#c35943" />
      <circle cx="318" cy="145" r="14" fill="#cd6848" />
      <circle cx="347" cy="129" r="11" fill="#ba513f" />
      <path
        d="M247 129q-25 4-17 16t30-3M298 194q-21 8-9 16t25-7M326 82q-18-13-29 2t26 8"
        fill="#526841"
      />
      <path
        d="M213 219l55-154M247 227l65-165"
        stroke="#eee9cf"
        strokeWidth="4"
        opacity=".8"
      />
      <path
        d="M115 74v170M106 74v48q9 16 18 0V74M115 74v47"
        stroke="#777961"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M458 78v167M457 78q22 33 3 66"
        stroke="#777961"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="517" cy="42" r="47" fill="#faf8eb" />
      <circle cx="517" cy="42" r="35" fill="#bb7150" />
      <circle cx="517" cy="42" r="25" fill="#884d33" />
      <path
        d="M536 37q29-14 27 9t-27 11"
        fill="none"
        stroke="#faf8eb"
        strokeWidth="9"
      />
      <path d="M0 275q63-100 121-41t-29 86" fill="#a8b28d" />
      <path
        d="M16 314q40-66 84-81"
        stroke="#617650"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M8 296q52-22 79-10M37 266q-3 35-11 43M64 246q-5 21-11 26"
        stroke="#617650"
        strokeWidth="2"
        fill="none"
      />
      <path d="M549 253l51-14v81h-70z" fill="#e7c77e" />
      <path d="M539 281l61-17M531 303l69-18" stroke="#ccaa66" strokeWidth="3" />
      <circle cx="152" cy="16" r="45" fill="#7c8d60" />
      <path d="M119 38l61-52M153 24l-3-26" stroke="#516740" strokeWidth="2" />
    </svg>
  );
}
