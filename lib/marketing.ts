export const products = [
  {
    slug: "appointments",
    title: "Appointments",
    description: "Plan ahead and welcome booked guests alongside walk-ins.",
    icon: "calendar",
    group: "Workflows",
    available: false,
  },
  {
    slug: "queue-management",
    title: "Queue management",
    description:
      "Add guests, track their position, and keep your queue moving.",
    icon: "users",
    group: "Workflows",
    available: true,
  },
  {
    slug: "guest-lists",
    title: "Guest lists",
    description: "Keep customer details and visit history in one place.",
    icon: "list",
    group: "Workflows",
    available: true,
  },
  {
    slug: "check-in-page",
    title: "Check-in page",
    description: "A branded welcome, ready for every customer arrival.",
    icon: "link",
    group: "Features",
    available: true,
  },
  {
    slug: "virtual-waiting-room",
    title: "Virtual waiting room",
    description: "A private, live page for each guest to follow their wait.",
    icon: "clock",
    group: "Features",
    available: true,
  },
  {
    slug: "notifications",
    title: "Notifications",
    description:
      "Push and SMS alerts so guests know when their table is ready.",
    icon: "bell",
    group: "Features",
    available: true,
  },
  {
    slug: "table-management",
    title: "Table management",
    description:
      "Track occupied capacity and release seats as tables become free.",
    icon: "grid",
    group: "Features",
    available: true,
  },
  {
    slug: "wait-analytics",
    title: "Wait analytics",
    description: "Understand waits, peak hours, and the guest journey.",
    icon: "chart",
    group: "Features",
    available: true,
  },
];
export const solutions = [
  {
    slug: "barbershops",
    title: "Barbershops",
    description: "Keep walk-ins organized and let customers wait their way.",
    icon: "scissors",
  },
  {
    slug: "salons",
    title: "Hair & beauty salons",
    description: "Give every guest a calmer welcome at your salon.",
    icon: "sparkles",
  },
  {
    slug: "events",
    title: "Events & activations",
    description:
      "Organize customer arrivals at pop-ups, venues, and activations.",
    icon: "calendar",
  },
  {
    slug: "restaurants",
    title: "Restaurants & cafes",
    description: "Welcome walk-ins at restaurants, cafes, and food trucks.",
    icon: "utensils",
  },
  {
    slug: "hotels",
    title: "Hotels & resorts",
    description:
      "Manage guest arrivals at breakfast, the front desk, and more.",
    icon: "building",
  },
  {
    slug: "retail",
    title: "Retail & services",
    description:
      "Reduce the uncertainty of waiting at stores and service counters.",
    icon: "store",
  },
];
export const resources = [
  {
    slug: "blog",
    title: "Blog",
    description: "Practical ideas for better waits and happier guests.",
    icon: "book",
  },
  {
    slug: "help-center",
    title: "Help center",
    description: "Step-by-step guidance for setting up and using TableQ.",
    icon: "support",
  },
  {
    slug: "roi-calculator",
    title: "ROI calculator",
    description: "Explore what fewer walk-aways could mean for your business.",
    icon: "dollar",
  },
];
export const plans = [
  {
    name: "Starter",
    monthly: 32,
    annual: 27,
    locations: 1,
    staff: "5",
    credits: 100,
    history: 30,
  },
  {
    name: "Grow",
    monthly: 59,
    annual: 49,
    locations: 2,
    staff: "20",
    credits: 400,
    history: 60,
  },
  {
    name: "Business",
    monthly: 149,
    annual: 119,
    locations: 5,
    staff: "Unlimited",
    credits: 1000,
    history: 90,
  },
];
export const faqs = [
  [
    "What is TableQ?",
    "TableQ is a restaurant queue management system. Your team manages arrivals, guests check in from their phones, and everyone gets a clearer view of the wait.",
  ],
  [
    "How does a digital queue work?",
    "Guests scan your branch QR code and enter their details. Managers see them in the queue, call them when space is available, and mark them as seated.",
  ],
  [
    "Do customers need an app or an account?",
    "No. Guests join and follow their wait using a private link in their mobile browser.",
  ],
  [
    "Do we need special hardware?",
    "No. Your managers can use an existing computer, tablet, or phone with a modern browser.",
  ],
  [
    "What if a customer prefers not to use their phone?",
    "Your team can add a guest directly from the manager workspace and keep them updated in person.",
  ],
  [
    "Does TableQ support scheduled bookings?",
    "This version focuses on walk-in queues. Scheduled appointments and reservations are planned; they are not enabled in the current app.",
  ],
  [
    "How do notifications work?",
    "Browser push alerts are supported. SMS requires a configured Twilio account and customer consent. Provider charges apply. Email and WhatsApp notifications are not enabled in this version.",
  ],
  [
    "Can we use our own logo and colors?",
    "Yes. An administrator can upload a company logo for each branch. Managers can choose preset website colors or a custom hex color, along with light, dark, or system appearance.",
  ],
  [
    "Which languages are available?",
    "The manager app supports English, Spanish, Portuguese, German, French, Italian, and Urdu, including right-to-left layouts for Urdu.",
  ],
  [
    "How do I get started?",
    "Open TableQ and sign in with an account provided by your administrator. Administrators can add branches and manager accounts in the CMS.",
  ],
];
