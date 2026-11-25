// Your settings. This is a simple personal project, so the keys sit right here.
// NOTE: anyone who opens your website can read this file, so don't share keys you care about.
window.GOLDPULSE = {
  GEMINI_API_KEY: 'AQ.Ab8RN6LjFW4icj7FBdqAwiduStlTbAtOnr6hg_Hefgl-tDN9cA',
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
