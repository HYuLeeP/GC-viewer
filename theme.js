(() => {
  const key = "bhb-gc-theme";
  let saved;
  try {
    saved = localStorage.getItem(key);
  } catch {}
  const media = matchMedia("(prefers-color-scheme: dark)");
  function apply(value) {
    document.documentElement.dataset.theme = value;
    window.dispatchEvent(new Event("viewer-theme"));
    const b = document.querySelector("#theme-toggle");
    if (b) {
      b.textContent = value === "dark" ? "Light mode" : "Dark mode";
      b.setAttribute("aria-pressed", String(value === "dark"));
    }
  }
  apply(saved || (media.matches ? "dark" : "light"));
  document.addEventListener("DOMContentLoaded", () => {
    apply(saved || (media.matches ? "dark" : "light"));
    document.querySelector("#theme-toggle").addEventListener("click", () => {
      saved =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(key, saved);
      } catch {}
      apply(saved);
    });
  });
  media.addEventListener("change", (e) => {
    if (!saved) apply(e.matches ? "dark" : "light");
  });
})();
