// Settings for GoldPulse AI.
// GEMINI_API_KEY is stored safely in Vercel Environment Variables (not exposed on GitHub).
window.GOLDPULSE = {
  NEWSDATA_API_KEY: 'pub_e911d294228c4c209f6d102c1b2e1d22',

  // Optional. Prices come free from gold-api.com. If you want GoldAPI as a backup, paste its key here.
  GOLDAPI_KEY: '',

  // Indian price estimate = international price x (1 + import duty) x (1 + GST).
  // Check the current rates and edit if they change.
  IMPORT_DUTY_PCT: 6,
  GST_PCT: 3,

  // Optional: force a specific Gemini model, e.g. 'gemini-2.5-flash'
  GEMINI_MODEL: ''
};