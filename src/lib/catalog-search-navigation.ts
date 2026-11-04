"use client";

let initiator: HTMLElement | null = null;

/** Retain the actual link across a route transition until Home can open Command. */
export function requestCatalogSearch(control: HTMLElement) {
  initiator = control;
  window.dispatchEvent(new Event("catalog-search-open"));
}

export function takeCatalogSearchInitiator() {
  const control = initiator;
  initiator = null;
  return control;
}
