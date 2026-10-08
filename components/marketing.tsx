"use client";
import { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ArrowUpRight,
  Check,
  X,
  CalendarDays,
  Users,
  ListChecks,
  Link as LinkIcon,
  Clock,
  Bell,
  Grid2X2,
  ChartNoAxesCombined,
  Scissors,
  Sparkles,
  Utensils,
  Building,
  Store,
  BookOpen,
  LifeBuoy,
  DollarSign,
  Menu,
  ArrowRight,
  Play,
  Leaf,
} from "lucide-react";
import { products, solutions, resources, plans, faqs } from "../lib/marketing";
import styles from "./marketing.module.css";
const icons: Record<string, typeof Users> = {
  calendar: CalendarDays,
  users: Users,
  list: ListChecks,
  link: LinkIcon,
  clock: Clock,
  bell: Bell,
  grid: Grid2X2,
  chart: ChartNoAxesCombined,
  scissors: Scissors,
  sparkles: Sparkles,
  utensils: Utensils,
  building: Building,
  store: Store,
  book: BookOpen,
  support: LifeBuoy,
  dollar: DollarSign,
};
function Mark() {
  return (
    <a href="/website" className={styles.mark}>
      TABLE<span>Q</span>
    </a>
  );
}
function Item({
  item,
  base,
}: {
  item: { slug: string; title: string; description: string; icon: string };
  base: string;
}) {
  const Icon = icons[item.icon];
  return (
    <a href={`/website/${base}/${item.slug}`} className={styles.menuItem}>
      <span className={styles.icon}>
        <Icon size={23} />
      </span>
      <span>
        <strong>{item.title}</strong>
        <small>{item.description}</small>
      </span>
    </a>
  );
}
function Header() {
  const [open, setOpen] = useState(""),
    [mobile, setMobile] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen("");
        setMobile(false);
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        ref.current
          ?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')
          ?.focus();
        setOpen("");
        setMobile(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, []);
  return (
    <header className={styles.header} ref={ref}>
      <Mark />
      <button
        className={styles.mobileToggle}
        aria-label="Toggle navigation"
        aria-expanded={mobile}
        onClick={() => setMobile(!mobile)}
      >
        {mobile ? <X /> : <Menu />}
      </button>
      <nav
        className={mobile ? styles.navOpen : styles.nav}
        aria-label="Main navigation"
      >
        {["Product", "Solutions", "Resources"].map((name) => (
          <div key={name} className={styles.navItem}>
            <button
              aria-expanded={open === name}
              aria-controls={"menu-" + name}
              onClick={() => setOpen(open === name ? "" : name)}
            >
              {name}
              <ChevronDown size={14} />
            </button>
            {open === name && (
              <div
                id={"menu-" + name}
                className={`${styles.mega} ${name === "Resources" ? styles.resourceMega : ""}`}
              >
                {name === "Product" ? (
                  ["Workflows", "Features"].map((group) => (
                    <div key={group}>
                      <h3>{group}</h3>
                      {products
                        .filter((p) => p.group === group)
                        .map((item) => (
                          <Item key={item.slug} item={item} base="product" />
                        ))}
                    </div>
                  ))
                ) : name === "Solutions" ? (
                  <div className={styles.solutionMenu}>
                    <h3>TABLEQ FOR</h3>
                    {solutions.map((item) => (
                      <Item key={item.slug} item={item} base="solutions" />
                    ))}
                  </div>
                ) : (
                  <div>
                    {resources.map((item) => (
                      <Item key={item.slug} item={item} base="resources" />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <a href="/pricing">Pricing</a>
      </nav>
      <a className={styles.openApp} href="/app">
        Open TableQ
      </a>
    </header>
  );
}
function Preview({ kind = "queue" }: { kind?: string }) {
  return (
    <div className={styles.preview}>
      <div className={styles.previewBar}>
        <span>
          <Leaf size={16} /> The Olive Table
        </span>
        <span>● Live updates</span>
      </div>
      <div className={styles.previewBody}>
        <aside>
          <b>
            TABLE<span>Q</span>
          </b>
          <span>Overview</span>
          <span>Queue</span>
          <span>Customers</span>
          <span>Analytics</span>
          <small>YOUR RESTAURANT</small>
          <span>🌿 The Olive Table</span>
        </aside>
        <div className={styles.previewMain}>
          <h3>
            {kind === "analytics"
              ? "Understand every wait."
              : "A warm welcome starts here."}
          </h3>
          <div className={styles.previewStats}>
            {[
              ["Waiting guests", "12"],
              ["Average wait", "18 min"],
              ["Seated today", "46"],
            ].map(([l, v]) => (
              <div key={l}>
                <small>{l}</small>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          {kind === "analytics" ? (
            <div className={styles.bars}>
              {[32, 65, 48, 82, 58, 93, 72, 55, 40].map((v, i) => (
                <span key={i} style={{ height: v + "%" }} />
              ))}
            </div>
          ) : (
            <div className={styles.previewQueue}>
              <b>
                Your queue <span>+ Add guest</span>
              </b>
              {[
                "Alex Morgan",
                "Olivia Mitchell",
                "Gabriel Wilson",
                "Sophia Bennett",
              ].map((n, i) => (
                <div key={n}>
                  <span className={styles.demoAvatar}>
                    {n
                      .split(" ")
                      .map((v) => v[0])
                      .join("")}
                  </span>
                  <strong>{n}</strong>
                  <small>{i + 2} guests</small>
                  <span className={styles.demoCall}>
                    {i === 0 ? "Table ready" : "Call guest"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <small className={styles.demoCaption}>Illustrative product preview</small>
    </div>
  );
}
function Phone() {
  return (
    <div className={styles.phone}>
      <div className={styles.phoneNotch} />
      <span className={styles.phoneLeaf}>
        <Leaf />
      </span>
      <strong>The Olive Table</strong>
      <small>A warm welcome is waiting.</small>
      <h3>You’re on the list, Alex.</h3>
      <p>Enjoy your time. We’ll let you know when your table is ready.</p>
      <div className={styles.phoneNumber}>
        3<small>in the queue</small>
      </div>
      <span className={styles.phoneButton}>Your place is saved ✓</span>
    </div>
  );
}
function FAQ({ pricing = false }: { pricing?: boolean }) {
  const entries = pricing
    ? [
        [
          "Are these live subscription plans?",
          "These are example plans for the TableQ website. This installation has no subscription checkout, automatic billing, trial timer, or plan enforcement. Your administrator controls access.",
        ],
        [
          "Are customers limited?",
          "The current app does not impose customer or visit quotas. Database and hosting capacity still apply.",
        ],
        [
          "What counts as an SMS notification?",
          "A text sent through your configured Twilio account. Provider pricing and destination coverage depend on your account. The example credits below are not a prepaid balance.",
        ],
        [
          "Can I add more branches?",
          "Yes. Administrators can create and manage branches and assign managers in the CMS.",
        ],
        [
          "Do I need a credit card?",
          "No card is required to sign in to this installation. No payment collection is configured.",
        ],
        ...faqs.slice(2, 6),
      ]
    : faqs;
  return (
    <section className={styles.section} id="faq">
      <h2>Frequently asked questions</h2>
      <div className={styles.faq}>
        {entries.map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <ChevronDown size={16} />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
function CTA() {
  return (
    <section className={styles.cta}>
      <span className={styles.eyebrow}>
        GOOD FOOD. GOOD COMPANY. BETTER WAITS.
      </span>
      <h2>Stop letting guests walk out the door.</h2>
      <p>
        A calmer welcome. A clearer wait. More time for the people at your
        table.
      </p>
      <a className={styles.primary} href="/app">
        Open TableQ <ArrowRight size={16} />
      </a>
    </section>
  );
}
function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div>
          <Mark />
          <p>
            A calmer welcome for every guest.
            <br />
            Digital queues, branded check-in, and real insights for your team.
          </p>
        </div>
        <div>
          <h4>TableQ</h4>
          <a href="/website/about">About</a>
          <a href="/website/contact">Contact</a>
          <a href="/pricing">Pricing</a>
          <a href="/app">Open TableQ</a>
        </div>
        <div>
          <h4>Features</h4>
          {products.map((p) => (
            <a key={p.slug} href={"/website/product/" + p.slug}>
              {p.title}
            </a>
          ))}
        </div>
        <div>
          <h4>Solutions</h4>
          {solutions.map((p) => (
            <a key={p.slug} href={"/website/solutions/" + p.slug}>
              {p.title}
            </a>
          ))}
        </div>
        <div>
          <h4>Resources</h4>
          {resources.map((p) => (
            <a key={p.slug} href={"/website/resources/" + p.slug}>
              {p.title}
            </a>
          ))}
        </div>
      </div>
      <div className={styles.footerBottom}>
        <span>© {new Date().getFullYear()} TableQ</span>
        <a href="/website/privacy">Privacy</a>
        <a href="/website/terms">Terms</a>
        <a href="/website/sitemap">Sitemap</a>
        <span>A better wait.</span>
      </div>
    </footer>
  );
}
function Home() {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>LESS WAITING. MORE WELCOME.</span>
          <h1>
            The queue management system
            <br />
            that keeps customer flow moving
          </h1>
          <p>
            Guests join from their phone. Your team welcomes them with
            confidence.
            <br />
            Manage walk-ins, keep everyone informed, and understand every wait,
            at every location.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.whiteButton} href="/app">
              Open TableQ for your team <ArrowUpRight size={16} />
            </a>
            <a className={styles.outlineButton} href="#how-it-works">
              <Play size={15} /> See how it works
            </a>
          </div>
          <small>
            No guest app downloads · No customer caps · Built for your team
          </small>
        </div>
        <div className={styles.heroProduct}>
          <Preview />
          <Phone />
        </div>
      </section>
      <div className={styles.container}>
        <section className={styles.section}>
          <h2>What is TableQ?</h2>
          <p className={styles.intro}>
            A queue management system that replaces paper lists and crowded
            entrances with a calmer welcome. Give guests a place in line, keep
            your team in control, and turn every visit into insights you can act
            on.
          </p>
          <div className={styles.threeGrid}>
            {[
              [
                "clock",
                "Remove uncertainty",
                "A live status page gives guests a reason to stay.",
              ],
              [
                "users",
                "Move on from manual lists",
                "Welcome guests from one clear, shared queue.",
              ],
              [
                "chart",
                "Know what’s working",
                "See wait times, busy hours, and where guests walk away.",
              ],
            ].map(([icon, title, text]) => {
              const Icon = icons[icon];
              return (
                <article className={styles.benefit} key={title}>
                  <span className={styles.icon}>
                    <Icon />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section className={styles.section} id="how-it-works">
          <h2>How TableQ keeps your queue moving</h2>
          <p>Check in, follow the wait, get notified, and enjoy your visit.</p>
          <div className={styles.twoGrid}>
            {[
              [
                "Check in customers fast",
                "Give every branch its own QR code and branded welcome page.",
                "check-in-page",
                "phone",
              ],
              [
                "Keep everyone in the loop",
                "Guests follow their place with a private, live waiting page.",
                "virtual-waiting-room",
                "queue",
              ],
              [
                "Let guests know it’s their turn",
                "Call the next party and send browser push or configured SMS alerts.",
                "notifications",
                "phone",
              ],
              [
                "Turn wait data into decisions",
                "Find your busiest moments and track the journey from arrival to seating.",
                "wait-analytics",
                "analytics",
              ],
            ].map(([title, text, slug, kind]) => (
              <article key={slug} className={styles.feature}>
                <div className={styles.featureVisual}>
                  {kind === "phone" ? <Phone /> : <Preview kind={kind} />}
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <a href={"/website/product/" + slug}>
                  Explore {title.toLowerCase()} <ArrowUpRight size={14} />
                </a>
              </article>
            ))}
          </div>
        </section>
        <section className={styles.section}>
          <h2>Keep the flow moving, however customers arrive</h2>
          <p>
            A single place for your team to manage arrivals and care for your
            guests.
          </p>
          <div className={styles.twoGrid}>
            <article className={styles.glowCard}>
              <span className={styles.tag}>REAL-TIME QUEUE</span>
              <h3>Take control of the queue</h3>
              <p>
                Add guests, set priorities, call the next party, and keep tables
                moving.
              </p>
              <Preview />
              <a
                className={styles.primary}
                href="/website/product/queue-management"
              >
                More about digital queuing
              </a>
            </article>
            <article className={styles.glowCard}>
              <span className={styles.tag}>YOUR BRAND, YOUR WELCOME</span>
              <h3>Make the first impression yours</h3>
              <p>
                Your company logo, your branch, and a guest experience made for
                mobile.
              </p>
              <div className={styles.featureVisual}>
                <Phone />
              </div>
              <a
                className={styles.primary}
                href="/website/product/check-in-page"
              >
                Explore branded check-in
              </a>
            </article>
          </div>
        </section>
        <section className={styles.section} id="solutions">
          <h2>Designed for the busiest shifts and services</h2>
          <div className={styles.threeGrid}>
            {solutions.map((s, i) => {
              const Icon = icons[s.icon];
              return (
                <a
                  className={styles.solutionCard}
                  href={"/website/solutions/" + s.slug}
                  key={s.slug}
                >
                  <div
                    className={styles.solutionVisual}
                    style={{
                      background: `linear-gradient(135deg, ${["#e5c27a", "#acae85", "#bf9687"][i % 3]}, #514534)`,
                    }}
                  >
                    <Icon size={60} />
                    <span className={styles.tag}>{s.title}</span>
                  </div>
                  <p>{s.description}</p>
                  <strong>
                    TableQ for {s.title.toLowerCase()}{" "}
                    <ArrowUpRight size={14} />
                  </strong>
                </a>
              );
            })}
          </div>
        </section>
        <section className={styles.section}>
          <h2>What makes us different</h2>
          <div className={styles.twoGrid}>
            {[
              [
                "No caps on how you grow",
                "Unlimited visits, multiple branches, and a workspace that keeps up with your team.",
                "analytics",
              ],
              [
                "Looks like your business",
                "Your logo and colors, a familiar welcome from the moment a guest checks in.",
                "phone",
              ],
            ].map(([title, text, kind]) => (
              <article className={styles.brownCard} key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
                <div className={styles.featureVisual}>
                  {kind === "phone" ? <Phone /> : <Preview kind={kind} />}
                </div>
              </article>
            ))}
          </div>
          <div className={styles.threeGrid}>
            {[
              [
                "QR code check-in",
                "Scan, enter basic details, and join the queue.",
              ],
              [
                "One view for your team",
                "Manage guests, occupied seats, and customer history.",
              ],
              [
                "Easy to get started",
                "Use the phones, tablets, and computers you already have.",
              ],
            ].map(([t, p]) => (
              <article className={styles.brownCard} key={t}>
                <h3>{t}</h3>
                <p>{p}</p>
                <Check className={styles.gold} size={34} />
              </article>
            ))}
          </div>
        </section>
        <section className={styles.section}>
          <h2>Everyone wins with TableQ</h2>
          <div className={styles.glowCard}>
            <h3>Happier customers. Calmer staff. Sharper operations.</h3>
            <div className={styles.threeGrid}>
              {[
                [
                  "Customers",
                  "Know your place. Enjoy your wait. Come back when it’s your turn.",
                ],
                [
                  "Staff",
                  "Focus on your guests with a queue that stays organized.",
                ],
                [
                  "Operations",
                  "Make decisions using real wait times, peak patterns, and outcomes.",
                ],
              ].map(([t, p]) => (
                <article className={styles.winCard} key={t}>
                  <Users size={34} />
                  <h3>{t}</h3>
                  <p>{p}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <CTA />
        <FAQ />
      </div>
    </>
  );
}
function Pricing() {
  const [annual, setAnnual] = useState(true);
  return (
    <div className={styles.container}>
      <section className={`${styles.section} ${styles.pricingIntro}`}>
        <h1>Unlimited customers. Simple pricing.</h1>
        <p>
          No visit caps, no per-customer fees. Room to grow, without counting
          every guest.
        </p>
        <div className={styles.billing}>
          <button aria-pressed={!annual} onClick={() => setAnnual(false)}>
            Monthly
          </button>
          <button aria-pressed={annual} onClick={() => setAnnual(true)}>
            Annual
          </button>
          <small>Save with annual billing</small>
        </div>
        <p className={styles.notice}>
          Example plans for this website. Billing and paid subscriptions are not
          enabled.
        </p>
        <div className={styles.threeGrid}>
          {plans.map((p, i) => (
            <article
              className={`${styles.plan} ${styles.glowCard}`}
              key={p.name}
            >
              <h2>
                {p.name}{" "}
                {i === 1 && <span className={styles.tag}>Most popular</span>}
              </h2>
              <p>
                {
                  [
                    "For a single location getting started.",
                    "For growing teams with more locations.",
                    "For businesses managing busy operations.",
                  ][i]
                }
              </p>
              <div className={styles.price}>
                ${annual ? p.annual : p.monthly}
                <small>
                  /month {annual ? "billed annually" : "billed monthly"}
                </small>
              </div>
              <ul>
                {[
                  `${p.locations} business location${p.locations > 1 ? "s" : ""}`,
                  "Unlimited waitlist visits",
                  "Unlimited customer profiles",
                  `${p.staff} staff accounts`,
                  "On-brand check-in page",
                  "QR code check-in",
                  "Browser push notifications",
                  `${p.credits} example SMS credits / month`,
                  `${p.history} days analytics`,
                ].map((f) => (
                  <li key={f}>
                    <Check size={15} />
                    {f}
                  </li>
                ))}
              </ul>
              <a className={styles.primary} href="/app">
                Open TableQ
              </a>
            </article>
          ))}
        </div>
      </section>
      <section className={`${styles.section} ${styles.quoteSection}`}>
        <div>
          <h2>Flexible pricing for every scenario</h2>
          <p>
            Have something different in mind? Let’s find the right setup for
            your team.
          </p>
        </div>
        <div>
          {[
            [
              "Need more locations or features?",
              "Talk to your administrator about branches, team accounts, and your requirements.",
            ],
            [
              "Running an event?",
              "Plan customer arrivals and a branded check-in experience for your event.",
            ],
          ].map(([t, p]) => (
            <a href="/website/contact" key={t} className={styles.quoteCard}>
              <span className={styles.icon}>
                <Users />
              </span>
              <div>
                <h3>{t}</h3>
                <p>{p}</p>
                <strong>
                  Discuss your requirements <ArrowUpRight size={14} />
                </strong>
              </div>
            </a>
          ))}
        </div>
      </section>
      <section className={styles.section}>
        <h2 className={styles.center}>Compare our plans in detail</h2>
        <div className={styles.tableScroll}>
          <table className={styles.comparison}>
            <thead>
              <tr>
                <th>Feature</th>
                {plans.map((p) => (
                  <th key={p.name}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "Key functionalities",
                  [
                    ["Waitlists", "Unlimited", "Unlimited", "Unlimited"],
                    [
                      "Customer profiles",
                      "Unlimited",
                      "Unlimited",
                      "Unlimited",
                    ],
                  ],
                ],
                [
                  "Capacity",
                  [
                    ["Staff accounts", ...plans.map((p) => p.staff)],
                    [
                      "Locations included",
                      ...plans.map((p) => String(p.locations)),
                    ],
                  ],
                ],
                [
                  "Customers",
                  [
                    [
                      "Example SMS credits",
                      ...plans.map((p) => String(p.credits) + " / month"),
                    ],
                    [
                      "Customer history",
                      ...plans.map((p) => String(p.history) + " days"),
                    ],
                    [
                      "Analytics",
                      ...plans.map((p) => String(p.history) + " days"),
                    ],
                  ],
                ],
                [
                  "Features",
                  [
                    ...[
                      "Business check-in page",
                      "Brand customization",
                      "QR code check-in",
                      "Virtual waiting room",
                      "Estimated waiting time",
                      "Multi-language support",
                      "Data exports",
                      "Seat capacity tracking",
                    ].map((n) => [n, "✓", "✓", "✓"]),
                    ["Scheduled appointments", "Planned", "Planned", "Planned"],
                    [
                      "Digital floor plans",
                      "Not included",
                      "Not included",
                      "Not included",
                    ],
                  ],
                ],
                [
                  "Support",
                  [
                    ["Help center", "Included", "Included", "Included"],
                    ["Contact support", "In app", "In app", "In app"],
                  ],
                ],
              ].map(([section, rows]) => (
                <SectionRows
                  key={section as string}
                  title={section as string}
                  rows={rows as string[][]}
                />
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.notice}>
          Comparison illustrates proposed packages; the current app does not
          enforce these plan quotas. SMS requires your own configured provider
          account.
        </p>
      </section>
      <div className={styles.valueCallout}>
        <strong>
          One extra customer who stays can make all the difference.
        </strong>
        <a className={styles.primary} href="/website/resources/roi-calculator">
          Explore your ROI
        </a>
      </div>
      <FAQ pricing />
      <CTA />
    </div>
  );
}
function SectionRows({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <>
      <tr className={styles.tableGroup}>
        <th colSpan={4}>{title}</th>
      </tr>
      {rows.map((row) => (
        <tr key={row[0]}>
          {row.map((v, i) =>
            i === 0 ? (
              <th key={i}>{v}</th>
            ) : (
              <td key={i} className={v === "✓" ? styles.gold : undefined}>
                {v}
              </td>
            ),
          )}
        </tr>
      ))}
    </>
  );
}
function Calculator() {
  const [visitors, setVisitors] = useState(100),
    [lost, setLost] = useState(10),
    [spend, setSpend] = useState(25),
    [recovered, setRecovered] = useState(30);
  const money = ((((visitors * lost) / 100) * spend * recovered) / 100) * 30;
  return (
    <section className={styles.calculator}>
      <div>
        {[
          ["Daily visitors", visitors, setVisitors, 10000],
          ["Guests who leave (%)", lost, setLost, 100],
          ["Average spend ($)", spend, setSpend, 10000],
          ["Walk-aways you could recover (%)", recovered, setRecovered, 100],
        ].map(([label, value, set, max]) => (
          <label key={label as string}>
            {label as string}
            <input
              type="number"
              min="0"
              max={max as number}
              value={value as number}
              onChange={(e) =>
                (set as (n: number) => void)(
                  Math.min(max as number, Math.max(0, Number(e.target.value))),
                )
              }
            />
          </label>
        ))}
      </div>
      <div className={styles.roiResult}>
        <small>POTENTIAL MONTHLY REVENUE RECOVERED</small>
        <strong>
          {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(money)}
        </strong>
        <p>
          Estimate based on 30 days. This is a scenario, not a forecast or
          guaranteed return.
        </p>
      </div>
    </section>
  );
}
function Detail({ slug }: { slug: string[] }) {
  const path = slug.join("/"),
    entry =
      products.find((p) => path === "product/" + p.slug) ||
      solutions.find((p) => path === "solutions/" + p.slug) ||
      resources.find((p) => path === "resources/" + p.slug);
  const title =
    entry?.title ||
    (
      {
        about: "About TableQ",
        contact: "Let’s talk about your setup",
        privacy: "Privacy",
        terms: "Terms of use",
        sitemap: "Explore TableQ",
      } as Record<string, string>
    )[path] ||
    "TableQ";
  return (
    <div className={styles.container}>
      <section className={`${styles.section} ${styles.detail}`}>
        <a className={styles.back} href="/website">
          ← Back to TableQ
        </a>
        <span className={styles.eyebrow}>A BETTER WAIT</span>
        <h1>{title}</h1>
        <p className={styles.intro}>
          {entry?.description ||
            "A calmer welcome, built around your guests and your team."}
        </p>
        {path === "resources/roi-calculator" ? (
          <Calculator />
        ) : path === "resources/help-center" ? (
          <div className={styles.faq}>
            {[
              [
                "1. Set up your branches",
                "Sign in to the CMS as an administrator. Add your branch name, address, opening hours, and seating capacity. Upload your company logo.",
              ],
              [
                "2. Invite your managers",
                "Create manager accounts in CMS → Manager accounts and assign their branches. Share their initial credentials privately.",
              ],
              [
                "3. Display your QR code",
                "Select a branch in the workspace, open Check-in QR, and print or display the code. Guests can scan it to join.",
              ],
              [
                "4. Welcome the next guest",
                "Open Queue, call a waiting party when there is space, and mark them as seated. Release their seats when they leave.",
              ],
              [
                "5. Configure guest notifications",
                "Browser push requires HTTPS and push keys. For SMS, configure Twilio and run the notification worker. Guests must consent to visit notifications.",
              ],
            ].map(([q, a]) => (
              <details open key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        ) : path === "resources/blog" ? (
          <div className={styles.threeGrid}>
            {[
              [
                "Make the first five minutes count",
                "Put your QR code where guests can see it, keep the check-in form simple, and make sure your host can help anyone who prefers to check in in person.",
              ],
              [
                "Make the wait feel shorter",
                "Tell guests where they stand. A clear place in the queue and timely updates can reduce uncertainty while they wait.",
              ],
              [
                "Plan for your busiest hours",
                "Review hourly and weekday demand in Analytics. Use the pattern to schedule staff and understand where guests leave before being seated.",
              ],
            ].map(([h, p]) => (
              <article className={styles.brownCard} key={h}>
                <BookOpen className={styles.gold} />
                <h2>{h}</h2>
                <p>{p}</p>
              </article>
            ))}
          </div>
        ) : path === "contact" ? (
          <div className={styles.brownCard}>
            <h2>Tell your team what you need</h2>
            <p>
              For support, feature requests, or questions about your setup, sign
              in to TableQ and choose <strong>Contact support</strong> from your
              account menu. Requests are saved for your workspace
              administrators.
            </p>
            <p>
              Need an account or a custom rollout? Contact the administrator who
              manages your TableQ installation.
            </p>
            <a className={styles.primary} href="/login">
              Sign in to contact support
            </a>
          </div>
        ) : path === "sitemap" ? (
          <div className={styles.threeGrid}>
            {[products, solutions, resources].map((items, i) => (
              <div key={i}>
                {items.map((p) => (
                  <Item
                    item={p}
                    base={["product", "solutions", "resources"][i]}
                    key={p.slug}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : path === "privacy" || path === "terms" ? (
          <div className={styles.prose}>
            <h2>
              {path === "privacy" ? "Your information" : "Using your workspace"}
            </h2>
            <p>
              {path === "privacy"
                ? "TableQ stores customer contact details, visit history, manager account information, uploaded logos, and support requests in the database of this installation. Managers can access customer information for their assigned branches. Your administrator is responsible for the operation and retention of that data."
                : "Access to this installation is provided by your administrator. Use your account only for authorized work, keep credentials private, and obtain consent before sending customer notifications. External hosting and notification providers may charge separately."}
            </p>
            <h2>
              {path === "privacy"
                ? "Notifications and preferences"
                : "Service and billing"}
            </h2>
            <p>
              {path === "privacy"
                ? "Language preferences are stored in your browser and account. Browser push requires permission; SMS sends guest phone numbers and message content to your configured SMS provider. Contact your workspace administrator for access, correction, or deletion requests."
                : "Website prices illustrate potential packages. No subscription checkout, payment collection, or automatic trial is configured. Scheduled appointments, WhatsApp/email alerts, and digital floor plans are not enabled in this release."}
            </p>
            <p>
              This page describes the current software. The operator should
              publish its own organization-specific terms and privacy contact
              before offering the service publicly.
            </p>
          </div>
        ) : (
          <>
            <div className={styles.featureVisual}>
              {path.includes("analytics") ? (
                <Preview kind="analytics" />
              ) : path.includes("check-in") || path.includes("waiting-room") ? (
                <Phone />
              ) : (
                <Preview />
              )}
            </div>
            <div className={styles.twoGrid}>
              <article className={styles.brownCard}>
                <h2>
                  {"available" in (entry || {}) &&
                  !(entry as (typeof products)[number]).available
                    ? "Coming next"
                    : "A clearer welcome"}
                </h2>
                <p>
                  {"available" in (entry || {}) &&
                  !(entry as (typeof products)[number]).available
                    ? "Scheduled appointments are planned for a future release. You can use TableQ today to manage walk-in queues and customer history."
                    : path === "product/notifications"
                      ? "Notify called guests with browser push or SMS through your configured Twilio account. Email and WhatsApp delivery are not enabled in the current release."
                      : path === "product/table-management"
                        ? "Track branch capacity, reserve seats for called parties, and release seats after service. Digital floor plans and individual table assignments are not enabled in this release."
                        : "Give guests a simple check-in, keep your managers in control, and follow the customer journey with live status and visit history."}
                </p>
              </article>
              <article className={styles.brownCard}>
                <h2>Your team, in control</h2>
                <p>
                  Administrators create branches and manager accounts. Staff
                  access their assigned locations, with customer profiles, visit
                  notes, and a live queue.
                </p>
                <a className={styles.primary} href="/app">
                  Open TableQ <ArrowRight size={16} />
                </a>
              </article>
            </div>
            {path.startsWith("solutions/") &&
              path !== "solutions/restaurants" && (
                <p className={styles.notice}>
                  TableQ currently uses restaurant parties and seat capacity.
                  This page describes a possible use case; industry-specific
                  workflows such as per-barber scheduling are not included.
                </p>
              )}
          </>
        )}
      </section>
      <CTA />
    </div>
  );
}
export default function Marketing({
  page = "home",
  slug = [],
}: {
  page?: "home" | "pricing" | "detail";
  slug?: string[];
}) {
  return (
    <div className={styles.site} dir="ltr" lang="en">
      <Header />
      <main>
        {page === "home" ? (
          <Home />
        ) : page === "pricing" ? (
          <Pricing />
        ) : (
          <Detail slug={slug} />
        )}
      </main>
      <Footer />
    </div>
  );
}
