// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = "Íñigo Aréjula Aísa";
export const SITE_DESCRIPTION =
  "Personal blog of Íñigo Aréjula. I write about web development,cloud, software engineering, and other topics that interest me." +
  "Blog personal de Íñigo Aréjula. Escribo sobre desarrollo web,nube, ingeniería de software y otros temas que me interesan.";

export const TWITTER_HANDLE = "@arejula27";
export const MY_NAME = "Íñigo Aréjula Aísa";

// setup in astro.config.mjs
const BASE_URL = new URL(import.meta.env.SITE);
export const SITE_URL = BASE_URL.origin;
