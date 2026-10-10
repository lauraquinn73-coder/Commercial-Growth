window.CG_CONFIG = {
  // Tally hosts and receives enquiries. Do not send personal data in URL parameters.
  tallyFormUrl: "https://tally.so/r/WOGzKv",

  // Free Google Analytics 4. Paste your Measurement ID here once the GA4
  // web stream is created, e.g. G-ABC123DE45. Analytics will remain fully
  // disabled until a real G- ID is present and the visitor opts in.
  gaMeasurementId: "G-5PNH8XMW8N",

  contactEmail: "lauraqbusiness@gmail.com",
  auditLaunchPrice: "\u20AC349",

  // Cloudflare Turnstile public site key; configured before public launch.
  // The corresponding SECRET goes only in the Cloudflare Worker, never here.
  turnstileSiteKey: "0x4AAAAAAFTIPW3EQbNU1DIQ",

  // Set to the Cloudflare Worker HTTPS origin after testing.
  // Until then the scanner UI will clearly say it is not connected.
  // Local preview only. Production remains disconnected until a secure deployment.
  scannerEndpoint: ((location.hostname === "localhost" || location.hostname === "127.0.0.1") && location.port === "8000")
    ? "http://127.0.0.1:8787"
    : "https://commercial-growth-intelligence.commercialgrowth-laura.workers.dev"
};
