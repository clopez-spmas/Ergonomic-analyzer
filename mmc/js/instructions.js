'use strict';
// Keep this path stable: replacing the PDF updates the welcome instructions.
(() => {
  const link = document.getElementById('instructionsLink');
  if (!link) return;
  const refreshUrl = () => {
    const url = new URL(link.getAttribute('href'), document.baseURI);
    url.searchParams.set('v', String(Date.now()));
    link.href = url.href;
  };
  refreshUrl();
  link.addEventListener('click', refreshUrl);
  link.addEventListener('auxclick', refreshUrl);
})();
