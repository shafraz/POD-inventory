export const THEME_KEY = "theme";

/**
 * Runs before first paint (inlined in <head>) so the page never flashes the wrong theme.
 * Preference is per browser: "light", "dark" or "system" (follows the OS setting).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
