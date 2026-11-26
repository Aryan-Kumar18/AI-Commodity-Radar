// Public settings. Keep API keys OUT of this file, because it is uploaded to GitHub.
// Keys go in keys.js (on your computer) or in Vercel Environment Variables (on the live site).
window.GOLDPULSE = {
  // Indian price estimate = international price x (1 + import duty) x (1 + GST).
  // Check the current rates and edit if they change.
  IMPORT_DUTY_PCT: 6,
  GST_PCT: 3,

  // Optional: force a specific AI model name. Leave empty to choose automatically.
  GEMINI_MODEL: ''
};
