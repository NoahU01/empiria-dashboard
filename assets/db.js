/* Gemeinsamer Zugang zur Datenbank (Supabase „dashboard empiria“) für Seiten außer Kontakte.
   Die Anmeldung (Login-Link) gilt für alle Seiten des Dashboards auf diesem Gerät.
   Der Schlüssel ist bewusst öffentlich – gelesen werden kann nur mit Anmeldung + Freigabe. */
window.empiriaDb = window.supabase ? window.supabase.createClient("https://abwynhhoyhppvcecrxxa.supabase.co", "sb_publishable_P7tU5WUl5L4QuhAgzxqW3g_jTG1CxON",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null;
