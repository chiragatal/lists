// Each request must hit the Worker so server hooks can enforce auth.
export const prerender = false;
// Keep client-side rendering for the SPA-style experience.
export const ssr = false;
