const MIN_PLOT_SCALE = 0.1;
const SVG_NS = "http://www.w3.org/2000/svg";
const XHTML_NS = "http://www.w3.org/1999/xhtml";

const colors = {
  ink: "#1d2624",
  secondary: "#4d5753",
  tertiary: "#737973",
  muted: "#969990",
  rule: "rgba(29, 38, 36, 0.14)",
  ruleStrong: "rgba(29, 38, 36, 0.26)",
  paper: "#faf7ef",
  selection: "#8f3e24",
  bhb: "#66ccff",
  rhb: "#008a49",
  rgb: "#ff0000",
  rrl: "#ed8c18",
};

const elements = {
  workspace: document.querySelector(".workspace"),
  summaryLine: document.querySelector("#summary-line"),
  plotBuilder: document.querySelector("#plot-builder"),
  builderX: document.querySelector("#builder-x"),
  builderY: document.querySelector("#builder-y"),
  builderColor: document.querySelector("#builder-color"),
  builderSwapAxes: document.querySelector("#builder-swap-axes"),
  builderInvertX: document.querySelector("#builder-invert-x"),
  builderInvertY: document.querySelector("#builder-invert-y"),
  builderHideLikely: document.querySelector("#builder-hide-likely"),
  builderMinStars: document.querySelector("#builder-min-stars"),
  builderXiang: document.querySelector("#builder-xiang"),
  builderStatus: document.querySelector("#builder-status"),
  clusterSearch: document.querySelector(".cluster-search"),
  clusterSearchInput: document.querySelector("#cluster-search-input"),
  clusterSearchResults: document.querySelector("#cluster-search-results"),
  clusterSearchStatus: document.querySelector("#cluster-search-status"),
  figureGroup: document.querySelector("#figure-group"),
  figureTitle: document.querySelector("#figure-title"),
  figureDescription: document.querySelector("#figure-description"),
  figurePosition: document.querySelector("#figure-position"),
  figureWorkspace: document.querySelector("#figure-workspace"),
  figureNavigationHint: document.querySelector("#figure-navigation-hint"),
  figureKey: document.querySelector("#figure-key"),
  resetPlotViews: document.querySelector("#reset-plot-views"),
  resizerLeft: document.querySelector("#resizer-left"),
  resizerRight: document.querySelector("#resizer-right"),
  figureLoading: document.querySelector("#figure-loading"),
  figureMount: document.querySelector("#figure-mount"),
  plotFrame: document.querySelector(".plot-frame"),
  resizerPlotHeight: document.querySelector("#resizer-plot-height"),
  pointTooltip: document.querySelector("#point-tooltip"),
  cmdTitle: document.querySelector("#cmd-title"),
  cmdStage: document.querySelector("#cmd-stage"),
  cmdCanvas: document.querySelector("#cmd-canvas"),
  cmdEmpty: document.querySelector("#cmd-empty"),
  cmdLoading: document.querySelector("#cmd-loading"),
  cmdError: document.querySelector("#cmd-error"),
  cmdErrorMessage: document.querySelector("#cmd-error-message"),
  cmdLegend: document.querySelector("#cmd-legend"),
  cmdZoomIn: document.querySelector("#cmd-zoom-in"),
  cmdZoomOut: document.querySelector("#cmd-zoom-out"),
  cmdReset: document.querySelector("#cmd-reset"),
  clusterTitle: document.querySelector("#cluster-title"),
  clusterOrigin: document.querySelector("#cluster-origin"),
  infoEmpty: document.querySelector("#info-empty"),
  infoValues: document.querySelector("#info-values"),
  infoBhbRgb: document.querySelector("#info-bhb-rgb"),
  infoBhbRgbError: document.querySelector("#info-bhb-rgb-error"),
  infoHbIndex: document.querySelector("#info-hb-index"),
  infoHbIndexError: document.querySelector("#info-hb-index-error"),
  infoAge: document.querySelector("#info-age"),
  infoAgeError: document.querySelector("#info-age-error"),
  infoMh: document.querySelector("#info-mh"),
  infoMhError: document.querySelector("#info-mh-error"),
  infoEbv: document.querySelector("#info-ebv"),
  infoEbvError: document.querySelector("#info-ebv-error"),
  countStrip: document.querySelector("#count-strip"),
  provenance: document.querySelector("#provenance-content"),
  globalStatus: document.querySelector("#global-status"),
};

const state = {
  data: null,
  clusterById: new Map(),
  figureById: new Map(),
  activeFigureId: null,
  selectedClusterId: null,
  hoveredClusterId: null,
  cmdCache: new Map(),
  cmdPayload: null,
  cmdView: null,
  cmdInitialView: null,
  cmdRequest: 0,
  cmdAbortController: null,
  cmdDrag: null,
  densityImages: new Map(),
  densityRepaintFrame: null,
  colorRanges: new Map(),
  plotTransforms: new Map(),
  figureTransforms: new Map(),
  panelLayout: null,
  figureDrag: null,
  suppressFigureClickUntil: 0,
  plotFrameHeight: null,
  serverSessionId: null,
  clusterSearchMatches: [],
  clusterSearchActiveIndex: -1,
  builder: {
    x: "age_gyr",
    y: "mh",
    color: "",
    layout: "main",
    showXiang: true,
    invertX: false,
    invertY: false,
    hideLikely: false,
    minStars: 100,
  },
  variablesById: new Map(),
};

function svgElement(name, attributes = {}, text = null) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== null && value !== undefined) {
      node.setAttribute(key, String(value));
    }
  }
  if (text !== null) {
    node.textContent = String(text);
  }
  return node;
}

function htmlElement(tag, className = null, text = null) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== null) {
    node.textContent = String(text);
  }
  return node;
}

function escapeSelector(value) {
  return globalThis.CSS?.escape
    ? CSS.escape(value)
    : String(value).replaceAll('"', '\\"');
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatNumber(value, digits = 2, signed = false) {
  if (!finite(value)) {
    return "—";
  }
  const sign = signed && value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

function formatAsymmetry(low, high, digits = 2) {
  if (!finite(low) || !finite(high)) {
    return "uncertainty unavailable";
  }
  return `+${high.toFixed(digits)} / −${low.toFixed(digits)}`;
}

function formatTooltipDatum(value) {
  if (!finite(value)) {
    return "—";
  }
  const magnitude = Math.abs(value);
  const digits =
    magnitude >= 10 ? 2 : magnitude >= 1 ? 2 : magnitude >= 0.01 ? 3 : 4;
  return formatNumber(value, digits, true);
}

function indexDigits(value, error) {
  const magnitudes = [value, error]
    .filter((item) => finite(item))
    .map((item) => Math.abs(item));
  if (magnitudes.length && Math.max(...magnitudes) < 0.01) {
    return 4;
  }
  return 3;
}

function slug(value) {
  return (
    String(value)
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "cluster"
  );
}

function parseHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  return {
    x: params.get("x"),
    y: params.get("y"),
    color: params.get("color"),
    layout: params.get("layout"),
    xiang: params.get("xiang"),
    invertX: params.get("invert_x"),
    invertY: params.get("invert_y"),
    hideLikely: params.get("hide_likely"),
    minStars: params.get("min_stars"),
    clusterId: params.get("cluster"),
  };
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function niceStep(span, targetTicks = 6) {
  if (!Number.isFinite(span) || span <= 0) {
    return 1;
  }
  const raw = span / Math.max(targetTicks, 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const residual = raw / magnitude;
  let nice = 1;
  if (residual > 5) {
    nice = 10;
  } else if (residual > 2) {
    nice = 5;
  } else if (residual > 1) {
    nice = 2;
  }
  return nice * magnitude;
}

function ticksForDomain(domain, targetTicks = 6) {
  const [minimum, maximum] = domain;
  if (!finite(minimum) || !finite(maximum) || maximum <= minimum) {
    return [minimum || 0];
  }
  const step = niceStep(maximum - minimum, targetTicks);
  const first = Math.ceil(minimum / step) * step;
  const ticks = [];
  for (let value = first; value <= maximum + step * 1e-7; value += step) {
    const rounded =
      Math.abs(value) < step * 1e-8 ? 0 : Number(value.toPrecision(12));
    ticks.push(rounded);
  }
  if (ticks.length < 2) {
    ticks.push(minimum, maximum);
  }
  return uniqueSorted(ticks);
}

function formatTick(value, span) {
  if (!finite(value)) {
    return "";
  }
  if (value === 0) {
    return "0";
  }
  const absoluteSpan = Math.abs(span);
  if (absoluteSpan >= 200) {
    return value.toFixed(0);
  }
  if (absoluteSpan >= 20) {
    return value.toFixed(1);
  }
  if (absoluteSpan >= 2) {
    return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }
  if (absoluteSpan >= 0.2) {
    return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function expandDomain(minimum, maximum, fraction = 0.07) {
  if (!finite(minimum) || !finite(maximum)) {
    return [0, 1];
  }
  if (maximum === minimum) {
    const padding = Math.max(Math.abs(minimum) * 0.1, 0.5);
    return [minimum - padding, maximum + padding];
  }
  const padding = (maximum - minimum) * fraction;
  return [minimum - padding, maximum + padding];
}

function pointValues(series) {
  const values = [];
  for (let index = 0; index < series.x.length; index += 1) {
    const x = series.x[index];
    const y = series.y[index];
    if (!finite(x) || !finite(y)) {
      continue;
    }
    values.push({
      index,
      clusterId: series.cluster_ids[index],
      x,
      y,
      xLow: series.x_low?.[index],
      xHigh: series.x_high?.[index],
      yLow: series.y_low?.[index],
      yHigh: series.y_high?.[index],
      fillColor: series.fill_colors?.[index] || series.color || colors.ink,
      colorValue: series.color_values?.[index],
      colorLabel: series.color_label,
      marker: series.marker || "circle",
      size: series.size || 4.5,
    });
  }
  return values;
}

function collectDomain(panel, density) {
  const xValues = [];
  const yValues = [];
  let xMinimum = Infinity;
  let xMaximum = -Infinity;
  let yMinimum = Infinity;
  let yMaximum = -Infinity;

  function include(x, y) {
    if (!finite(x) || !finite(y)) {
      return;
    }
    xMinimum = Math.min(xMinimum, x);
    xMaximum = Math.max(xMaximum, x);
    yMinimum = Math.min(yMinimum, y);
    yMaximum = Math.max(yMaximum, y);
  }

  for (const series of panel.series) {
    if (series.type === "points") {
      for (const point of pointValues(series)) {
        xValues.push(point.x);
        yValues.push(point.y);
        include(point.x, point.y);
        if (finite(point.xLow)) include(point.x - point.xLow, point.y);
        if (finite(point.xHigh)) include(point.x + point.xHigh, point.y);
        if (finite(point.yLow)) include(point.x, point.y - point.yLow);
        if (finite(point.yHigh)) include(point.x, point.y + point.yHigh);
      }
    } else if (series.type === "line") {
      for (let index = 0; index < series.x.length; index += 1) {
        include(series.x[index], series.y[index]);
      }
    } else if (series.type === "reference") {
      if (series.orientation === "horizontal") {
        include(panel.x_domain?.[0] ?? 0, series.value);
        include(panel.x_domain?.[1] ?? 1, series.value);
      } else {
        include(series.value, panel.y_domain?.[0] ?? 0);
        include(series.value, panel.y_domain?.[1] ?? 1);
      }
    }
  }

  if (density) {
    include(density.x[0], density.y[0]);
    include(density.x.at(-1), density.y.at(-1));
  }

  const xDomain = panel.x_domain
    ? [...panel.x_domain]
    : expandDomain(xMinimum, xMaximum);
  const yDomain = panel.y_domain
    ? [...panel.y_domain]
    : expandDomain(yMinimum, yMaximum);
  return { xDomain, yDomain };
}

function makeDensityImage(density) {
  const cacheKey = `${density.width}x${density.height}:${density.threshold}`;
  if (state.densityImages.has(cacheKey)) {
    return state.densityImages.get(cacheKey);
  }

  const canvas = document.createElement("canvas");
  canvas.width = density.width;
  canvas.height = density.height;
  const context = canvas.getContext("2d");
  const image = context.createImageData(density.width, density.height);
  const [red, green, blue] = [102, 204, 255];
  const threshold = density.threshold;
  for (let index = 0; index < density.values.length; index += 1) {
    const value = density.values[index];
    const offset = index * 4;
    if (finite(value) && value >= threshold) {
      image.data[offset] = red;
      image.data[offset + 1] = green;
      image.data[offset + 2] = blue;
      image.data[offset + 3] = Math.round(255 * density.alpha);
    }
  }
  context.putImageData(image, 0, 0);
  const url = canvas.toDataURL("image/png");
  state.densityImages.set(cacheKey, url);
  return url;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function plotKey(layoutKey, panelIndex) {
  return `${layoutKey}:${panelIndex}`;
}

function updatePlotResetVisibility() {
  const figureTransform = state.figureTransforms.get(
    figureLayoutKey(activeFigure()),
  );
  const figureIsZoomed =
    figureTransform && Math.abs(figureTransform.scale - 1) > 0.001;
  const hasZoom =
    activeFigure()?.panels.length === 1 &&
    [...elements.figureMount.querySelectorAll(".plot-viewport")].some(
      (viewport) => {
        const transform = state.plotTransforms.get(viewport.dataset.plotKey);
        return transform && Math.abs(transform.scale - 1) > 0.001;
      },
    );
  elements.resetPlotViews.hidden = !hasZoom && !figureIsZoomed;
}

function resetCurrentFigureViews() {
  for (const viewport of elements.figureMount.querySelectorAll(
    ".plot-viewport",
  )) {
    resetPlotView(viewport, viewport.dataset.plotKey);
  }
  applyFigureTransform({ scale: 1, x: 0, y: 0 });
  elements.globalStatus.textContent = "Figure zoom reset.";
  updatePlotResetVisibility();
}

function activeFigure() {
  return state.figureById.get(state.activeFigureId) || null;
}

function figureLayoutKey(figure) {
  if (!figure) {
    return "no-figure";
  }
  return `${figure.columns}:${figure.panels.length}`;
}

function applyFigureTransform(transform) {
  const plot = elements.figureMount.querySelector(".figure-plot");
  if (!plot || !state.activeFigureId) {
    return;
  }
  const width = elements.figureMount.clientWidth;
  const height = elements.figureMount.clientHeight;
  const scale = clamp(transform.scale, MIN_PLOT_SCALE, 4);
  const minimumX = width * 0.5 - width * scale;
  const minimumY = height * 0.5 - height * scale;
  const next = {
    scale,
    x: clamp(transform.x, minimumX, width * 0.5),
    y: clamp(transform.y, minimumY, height * 0.5),
  };
  const layoutKey = figureLayoutKey(activeFigure());
  state.figureTransforms.set(layoutKey, next);
  plot.style.transformOrigin = "0 0";
  plot.style.transform = `translate3d(${next.x}px, ${next.y}px, 0) scale(${next.scale})`;
  scheduleDensityRepaint();
  elements.figureMount.classList.toggle(
    "is-figure-zoomed",
    Math.abs(next.scale - 1) > 0.001,
  );
  elements.figureWorkspace.classList.toggle(
    "is-figure-zoomed",
    Math.abs(next.scale - 1) > 0.001,
  );
  elements.figureMount.dataset.figureScale = String(next.scale);
  updateAgeMetallicityMarkers(plot);
  updatePlotResetVisibility();
}

function scheduleDensityRepaint() {
  if (!elements.figureMount.querySelector("[data-density-layer]")) {
    return;
  }
  if (state.densityRepaintFrame !== null) {
    cancelAnimationFrame(state.densityRepaintFrame);
  }
  state.densityRepaintFrame = requestAnimationFrame(() => {
    const layers = elements.figureMount.querySelectorAll(
      "[data-density-layer]",
    );
    for (const layer of layers) {
      layer.style.display = "none";
    }
    // Flush the hidden state so the SVG density layer is painted again at
    // the new transform instead of reusing a stale composited raster.
    void elements.figureMount.offsetWidth;
    for (const layer of layers) {
      layer.style.removeProperty("display");
    }
    state.densityRepaintFrame = null;
  });
}

function figureWheelTarget(event) {
  const target = event.target instanceof Element ? event.target : null;
  return Boolean(
    target &&
      !target.closest(
        "button, summary, a, input, textarea, select, .colorbar-interactive, .plot-height-resizer",
      ),
  );
}

function zoomFigureAt(clientX, clientY, factor) {
  if (!activeFigure() || activeFigure().panels.length < 2) {
    return false;
  }
  const rectangle = elements.figureMount.getBoundingClientRect();
  if (!rectangle.width || !rectangle.height) {
    return false;
  }
  const layoutKey = figureLayoutKey(activeFigure());
  const transform = state.figureTransforms.get(layoutKey) || {
    scale: 1,
    x: 0,
    y: 0,
  };
  const nextScale = clamp(transform.scale * factor, MIN_PLOT_SCALE, 4);
  if (Math.abs(nextScale - transform.scale) < 0.001) {
    return false;
  }
  const pointerX = clamp(clientX - rectangle.left, 0, rectangle.width);
  const pointerY = clamp(clientY - rectangle.top, 0, rectangle.height);
  const ratio = nextScale / transform.scale;
  applyFigureTransform({
    scale: nextScale,
    x: pointerX - (pointerX - transform.x) * ratio,
    y: pointerY - (pointerY - transform.y) * ratio,
  });
  return true;
}

function setupFigureZoom() {
  elements.figureWorkspace.tabIndex = -1;
  elements.figureWorkspace.setAttribute(
    "aria-label",
    "Figure workspace. Scroll or pinch to zoom the complete multi-panel figure, drag anywhere to pan, and double-click to reset.",
  );
  elements.figureWorkspace.addEventListener(
    "wheel",
    (event) => {
      if (!figureWheelTarget(event)) {
        return;
      }
      const normalizedDelta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? elements.figureWorkspace.clientHeight
            : 1);
      if (Math.abs(normalizedDelta) < 0.1) {
        return;
      }
      const changed = zoomFigureAt(
        event.clientX,
        event.clientY,
        Math.exp(-normalizedDelta * 0.0015),
      );
      if (changed) {
        event.preventDefault();
        elements.figureWorkspace.focus({ preventScroll: true });
      }
    },
    { passive: false },
  );

  elements.figureWorkspace.addEventListener("pointerdown", (event) => {
    if (
      (event.pointerType === "mouse" && event.button !== 0) ||
      !figureWheelTarget(event)
    ) {
      return;
    }
    const transform = state.figureTransforms.get(
      figureLayoutKey(activeFigure()),
    );
    if (
      !transform ||
      Math.abs(transform.scale - 1) <= 0.001 ||
      !activeFigure() ||
      activeFigure().panels.length < 2
    ) {
      return;
    }
    state.figureDrag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      transform,
      moved: false,
    };
  });

  elements.figureWorkspace.addEventListener("pointermove", (event) => {
    if (!state.figureDrag || state.figureDrag.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - state.figureDrag.x;
    const dy = event.clientY - state.figureDrag.y;
    if (!state.figureDrag.moved && Math.hypot(dx, dy) < 4) {
      return;
    }
    if (!state.figureDrag.moved) {
      state.figureDrag.moved = true;
      elements.figureWorkspace.setPointerCapture(event.pointerId);
      elements.figureWorkspace.focus({ preventScroll: true });
      elements.figureWorkspace.classList.add("is-panning-figure");
      elements.pointTooltip.hidden = true;
    }
    event.preventDefault();
    applyFigureTransform({
      scale: state.figureDrag.transform.scale,
      x: state.figureDrag.transform.x + dx,
      y: state.figureDrag.transform.y + dy,
    });
  });

  const finishFigureDrag = (event) => {
    if (!state.figureDrag || state.figureDrag.pointerId !== event.pointerId) {
      return;
    }
    if (state.figureDrag.moved) {
      state.suppressFigureClickUntil = performance.now() + 180;
    }
    state.figureDrag = null;
    elements.figureWorkspace.classList.remove("is-panning-figure");
  };
  elements.figureWorkspace.addEventListener("pointerup", finishFigureDrag);
  elements.figureWorkspace.addEventListener("pointercancel", finishFigureDrag);
  elements.figureWorkspace.addEventListener("dblclick", (event) => {
    if (figureWheelTarget(event)) {
      applyFigureTransform({ scale: 1, x: 0, y: 0 });
    }
  });
  elements.figureWorkspace.addEventListener("keydown", (event) => {
    if (
      event.target.closest?.(
        ".plot-panel, .plot-height-resizer, input, textarea, select, button, [contenteditable='true']",
      )
    ) {
      return;
    }
    const transform = state.figureTransforms.get(
      figureLayoutKey(activeFigure()),
    );
    if (!transform) {
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomFigureAt(
        elements.figureMount.getBoundingClientRect().left +
          elements.figureMount.clientWidth / 2,
        elements.figureMount.getBoundingClientRect().top +
          elements.figureMount.clientHeight / 2,
        1.2,
      );
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomFigureAt(
        elements.figureMount.getBoundingClientRect().left +
          elements.figureMount.clientWidth / 2,
        elements.figureMount.getBoundingClientRect().top +
          elements.figureMount.clientHeight / 2,
        1 / 1.2,
      );
    } else if (event.key === "0" || event.key.toLowerCase() === "r") {
      event.preventDefault();
      applyFigureTransform({ scale: 1, x: 0, y: 0 });
    }
  });
  window.addEventListener("resize", () => {
    const transform = state.figureTransforms.get(
      figureLayoutKey(activeFigure()),
    );
    if (transform) {
      applyFigureTransform(transform);
    }
  });
}

function constrainedPanelLayout(left, right) {
  const available = elements.workspace.clientWidth - 24;
  const mainMinimum = 180;
  const leftMinimum = 170;
  const leftMaximum = 360;
  const rightMinimum = 300;
  const rightMaximum = 1000;
  const nextLeft = clamp(
    Number(left) || leftMinimum,
    leftMinimum,
    Math.min(leftMaximum, available - rightMinimum - mainMinimum),
  );
  const nextRight = clamp(
    Number(right) || rightMinimum,
    rightMinimum,
    Math.min(rightMaximum, available - nextLeft - mainMinimum),
  );
  return {
    left: nextLeft,
    right: nextRight,
    leftMinimum,
    leftMaximum: Math.min(leftMaximum, available - nextRight - mainMinimum),
    rightMinimum,
    rightMaximum: Math.min(rightMaximum, available - nextLeft - mainMinimum),
  };
}

function applyPanelLayout(left, right, persist = false) {
  const layout = constrainedPanelLayout(left, right);
  state.panelLayout = layout;
  elements.workspace.style.setProperty(
    "--left-panel-width",
    `${layout.left}px`,
  );
  elements.workspace.style.setProperty(
    "--right-panel-width",
    `${layout.right}px`,
  );
  elements.resizerLeft.setAttribute(
    "aria-valuemin",
    String(Math.round(layout.leftMinimum)),
  );
  elements.resizerLeft.setAttribute(
    "aria-valuemax",
    String(Math.round(layout.leftMaximum)),
  );
  elements.resizerLeft.setAttribute(
    "aria-valuenow",
    String(Math.round(layout.left)),
  );
  elements.resizerRight.setAttribute(
    "aria-valuemin",
    String(Math.round(layout.rightMinimum)),
  );
  elements.resizerRight.setAttribute(
    "aria-valuemax",
    String(Math.round(layout.rightMaximum)),
  );
  elements.resizerRight.setAttribute(
    "aria-valuenow",
    String(Math.round(layout.right)),
  );
  if (persist) {
    try {
      localStorage.setItem(
        "gc-viewer-panel-layout",
        JSON.stringify({ left: layout.left, right: layout.right }),
      );
    } catch (error) {
      console.debug("Could not persist panel layout", error);
    }
  }
  drawCMD();
}

function restorePanelLayout() {
  if (!window.matchMedia("(min-width: 1181px)").matches) {
    return;
  }
  try {
    const stored = JSON.parse(
      window.localStorage.getItem("gc-viewer-panel-layout") || "null",
    );
    if (stored && finite(stored.left) && finite(stored.right)) {
      applyPanelLayout(stored.left, stored.right, false);
    }
  } catch (error) {
    console.debug("Could not restore panel layout", error);
  }
}

function setupColumnResizers() {
  const resizers = [
    { element: elements.resizerLeft, side: "left" },
    { element: elements.resizerRight, side: "right" },
  ];
  for (const { element, side } of resizers) {
    element.addEventListener("pointerdown", (event) => {
      if (!window.matchMedia("(min-width: 1181px)").matches) {
        return;
      }
      event.preventDefault();
      const current = constrainedPanelLayout(
        parseFloat(
          getComputedStyle(elements.workspace).getPropertyValue(
            "--left-panel-width",
          ),
        ),
        parseFloat(
          getComputedStyle(elements.workspace).getPropertyValue(
            "--right-panel-width",
          ),
        ),
      );
      const drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        left: current.left,
        right: current.right,
      };
      element.setPointerCapture(event.pointerId);
      element.classList.add("is-dragging");
      document.body.classList.add("is-resizing");

      const move = (moveEvent) => {
        if (moveEvent.pointerId !== drag.pointerId) {
          return;
        }
        moveEvent.preventDefault();
        const delta = moveEvent.clientX - drag.startX;
        if (side === "left") {
          applyPanelLayout(drag.left + delta, drag.right, false);
        } else {
          applyPanelLayout(drag.left, drag.right - delta, false);
        }
      };
      const finish = (endEvent) => {
        if (endEvent.pointerId !== drag.pointerId) {
          return;
        }
        element.removeEventListener("pointermove", move);
        element.removeEventListener("pointerup", finish);
        element.removeEventListener("pointercancel", finish);
        element.classList.remove("is-dragging");
        document.body.classList.remove("is-resizing");
        if (state.panelLayout) {
          applyPanelLayout(
            state.panelLayout.left,
            state.panelLayout.right,
            true,
          );
        }
      };
      element.addEventListener("pointermove", move);
      element.addEventListener("pointerup", finish);
      element.addEventListener("pointercancel", finish);
    });

    element.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) {
        return;
      }
      event.preventDefault();
      const current = constrainedPanelLayout(
        parseFloat(
          getComputedStyle(elements.workspace).getPropertyValue(
            "--left-panel-width",
          ),
        ),
        parseFloat(
          getComputedStyle(elements.workspace).getPropertyValue(
            "--right-panel-width",
          ),
        ),
      );
      const step = event.shiftKey ? 40 : 16;
      const direction = event.key === "ArrowRight" ? 1 : -1;
      if (side === "left") {
        applyPanelLayout(current.left + direction * step, current.right, true);
      } else {
        applyPanelLayout(current.left, current.right - direction * step, true);
      }
    });
  }

  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 1181px)").matches && state.panelLayout) {
      const current = constrainedPanelLayout(
        state.panelLayout.left,
        state.panelLayout.right,
      );
      applyPanelLayout(current.left, current.right, false);
    }
  });
}

function plotHeightBounds() {
  const minimum = 220;
  const maximum = Math.max(
    minimum + 120,
    Math.round(elements.figureWorkspace.clientHeight - 170),
  );
  return { minimum, maximum };
}

function updatePlotHeightControl() {
  const { minimum, maximum } = plotHeightBounds();
  const height =
    state.plotFrameHeight ??
    Math.round(elements.plotFrame.getBoundingClientRect().height);
  elements.resizerPlotHeight.setAttribute("aria-valuemin", String(minimum));
  elements.resizerPlotHeight.setAttribute("aria-valuemax", String(maximum));
  elements.resizerPlotHeight.setAttribute(
    "aria-valuenow",
    String(clamp(height, minimum, maximum)),
  );
  elements.resizerPlotHeight.setAttribute(
    "aria-valuetext",
    state.plotFrameHeight
      ? `${Math.round(state.plotFrameHeight)} pixels`
      : "automatic height",
  );
}

function applyPlotFrameHeight(height, persist = false) {
  const { minimum, maximum } = plotHeightBounds();
  const next = clamp(Math.round(height), minimum, maximum);
  state.plotFrameHeight = next;
  elements.figureWorkspace.style.setProperty(
    "--plot-frame-height",
    `${next}px`,
  );
  elements.plotFrame.classList.add("is-height-controlled");
  if (persist) {
    try {
      localStorage.setItem("gc-viewer-plot-height", String(next));
    } catch (error) {
      console.debug("Could not persist plot height", error);
    }
  }
  updatePlotHeightControl();
}

function resetPlotFrameHeight() {
  state.plotFrameHeight = null;
  elements.figureWorkspace.style.removeProperty("--plot-frame-height");
  elements.plotFrame.classList.remove("is-height-controlled");
  try {
    localStorage.removeItem("gc-viewer-plot-height");
  } catch (error) {
    console.debug("Could not clear plot height", error);
  }
  requestAnimationFrame(updatePlotHeightControl);
}

function restorePlotFrameHeight() {
  try {
    const raw = localStorage.getItem("gc-viewer-plot-height");
    const stored = raw === null ? null : Number(raw);
    if (stored !== null && finite(stored)) {
      applyPlotFrameHeight(stored);
      return;
    }
  } catch (error) {
    console.debug("Could not restore plot height", error);
  }
  updatePlotHeightControl();
}

function setupPlotHeightResizer() {
  const resizer = elements.resizerPlotHeight;
  resizer.title =
    "Drag to resize the plot area · double-click to restore automatic height";
  resizer.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    event.preventDefault();
    const drag = {
      pointerId: event.pointerId,
      startY: event.clientY,
      height: elements.plotFrame.getBoundingClientRect().height,
    };
    resizer.setPointerCapture(event.pointerId);
    resizer.classList.add("is-dragging");
    document.body.classList.add("is-resizing-plot-height");

    const move = (moveEvent) => {
      if (moveEvent.pointerId !== drag.pointerId) {
        return;
      }
      moveEvent.preventDefault();
      applyPlotFrameHeight(drag.height + moveEvent.clientY - drag.startY);
    };
    const finish = (endEvent) => {
      if (endEvent.pointerId !== drag.pointerId) {
        return;
      }
      resizer.removeEventListener("pointermove", move);
      resizer.removeEventListener("pointerup", finish);
      resizer.removeEventListener("pointercancel", finish);
      resizer.classList.remove("is-dragging");
      document.body.classList.remove("is-resizing-plot-height");
      if (state.plotFrameHeight !== null) {
        applyPlotFrameHeight(state.plotFrameHeight, true);
      }
    };
    resizer.addEventListener("pointermove", move);
    resizer.addEventListener("pointerup", finish);
    resizer.addEventListener("pointercancel", finish);
  });
  resizer.addEventListener("keydown", (event) => {
    const current =
      state.plotFrameHeight ??
      elements.plotFrame.getBoundingClientRect().height;
    const step = event.shiftKey ? 40 : 16;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      applyPlotFrameHeight(current - step, true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      applyPlotFrameHeight(current + step, true);
    } else if (event.key === "0") {
      event.preventDefault();
      resetPlotFrameHeight();
    }
  });
  resizer.addEventListener("dblclick", resetPlotFrameHeight);
  window.addEventListener("resize", () => {
    if (state.plotFrameHeight !== null) {
      applyPlotFrameHeight(state.plotFrameHeight);
    } else {
      updatePlotHeightControl();
    }
  });
}

function updateAgeMetallicityMarkers(root) {
  // Counteract zoom-in magnification without compensating for zoom-out.
  // Marker positions, error bars and hit areas retain their existing behaviour.
  const figureScale = Number(elements.figureMount.dataset.figureScale) || 1;
  for (const group of root.querySelectorAll('[data-age-metallicity="true"]')) {
    const viewport = group.closest(".plot-viewport");
    const plotScale = Number(viewport?.dataset.zoomScale) || 1;
    const zoom = figureScale * plotScale;
    // Hold screen size during zoom-in; let dots scale naturally during zoom-out.
    const markerScale = 1 / Math.max(1, zoom);
    for (const marker of group.querySelectorAll(
      ".point-marker, .selection-ring",
    )) {
      marker.style.transform = `scale(${markerScale})`;
      marker.style.transformOrigin = "0 0";
      marker.style.transformBox = "view-box";
    }
  }
}

function applyPlotTransform(viewport, svg, key, transform) {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  const scale = clamp(transform.scale, MIN_PLOT_SCALE, 6);
  const minimumX = width * 0.5 - width * scale;
  const minimumY = height * 0.5 - height * scale;
  const next = {
    scale,
    x: clamp(transform.x, minimumX, width * 0.5),
    y: clamp(transform.y, minimumY, height * 0.5),
  };
  state.plotTransforms.set(key, next);
  svg.style.transform = `translate3d(${next.x}px, ${next.y}px, 0) scale(${next.scale})`;
  viewport.dataset.zoomScale = String(next.scale);
  updateAgeMetallicityMarkers(svg);
  scheduleDensityRepaint();
  viewport.classList.toggle("is-zoomed", Math.abs(next.scale - 1) > 0.001);
  updatePlotResetVisibility();
}

function resetPlotView(viewport, key) {
  const svg = viewport.querySelector("svg");
  if (!svg) {
    return;
  }
  applyPlotTransform(viewport, svg, key, { scale: 1, x: 0, y: 0 });
}

function setupPlotManipulation(viewport, svg, key, interaction, enabled) {
  if (!enabled) {
    viewport.classList.add("is-figure-controlled");
    return;
  }

  let drag = null;
  viewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    const transform = state.plotTransforms.get(key) || { scale: 1, x: 0, y: 0 };
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: transform.x,
      y: transform.y,
      scale: transform.scale,
      moved: false,
    };
    viewport.setPointerCapture(event.pointerId);
    viewport.focus({ preventScroll: true });
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) {
      return;
    }
    event.preventDefault();
    drag.moved = true;
    interaction.isDragging = true;
    viewport.classList.add("is-dragging");
    elements.pointTooltip.hidden = true;
    applyPlotTransform(viewport, svg, key, {
      scale: drag.scale,
      x: drag.x + dx,
      y: drag.y + dy,
    });
  });

  function finishDrag(event) {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const moved = drag.moved;
    if (moved) {
      interaction.suppressClickUntil = performance.now() + 180;
    }
    drag = null;
    interaction.isDragging = false;
    viewport.classList.remove("is-dragging");
  }

  viewport.addEventListener("pointerup", finishDrag);
  viewport.addEventListener("pointercancel", finishDrag);

  viewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const transform = state.plotTransforms.get(key) || {
        scale: 1,
        x: 0,
        y: 0,
      };
      const delta =
        Math.abs(event.deltaY) >= Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;
      const nextScale = clamp(
        transform.scale * Math.exp(-delta * 0.0015),
        MIN_PLOT_SCALE,
        6,
      );
      if (Math.abs(nextScale - transform.scale) < 0.001) {
        return;
      }
      const rectangle = viewport.getBoundingClientRect();
      const pointerX = event.clientX - rectangle.left;
      const pointerY = event.clientY - rectangle.top;
      const ratio = nextScale / transform.scale;
      applyPlotTransform(viewport, svg, key, {
        scale: nextScale,
        x: pointerX - (pointerX - transform.x) * ratio,
        y: pointerY - (pointerY - transform.y) * ratio,
      });
    },
    { passive: false },
  );

  viewport.addEventListener("dblclick", () => resetPlotView(viewport, key));
  viewport.addEventListener("keydown", (event) => {
    const transform = state.plotTransforms.get(key) || { scale: 1, x: 0, y: 0 };
    const panStep = event.shiftKey ? 64 : 24;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      const rectangle = viewport.getBoundingClientRect();
      const centerX = rectangle.width / 2;
      const centerY = rectangle.height / 2;
      const nextScale = clamp(transform.scale * 1.2, MIN_PLOT_SCALE, 6);
      const ratio = nextScale / transform.scale;
      applyPlotTransform(viewport, svg, key, {
        scale: nextScale,
        x: centerX - (centerX - transform.x) * ratio,
        y: centerY - (centerY - transform.y) * ratio,
      });
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      const rectangle = viewport.getBoundingClientRect();
      const centerX = rectangle.width / 2;
      const centerY = rectangle.height / 2;
      const nextScale = clamp(transform.scale / 1.2, MIN_PLOT_SCALE, 6);
      const ratio = nextScale / transform.scale;
      applyPlotTransform(viewport, svg, key, {
        scale: nextScale,
        x: centerX - (centerX - transform.x) * ratio,
        y: centerY - (centerY - transform.y) * ratio,
      });
    } else if (event.key === "0" || event.key.toLowerCase() === "r") {
      event.preventDefault();
      resetPlotView(viewport, key);
    } else if (
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      applyPlotTransform(viewport, svg, key, {
        scale: transform.scale,
        x:
          transform.x +
          (event.key === "ArrowLeft"
            ? panStep
            : event.key === "ArrowRight"
              ? -panStep
              : 0),
        y:
          transform.y +
          (event.key === "ArrowUp"
            ? panStep
            : event.key === "ArrowDown"
              ? -panStep
              : 0),
      });
    }
  });
}

function renderPanel(
  panel,
  figureId,
  layoutKey,
  panelIndex,
  density,
  allowPanelZoom,
) {
  const wrapper = htmlElement("section", "plot-panel");
  const reversedAxes = [
    panel.x_inverted ? "X axis reversed" : null,
    panel.y_inverted ? "Y axis reversed" : null,
  ].filter(Boolean);
  wrapper.setAttribute(
    "aria-label",
    [panel.title || "Figure panel", ...reversedAxes].join(". "),
  );
  wrapper.dataset.xInverted = String(Boolean(panel.x_inverted));
  wrapper.dataset.yInverted = String(Boolean(panel.y_inverted));
  const key = plotKey(layoutKey, panelIndex);
  const interaction = { isDragging: false, suppressClickUntil: 0 };
  const width = panel.x_label.includes("density") ? 720 : 560;
  const height = 390;
  const margin = {
    left: 62,
    right: panel.colorbar ? 28 : 18,
    top: 42,
    bottom: panel.colorbar ? 58 : 62,
  };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const { xDomain, yDomain } = collectDomain(panel, density);
  const [xMin, xMax] = xDomain;
  const [yMin, yMax] = yDomain;

  const xScale = (value) => {
    const fraction = (value - xMin) / (xMax - xMin);
    return (
      margin.left + (panel.x_inverted ? 1 - fraction : fraction) * innerWidth
    );
  };
  const yScale = (value) => {
    const fraction = (value - yMin) / (yMax - yMin);
    return (
      margin.top + (panel.y_inverted ? fraction : 1 - fraction) * innerHeight
    );
  };

  const svg = svgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "group",
    "aria-label": panel.title || "Scientific figure panel",
    preserveAspectRatio: "xMidYMid meet",
  });

  const panelClipId = `clip-${figureId}-${slug(panel.title || "panel")}-${Math.random().toString(36).slice(2, 8)}`;
  const defs = svgElement("defs");
  const clipPath = svgElement("clipPath", { id: panelClipId });
  clipPath.append(
    svgElement("rect", {
      x: margin.left,
      y: margin.top,
      width: innerWidth,
      height: innerHeight,
    }),
  );
  defs.append(clipPath);
  svg.append(defs);

  if (panel.title) {
    svg.append(
      svgElement(
        "text",
        {
          x: margin.left,
          y: 20,
          class: "plot-panel-title",
        },
        panel.title,
      ),
    );
  }

  if (density) {
    if (density.contours?.length) {
      const pathData = density.contours
        .map(
          (ring) =>
            ring
              .map(
                ([x, y], index) =>
                  `${index === 0 ? "M" : "L"}${xScale(x).toFixed(2)},${yScale(y).toFixed(2)}`,
              )
              .join(" ") + " Z",
        )
        .join(" ");
      svg.append(
        svgElement("path", {
          d: pathData,
          "data-density-layer": "true",
          fill: density.color,
          "fill-rule": "evenodd",
          opacity: density.alpha,
          stroke: "none",
          "clip-path": `url(#${panelClipId})`,
          "pointer-events": "none",
        }),
      );
    } else if (density.values?.length) {
      const imageX = Math.min(xScale(density.x[0]), xScale(density.x.at(-1)));
      const imageY = Math.min(yScale(density.y[0]), yScale(density.y.at(-1)));
      const imageWidth = Math.abs(
        xScale(density.x.at(-1)) - xScale(density.x[0]),
      );
      const imageHeight = Math.abs(
        yScale(density.y.at(-1)) - yScale(density.y[0]),
      );
      svg.append(
        svgElement("image", {
          href: makeDensityImage(density),
          "data-density-layer": "true",
          x: imageX,
          y: imageY,
          width: imageWidth,
          height: imageHeight,
          preserveAspectRatio: "none",
          opacity: 0.72,
          "clip-path": `url(#${panelClipId})`,
        }),
      );
    }
  }

  const xTicks = ticksForDomain(
    xDomain,
    Math.max(4, Math.floor(innerWidth / 75)),
  );
  const yTicks = ticksForDomain(
    yDomain,
    Math.max(4, Math.floor(innerHeight / 58)),
  );
  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;
  const xMinorStep =
    xTicks.length > 1 ? (xTicks[1] - xTicks[0]) / 5 : xSpan / 30;
  const yMinorStep =
    yTicks.length > 1 ? (yTicks[1] - yTicks[0]) / 5 : ySpan / 30;

  const grid = svgElement("g", {
    "clip-path": `url(#${panelClipId})`,
    "aria-hidden": "true",
  });

  for (
    let value = xMin;
    value <= xMax + xMinorStep * 0.01;
    value += xMinorStep
  ) {
    grid.append(
      svgElement("line", {
        class: "grid-minor",
        x1: xScale(value),
        x2: xScale(value),
        y1: margin.top,
        y2: margin.top + innerHeight,
      }),
    );
  }
  for (
    let value = yMin;
    value <= yMax + yMinorStep * 0.01;
    value += yMinorStep
  ) {
    grid.append(
      svgElement("line", {
        class: "grid-minor",
        x1: margin.left,
        x2: margin.left + innerWidth,
        y1: yScale(value),
        y2: yScale(value),
      }),
    );
  }
  for (const value of xTicks) {
    grid.append(
      svgElement("line", {
        class: "grid-major",
        x1: xScale(value),
        x2: xScale(value),
        y1: margin.top,
        y2: margin.top + innerHeight,
      }),
    );
  }
  for (const value of yTicks) {
    grid.append(
      svgElement("line", {
        class: "grid-major",
        x1: margin.left,
        x2: margin.left + innerWidth,
        y1: yScale(value),
        y2: yScale(value),
      }),
    );
  }
  svg.append(grid);

  const dataLayer = svgElement("g", {
    "clip-path": `url(#${panelClipId})`,
  });

  for (const series of panel.series) {
    if (series.type === "reference") {
      if (series.orientation === "horizontal") {
        dataLayer.append(
          svgElement("line", {
            x1: margin.left,
            x2: margin.left + innerWidth,
            y1: yScale(series.value),
            y2: yScale(series.value),
            stroke: series.color,
            "stroke-width": series.width,
            "stroke-dasharray": series.dash === "dot" ? "2 3" : "5 4",
          }),
        );
      } else {
        dataLayer.append(
          svgElement("line", {
            x1: xScale(series.value),
            x2: xScale(series.value),
            y1: margin.top,
            y2: margin.top + innerHeight,
            stroke: series.color,
            "stroke-width": series.width,
            "stroke-dasharray": series.dash === "dot" ? "2 3" : "5 4",
          }),
        );
      }
    }
  }

  const pointTargets = [];
  for (const series of panel.series) {
    if (series.type === "points") {
      for (const point of pointValues(series)) {
        if (finite(point.xLow) || finite(point.xHigh)) {
          const lineX1 = xScale(
            point.x - (finite(point.xLow) ? point.xLow : 0),
          );
          const lineX2 = xScale(
            point.x + (finite(point.xHigh) ? point.xHigh : 0),
          );
          const y = yScale(point.y);
          dataLayer.append(
            svgElement("line", {
              class: "error-bar",
              x1: lineX1,
              x2: lineX2,
              y1: y,
              y2: y,
            }),
          );
          dataLayer.append(
            svgElement("line", {
              class: "error-bar",
              x1: lineX1,
              x2: lineX1,
              y1: y - 2,
              y2: y + 2,
            }),
          );
          dataLayer.append(
            svgElement("line", {
              class: "error-bar",
              x1: lineX2,
              x2: lineX2,
              y1: y - 2,
              y2: y + 2,
            }),
          );
        }
        if (finite(point.yLow) || finite(point.yHigh)) {
          const lineY1 = yScale(
            point.y - (finite(point.yLow) ? point.yLow : 0),
          );
          const lineY2 = yScale(
            point.y + (finite(point.yHigh) ? point.yHigh : 0),
          );
          const x = xScale(point.x);
          dataLayer.append(
            svgElement("line", {
              class: "error-bar",
              x1: x,
              x2: x,
              y1: lineY1,
              y2: lineY2,
            }),
          );
          dataLayer.append(
            svgElement("line", {
              class: "error-bar",
              x1: x - 2,
              x2: x + 2,
              y1: lineY1,
              y2: lineY1,
            }),
          );
          dataLayer.append(
            svgElement("line", {
              class: "error-bar",
              x1: x - 2,
              x2: x + 2,
              y1: lineY2,
              y2: lineY2,
            }),
          );
        }
      }
    } else if (series.type === "line") {
      const segments = [];
      let current = [];
      for (let index = 0; index < series.x.length; index += 1) {
        const x = series.x[index];
        const y = series.y[index];
        if (finite(x) && finite(y)) {
          current.push(`${xScale(x).toFixed(2)},${yScale(y).toFixed(2)}`);
        } else if (current.length) {
          segments.push(current);
          current = [];
        }
      }
      if (current.length) {
        segments.push(current);
      }
      for (const segment of segments) {
        dataLayer.append(
          svgElement("polyline", {
            points: segment.join(" "),
            fill: "none",
            stroke: series.color,
            "stroke-width": series.width,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            "stroke-dasharray":
              series.dash === "dot"
                ? "2 3"
                : series.dash === "dash"
                  ? "6 4"
                  : null,
          }),
        );
      }
    }
  }

  // Points sit above error bars and model curves so every marker remains clickable.
  for (const series of panel.series) {
    if (series.type !== "points") {
      continue;
    }
    for (const point of pointValues(series)) {
      const cluster = state.clusterById.get(point.clusterId);
      const group = svgElement("g", {
        class: "cluster-point",
        "data-cluster-id": point.clusterId,
        "data-age-metallicity": String(
          /age/i.test(panel.x_label + panel.y_label) &&
            /M\/H|Fe\/H/.test(panel.x_label + panel.y_label),
        ),
        "data-color-value": finite(point.colorValue) ? point.colorValue : null,
        transform: `translate(${xScale(point.x).toFixed(2)} ${yScale(point.y).toFixed(2)})`,
        tabindex: "0",
        role: "button",
        "aria-label": `Select ${cluster?.name || point.clusterId}`,
      });
      if (point.clusterId === state.selectedClusterId) {
        group.classList.add("is-selected");
        group.setAttribute("aria-pressed", "true");
      }
      if (point.clusterId === state.hoveredClusterId) {
        group.classList.add("is-hovered");
      }
      group.append(
        svgElement("circle", {
          class: "selection-ring",
          cx: 0,
          cy: 0,
          r: point.size + 3.5,
          hidden: point.clusterId === state.selectedClusterId ? null : "",
        }),
      );
      if (point.marker === "square") {
        group.append(
          svgElement("rect", {
            class: "point-marker",
            x: -point.size,
            y: -point.size,
            width: point.size * 2,
            height: point.size * 2,
            fill: point.fillColor,
          }),
        );
      } else {
        group.append(
          svgElement("circle", {
            class: "point-marker",
            cx: 0,
            cy: 0,
            r: point.size,
            fill: point.fillColor,
          }),
        );
      }
      group.append(
        svgElement("circle", {
          class: "point-hit",
          cx: 0,
          cy: 0,
          r: Math.max(8, point.size + 4),
        }),
      );
      attachPointEvents(group, point, panel);
      dataLayer.append(group);
      pointTargets.push({
        clusterId: point.clusterId,
        x: xScale(point.x),
        y: yScale(point.y),
        point,
      });
    }
  }

  svg.append(dataLayer);

  function nearestPointToPointer(event) {
    const matrix = svg.getScreenCTM();
    if (!matrix) {
      return null;
    }
    let nearest = null;
    let nearestDistance = Infinity;
    for (const target of pointTargets) {
      const screenX = matrix.a * target.x + matrix.c * target.y + matrix.e;
      const screenY = matrix.b * target.x + matrix.d * target.y + matrix.f;
      const distance = Math.hypot(
        event.clientX - screenX,
        event.clientY - screenY,
      );
      if (distance < nearestDistance) {
        nearest = target;
        nearestDistance = distance;
      }
    }
    return nearestDistance <= 14 ? nearest : null;
  }

  svg.addEventListener("pointermove", (event) => {
    if (interaction.isDragging) {
      return;
    }
    const nearest = nearestPointToPointer(event);
    if (!nearest) {
      setHoveredCluster(null);
      elements.pointTooltip.hidden = true;
      return;
    }
    setHoveredCluster(nearest.clusterId);
    showPointTooltip(
      nearest.clusterId,
      event.clientX,
      event.clientY,
      nearest.point,
      panel,
    );
  });
  svg.addEventListener("pointerleave", () => {
    setHoveredCluster(null);
    elements.pointTooltip.hidden = true;
  });
  const axes = svgElement("g", { "aria-hidden": "true" });
  axes.append(
    svgElement("line", {
      class: "axis-line",
      x1: margin.left,
      x2: margin.left,
      y1: margin.top,
      y2: margin.top + innerHeight,
    }),
  );
  axes.append(
    svgElement("line", {
      class: "axis-line",
      x1: margin.left,
      x2: margin.left + innerWidth,
      y1: margin.top + innerHeight,
      y2: margin.top + innerHeight,
    }),
  );

  for (const value of xTicks) {
    const x = xScale(value);
    axes.append(
      svgElement("line", {
        class: "axis-line",
        x1: x,
        x2: x,
        y1: margin.top + innerHeight,
        y2: margin.top + innerHeight + 4,
      }),
    );
    axes.append(
      svgElement(
        "text",
        {
          x,
          y: margin.top + innerHeight + 15,
          class: "tick-label",
          "text-anchor": "middle",
        },
        formatTick(value, xSpan),
      ),
    );
  }
  for (const value of yTicks) {
    const y = yScale(value);
    axes.append(
      svgElement("line", {
        class: "axis-line",
        x1: margin.left - 4,
        x2: margin.left,
        y1: y,
        y2: y,
      }),
    );
    axes.append(
      svgElement(
        "text",
        {
          x: margin.left - 8,
          y: y + 3,
          class: "tick-label",
          "text-anchor": "end",
        },
        formatTick(value, ySpan),
      ),
    );
  }

  axes.append(
    svgElement(
      "text",
      {
        x: margin.left + innerWidth / 2,
        y: height - 17,
        class: "axis-label",
        "text-anchor": "middle",
      },
      panel.x_label,
    ),
  );

  const yLabel = svgElement(
    "text",
    {
      x: 15,
      y: margin.top + innerHeight / 2,
      class: "axis-label",
      "text-anchor": "middle",
      transform: `rotate(-90 15 ${margin.top + innerHeight / 2})`,
    },
    panel.y_label,
  );
  axes.append(yLabel);
  svg.append(axes);

  for (const item of panel.annotations || []) {
    const lines = item.text.split("\n");
    const widthEstimate =
      Math.max(...lines.map((line) => line.length)) * 4.8 + 12;
    const heightEstimate = lines.length * 10 + 9;
    const [vertical, side] = item.corner.split("-");
    const boxX =
      side === "right"
        ? margin.left + innerWidth - widthEstimate - 5
        : margin.left + 5;
    const boxY =
      vertical === "top"
        ? margin.top + 5
        : margin.top + innerHeight - heightEstimate - 5;
    const annotationGroup = svgElement("g");
    annotationGroup.append(
      svgElement("rect", {
        x: boxX,
        y: boxY,
        width: widthEstimate,
        height: heightEstimate,
        rx: 2,
        fill: colors.paper,
        stroke: colors.rule,
        "stroke-width": 0.6,
      }),
    );
    const text = svgElement("text", {
      x: boxX + 6,
      y: boxY + 11,
      class: "annotation-text",
    });
    for (const [index, line] of lines.entries()) {
      text.append(
        svgElement(
          "tspan",
          {
            x: boxX + 6,
            dy: index === 0 ? 0 : 10,
          },
          line,
        ),
      );
    }
    annotationGroup.append(text);
    svg.append(annotationGroup);
  }

  const viewport = htmlElement("div", "plot-viewport");
  viewport.dataset.plotKey = key;
  viewport.tabIndex = allowPanelZoom ? 0 : -1;
  viewport.setAttribute("role", "region");
  viewport.setAttribute(
    "aria-label",
    allowPanelZoom
      ? `${panel.title || "Figure panel"}. Scroll or pinch to zoom, drag to pan, and double-click to reset.`
      : `${panel.title || "Figure panel"}. Scroll or pinch anywhere to zoom the complete multi-panel figure.`,
  );
  if (allowPanelZoom) {
    viewport.setAttribute(
      "aria-keyshortcuts",
      "+ - 0 R ArrowLeft ArrowRight ArrowUp ArrowDown",
    );
  }
  viewport.append(svg);
  wrapper.append(viewport);
  setupPlotManipulation(viewport, svg, key, interaction, allowPanelZoom);
  viewport.addEventListener("click", (event) => {
    if (
      performance.now() < interaction.suppressClickUntil ||
      performance.now() < state.suppressFigureClickUntil
    ) {
      return;
    }
    const nearest = nearestPointToPointer(event);
    if (nearest) {
      selectCluster(nearest.clusterId);
    }
  });

  if (panel.colorbar) {
    wrapper.append(buildColorbar(panel.colorbar, true));
  }
  if (panel.note) {
    const note = htmlElement("p", "panel-note", panel.note);
    note.style.padding = "0 12px 10px";
    note.style.margin = "0";
    note.style.color = colors.tertiary;
    note.style.fontSize = "9px";
    wrapper.append(note);
  }
  return wrapper;
}

function buildColorbar(colorbar, compact = false) {
  colorbar.full_min ??= colorbar.min;
  colorbar.full_max ??= colorbar.max;
  colorbar.variable_id ??= colorbar.label;
  const wrapper = htmlElement(
    "div",
    `${compact ? "panel-colorbar" : "figure-global-colorbar"} colorbar-interactive`,
  );
  wrapper.dataset.colorVariable = colorbar.variable_id;
  wrapper.setAttribute("role", "group");
  wrapper.setAttribute(
    "aria-label",
    `${colorbar.label} colour scale. Enter minimum and maximum limits.`,
  );
  const track = htmlElement("div", "colorbar-track");
  track.style.background = `linear-gradient(90deg, ${colorbar.colors.join(", ")})`;
  const controls = htmlElement("div", "colorbar-controls");
  const createLimit = (caption, value, bound) => {
    const label = htmlElement("label", "colorbar-limit");
    label.append(htmlElement("span", "colorbar-limit-caption", caption));
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.className = "colorbar-limit-input";
    input.value = colorbarInputValue(value);
    input.dataset.colorbarBound = bound;
    input.setAttribute("aria-label", `${colorbar.label} colourbar ${bound}`);
    label.append(input);
    return input;
  };
  const minimumInput = createLimit("Min", colorbar.min, "minimum");
  const maximumInput = createLimit("Max", colorbar.max, "maximum");
  const reset = htmlElement("button", "colorbar-reset", "Full range");
  reset.type = "button";
  reset.title = `Reset ${colorbar.label} colour limits`;
  controls.append(
    minimumInput.closest("label"),
    maximumInput.closest("label"),
    reset,
  );
  if (compact) {
    wrapper.append(
      track,
      controls,
      htmlElement("div", "colorbar-label", colorbar.label),
    );
  } else {
    const copy = htmlElement("div", "global-colorbar-copy");
    const title = htmlElement("strong", null, colorbar.label);
    copy.append(title, controls);
    wrapper.append(track, copy);
  }
  setupColorbarInputs(wrapper, colorbar, minimumInput, maximumInput, reset);
  return wrapper;
}

function colorbarInputValue(value) {
  return String(Number(value.toPrecision(8)));
}

function setColorbarRange(colorbar, minimum, maximum) {
  if (!finite(minimum) || !finite(maximum) || minimum >= maximum) {
    return false;
  }
  colorbar.min = minimum;
  colorbar.max = maximum;
  state.colorRanges.set(colorbar.variable_id, {
    min: minimum,
    max: maximum,
  });

  for (const wrapper of elements.figureMount.querySelectorAll(
    ".colorbar-interactive",
  )) {
    if (wrapper.dataset.colorVariable !== colorbar.variable_id) {
      continue;
    }
    const minimumInput = wrapper.querySelector(
      '[data-colorbar-bound="minimum"]',
    );
    const maximumInput = wrapper.querySelector(
      '[data-colorbar-bound="maximum"]',
    );
    if (minimumInput) minimumInput.value = colorbarInputValue(minimum);
    if (maximumInput) maximumInput.value = colorbarInputValue(maximum);
  }

  for (const group of elements.figureMount.querySelectorAll(
    ".cluster-point[data-color-value]",
  )) {
    const marker = group.querySelector(".point-marker");
    const value = Number(group.dataset.colorValue);
    if (!marker || !finite(value)) {
      continue;
    }
    marker.setAttribute(
      "fill",
      variableColor({ color_stops: colorbar.colors }, value, {
        min: minimum,
        max: maximum,
      }),
    );
  }
  return true;
}

function setupColorbarInputs(
  wrapper,
  colorbar,
  minimumInput,
  maximumInput,
  reset,
) {
  const clearValidation = () => {
    minimumInput.setCustomValidity("");
    maximumInput.setCustomValidity("");
  };
  const restoreInputs = () => {
    clearValidation();
    minimumInput.value = colorbarInputValue(colorbar.min);
    maximumInput.value = colorbarInputValue(colorbar.max);
  };
  const commitInputs = () => {
    clearValidation();
    const minimum = minimumInput.valueAsNumber;
    const maximum = maximumInput.valueAsNumber;
    if (!finite(minimum) || !finite(maximum)) {
      const invalid = !finite(minimum) ? minimumInput : maximumInput;
      invalid.setCustomValidity("Enter a numeric colour limit.");
      invalid.reportValidity();
      return;
    }
    if (minimum >= maximum) {
      maximumInput.setCustomValidity(
        "The maximum colour limit must be greater than the minimum.",
      );
      maximumInput.reportValidity();
      return;
    }
    setColorbarRange(colorbar, minimum, maximum);
  };

  for (const input of [minimumInput, maximumInput]) {
    input.addEventListener("input", clearValidation);
    input.addEventListener("change", commitInputs);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitInputs();
      } else if (event.key === "Escape") {
        event.preventDefault();
        restoreInputs();
      }
    });
  }
  reset.addEventListener("click", () => {
    setColorbarRange(colorbar, colorbar.full_min, colorbar.full_max);
    restoreInputs();
    minimumInput.focus();
  });
  wrapper.dataset.colorbarReady = "true";
}

function renderFigure(figure) {
  state.hoveredClusterId = null;
  resetClusterSearch();
  elements.figureLoading.hidden = true;
  elements.figureMount.replaceChildren();
  elements.pointTooltip.hidden = true;
  elements.figureGroup.textContent = figure.group;
  elements.figureTitle.textContent = figure.title;
  elements.figureDescription.textContent = figure.description;
  const multiPanel = figure.panels.length > 1;
  elements.figureWorkspace.classList.toggle(
    "has-multi-panel-figure",
    multiPanel,
  );
  elements.figureNavigationHint.textContent = multiPanel
    ? "Scroll or pinch anywhere to zoom all · drag anywhere to pan · double-click resets."
    : "Scroll/pinch in the plot to zoom · drag to pan · double-click resets.";

  elements.figurePosition.textContent = "Live";

  elements.figureKey.replaceChildren();
  for (const item of figure.legend || []) {
    const entry = htmlElement("span", "key-entry");
    if (item.swatch) {
      const swatch = htmlElement("i", "key-swatch");
      swatch.style.background = item.swatch;
      entry.append(swatch);
    } else {
      const marker = htmlElement(
        "i",
        `key-marker${item.marker === "square" ? " square" : ""}`,
      );
      marker.style.background = item.color || colors.ink;
      entry.append(marker);
    }
    entry.append(htmlElement("span", null, item.label));
    elements.figureKey.append(entry);
  }

  const figureFrame = htmlElement("div", "figure-plot");
  const layoutKey = figureLayoutKey(figure);
  if (figure.colorbar) {
    figureFrame.append(buildColorbar(figure.colorbar, false));
  }
  const grid = htmlElement("div", "panel-grid");
  grid.style.setProperty("--columns", Math.min(figure.columns || 2, 4));
  for (const [panelIndex, panel] of figure.panels.entries()) {
    const density = panel.density_ref
      ? state.data.densities[panel.density_ref]
      : null;
    grid.append(
      renderPanel(
        panel,
        figure.id,
        layoutKey,
        panelIndex,
        density,
        !multiPanel,
      ),
    );
  }
  figureFrame.append(grid);
  elements.figureMount.append(figureFrame);
  for (const viewport of elements.figureMount.querySelectorAll(
    ".plot-viewport",
  )) {
    const saved = state.plotTransforms.get(viewport.dataset.plotKey);
    if (saved) {
      applyPlotTransform(
        viewport,
        viewport.querySelector("svg"),
        viewport.dataset.plotKey,
        saved,
      );
    }
  }
  updatePointStates();
  applyFigureTransform(
    state.figureTransforms.get(layoutKey) || { scale: 1, x: 0, y: 0 },
  );
  updatePlotHeightControl();
}

function attachPointEvents(element, point, panel) {
  element.addEventListener("focus", () => {
    setHoveredCluster(point.clusterId);
    const rectangle = element.getBoundingClientRect();
    showPointTooltip(
      point.clusterId,
      rectangle.left + rectangle.width / 2,
      rectangle.top + rectangle.height / 2,
      point,
      panel,
    );
  });
  element.addEventListener("blur", () => {
    setHoveredCluster(null);
    elements.pointTooltip.hidden = true;
  });
  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectCluster(point.clusterId);
    }
  });
}

function showPointTooltip(
  clusterId,
  clientX,
  clientY,
  point = null,
  panel = null,
) {
  const cluster = state.clusterById.get(clusterId);
  if (!cluster) {
    return;
  }
  elements.pointTooltip.replaceChildren();
  elements.pointTooltip.append(htmlElement("strong", null, cluster.name));
  if (point && panel) {
    elements.pointTooltip.append(
      htmlElement(
        "span",
        "tooltip-datum",
        `${panel.x_label}: ${formatTooltipDatum(point.x)}`,
      ),
      htmlElement(
        "span",
        "tooltip-datum",
        `${panel.y_label}: ${formatTooltipDatum(point.y)}`,
      ),
    );
  }
  if (point && finite(point.colorValue) && point.colorLabel) {
    elements.pointTooltip.append(
      htmlElement(
        "span",
        "tooltip-datum",
        `${point.colorLabel}: ${formatTooltipDatum(point.colorValue)}`,
      ),
    );
  }
  elements.pointTooltip.style.left = `${clientX}px`;
  elements.pointTooltip.style.top = `${clientY}px`;
  elements.pointTooltip.hidden = false;
}

function setHoveredCluster(clusterId) {
  if (state.hoveredClusterId === clusterId) {
    return;
  }
  state.hoveredClusterId = clusterId;
  updatePointStates();
}

function normaliseSearchTerm(value) {
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function currentFigureClusterIds() {
  const figure = activeFigure();
  if (!figure) {
    return [];
  }
  const ids = new Set();
  for (const panel of figure.panels) {
    for (const series of panel.series) {
      if (series.type !== "points") {
        continue;
      }
      for (const clusterId of series.cluster_ids) {
        ids.add(clusterId);
      }
    }
  }
  return [...ids];
}

function matchingClusters(query) {
  const term = normaliseSearchTerm(query);
  if (!term) {
    return [];
  }
  const matches = [];
  for (const clusterId of currentFigureClusterIds()) {
    const cluster = state.clusterById.get(clusterId);
    if (!cluster) {
      continue;
    }
    const name = normaliseSearchTerm(cluster.name);
    const carmaName = normaliseSearchTerm(cluster.carma_name);
    let rank = null;
    if (name === term || carmaName === term) {
      rank = 0;
    } else if (name.startsWith(term) || carmaName.startsWith(term)) {
      rank = 1;
    } else if (name.includes(term) || carmaName.includes(term)) {
      rank = 2;
    }
    if (rank !== null) {
      matches.push({ cluster, rank });
    }
  }
  matches.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.cluster.name.localeCompare(b.cluster.name, undefined, {
        numeric: true,
      }),
  );
  return matches;
}

function closeClusterSearch() {
  elements.clusterSearchResults.hidden = true;
  elements.clusterSearchInput.setAttribute("aria-expanded", "false");
  elements.clusterSearchInput.removeAttribute("aria-activedescendant");
  state.clusterSearchActiveIndex = -1;
}

function setActiveSearchIndex(index) {
  const options = elements.clusterSearchResults.querySelectorAll(
    ".cluster-search-option",
  );
  if (!options.length) {
    return;
  }
  const count = options.length;
  state.clusterSearchActiveIndex = ((index % count) + count) % count;
  options.forEach((option, optionIndex) => {
    option.setAttribute(
      "aria-selected",
      String(optionIndex === state.clusterSearchActiveIndex),
    );
  });
  const active = options[state.clusterSearchActiveIndex];
  if (active) {
    elements.clusterSearchInput.setAttribute(
      "aria-activedescendant",
      active.id,
    );
    active.scrollIntoView({ block: "nearest" });
  }
}

function chooseSearchResult(match, shift = false) {
  elements.clusterSearchInput.value = match.cluster.name;
  closeClusterSearch();
  selectCluster(match.cluster.id);
  centerClusterAfterSearch(match.cluster.id);
}

function centerClusterAfterSearch(clusterId) {
  const figure = activeFigure();
  if (!figure) {
    return;
  }
  const point = [
    ...elements.figureMount.querySelectorAll(".cluster-point"),
  ].find((element) => element.dataset.clusterId === clusterId);
  if (!point) {
    return;
  }

  if (figure.panels.length > 1) {
    const layoutKey = figureLayoutKey(figure);
    const current = state.figureTransforms.get(layoutKey) || {
      scale: 1,
      x: 0,
      y: 0,
    };
    const scale = Math.max(current.scale, 2.5);
    applyFigureTransform({ ...current, scale });

    const frame = elements.figureMount.getBoundingClientRect();
    const pointRect = point.getBoundingClientRect();
    applyFigureTransform({
      scale,
      x:
        current.x +
        frame.left +
        frame.width / 2 -
        (pointRect.left + pointRect.width / 2),
      y:
        current.y +
        frame.top +
        frame.height / 2 -
        (pointRect.top + pointRect.height / 2),
    });
    point.scrollIntoView({ block: "center", inline: "center" });
  } else {
    const viewport = elements.figureMount.querySelector(".plot-viewport");
    const svg = viewport?.querySelector("svg");
    if (!viewport || !svg) {
      return;
    }
    const key = viewport.dataset.plotKey;
    const current = state.plotTransforms.get(key) || { scale: 1, x: 0, y: 0 };
    const scale = Math.max(current.scale, 2.5);
    applyPlotTransform(viewport, svg, key, { ...current, scale });

    const frame = viewport.getBoundingClientRect();
    const pointRect = point.getBoundingClientRect();
    applyPlotTransform(viewport, svg, key, {
      scale,
      x:
        current.x +
        frame.left +
        frame.width / 2 -
        (pointRect.left + pointRect.width / 2),
      y:
        current.y +
        frame.top +
        frame.height / 2 -
        (pointRect.top + pointRect.height / 2),
    });
    point.scrollIntoView({ block: "center", inline: "center" });
  }
}

function updateClusterSearch() {
  const query = elements.clusterSearchInput.value.trim();
  if (!query) {
    state.clusterSearchMatches = [];
    elements.clusterSearchResults.replaceChildren();
    elements.clusterSearchStatus.textContent = "";
    closeClusterSearch();
    return;
  }

  state.clusterSearchMatches = matchingClusters(query);
  elements.clusterSearchResults.replaceChildren();
  if (!state.clusterSearchMatches.length) {
    elements.clusterSearchResults.append(
      htmlElement(
        "div",
        "cluster-search-empty",
        "No matching cluster in this figure.",
      ),
    );
    elements.clusterSearchStatus.textContent = "No matching clusters.";
  } else {
    state.clusterSearchMatches.slice(0, 12).forEach((match, index) => {
      const option = htmlElement("button", "cluster-search-option");
      option.type = "button";
      option.id = `cluster-search-option-${index}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.append(
        htmlElement("span", "cluster-search-option-name", match.cluster.name),
        htmlElement(
          "span",
          "cluster-search-option-meta",
          `${match.cluster.origin || "origin unavailable"} · CARMA ${match.cluster.carma_name}`,
        ),
      );
      option.addEventListener("pointerdown", (event) => event.preventDefault());
      option.addEventListener("click", (event) =>
        chooseSearchResult(match, event.shiftKey),
      );
      elements.clusterSearchResults.append(option);
    });
    elements.clusterSearchStatus.textContent =
      `${state.clusterSearchMatches.length} matching ` +
      `${state.clusterSearchMatches.length === 1 ? "cluster" : "clusters"}.`;
  }

  state.clusterSearchActiveIndex = -1;
  elements.clusterSearchResults.hidden = false;
  elements.clusterSearchInput.setAttribute("aria-expanded", "true");
  elements.clusterSearchInput.removeAttribute("aria-activedescendant");
}

function resetClusterSearch() {
  elements.clusterSearchInput.value = "";
  state.clusterSearchMatches = [];
  elements.clusterSearchResults.replaceChildren();
  elements.clusterSearchStatus.textContent = "";
  closeClusterSearch();
}

function setupClusterSearch() {
  elements.clusterSearchInput.addEventListener("input", updateClusterSearch);
  elements.clusterSearchInput.addEventListener("focus", () => {
    if (elements.clusterSearchInput.value.trim()) {
      updateClusterSearch();
    }
  });
  elements.clusterSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (elements.clusterSearchResults.hidden) {
        updateClusterSearch();
      }
      if (state.clusterSearchMatches.length) {
        setActiveSearchIndex(state.clusterSearchActiveIndex + 1);
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (state.clusterSearchMatches.length) {
        setActiveSearchIndex(
          state.clusterSearchActiveIndex < 0
            ? state.clusterSearchMatches.length - 1
            : state.clusterSearchActiveIndex - 1,
        );
      }
    } else if (event.key === "Enter" && state.clusterSearchMatches.length) {
      event.preventDefault();
      const index =
        state.clusterSearchActiveIndex >= 0
          ? state.clusterSearchActiveIndex
          : 0;
      chooseSearchResult(state.clusterSearchMatches[index], event.shiftKey);
    } else if (event.key === "Escape") {
      closeClusterSearch();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!elements.clusterSearch.contains(event.target)) {
      closeClusterSearch();
    }
  });
}

function axisLabel(definition) {
  return definition.unit
    ? `${definition.label} [${definition.unit}]`
    : definition.label;
}

function builderValue(cluster, definition) {
  if (!definition) {
    return null;
  }
  const value = cluster[definition.id];
  return finite(value) ? value : null;
}

function builderError(cluster, field) {
  if (!field) {
    return null;
  }
  const value = cluster[field];
  return finite(value) ? value : null;
}

function interpolateHexColor(first, second, fraction) {
  const parse = (value) => [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
  const start = parse(first);
  const end = parse(second);
  const channels = start.map((value, index) =>
    Math.round(value + (end[index] - value) * fraction),
  );
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function variableColor(definition, value, limits = null) {
  if (!definition || !finite(value)) {
    return "#8a8d86";
  }
  const stops = definition.color_stops;
  if (!stops?.length) {
    return "#8a8d86";
  }
  const minimum = finite(limits?.min) ? limits.min : definition.color_min;
  const maximum = finite(limits?.max) ? limits.max : definition.color_max;
  const span = maximum - minimum;
  const fraction = span === 0 ? 0.5 : clamp((value - minimum) / span, 0, 1);
  const position = fraction * (stops.length - 1);
  const index = Math.min(Math.floor(position), stops.length - 2);
  return interpolateHexColor(stops[index], stops[index + 1], position - index);
}

function builderPointSeries(
  clusters,
  xDefinition,
  yDefinition,
  colorDefinition,
  marker,
  baseColor,
  label,
  colorLimits = null,
) {
  const visible = clusters.filter(
    (cluster) =>
      finite(builderValue(cluster, xDefinition)) &&
      finite(builderValue(cluster, yDefinition)),
  );
  return {
    type: "points",
    cluster_ids: visible.map((cluster) => cluster.id),
    x: visible.map((cluster) => builderValue(cluster, xDefinition)),
    y: visible.map((cluster) => builderValue(cluster, yDefinition)),
    x_low: xDefinition.error_low
      ? visible.map((cluster) => builderError(cluster, xDefinition.error_low))
      : null,
    x_high: xDefinition.error_high
      ? visible.map((cluster) => builderError(cluster, xDefinition.error_high))
      : null,
    y_low: yDefinition.error_low
      ? visible.map((cluster) => builderError(cluster, yDefinition.error_low))
      : null,
    y_high: yDefinition.error_high
      ? visible.map((cluster) => builderError(cluster, yDefinition.error_high))
      : null,
    marker,
    color: colorDefinition ? null : baseColor,
    fill_colors: colorDefinition
      ? visible.map((cluster) =>
          variableColor(
            colorDefinition,
            builderValue(cluster, colorDefinition),
            colorLimits,
          ),
        )
      : null,
    color_values: colorDefinition
      ? visible.map((cluster) => builderValue(cluster, colorDefinition))
      : null,
    color_stops: colorDefinition?.color_stops || null,
    color_min: colorLimits?.min ?? colorDefinition?.color_min ?? null,
    color_max: colorLimits?.max ?? colorDefinition?.color_max ?? null,
    color_label: colorDefinition ? axisLabel(colorDefinition) : null,
    size: 4.7,
    label,
  };
}

function originIsLikely(value) {
  return /[\/+?,]/.test(String(value));
}

function originMembership(clusters) {
  const originParts = (value) =>
    String(value)
      .replaceAll("?", "")
      .split(/[\/+,]/)
      .map((part) => part.trim())
      .filter(Boolean);
  const origins = clusters.map((cluster) => String(cluster.origin));
  const groups = [...new Set(origins.flatMap(originParts))].sort();
  return {
    groups,
    assigned: Object.fromEntries(
      groups.map((group) => [
        group,
        clusters.filter((_, index) => origins[index] === group),
      ]),
    ),
    likely: Object.fromEntries(
      groups.map((group) => [
        group,
        clusters.filter(
          (_, index) =>
            originIsLikely(origins[index]) &&
            originParts(origins[index]).includes(group),
        ),
      ]),
    ),
  };
}

function setSharedBuilderDomains(panels) {
  let xMinimum = Infinity;
  let xMaximum = -Infinity;
  let yMinimum = Infinity;
  let yMaximum = -Infinity;
  const include = (x, y) => {
    if (!finite(x) || !finite(y)) {
      return;
    }
    xMinimum = Math.min(xMinimum, x);
    xMaximum = Math.max(xMaximum, x);
    yMinimum = Math.min(yMinimum, y);
    yMaximum = Math.max(yMaximum, y);
  };
  for (const panel of panels) {
    for (const series of panel.series) {
      if (series.type !== "points") {
        continue;
      }
      for (let index = 0; index < series.x.length; index += 1) {
        const x = series.x[index];
        const y = series.y[index];
        include(x, y);
        if (finite(series.x_low?.[index])) include(x - series.x_low[index], y);
        if (finite(series.x_high?.[index]))
          include(x + series.x_high[index], y);
        if (finite(series.y_low?.[index])) include(x, y - series.y_low[index]);
        if (finite(series.y_high?.[index]))
          include(x, y + series.y_high[index]);
      }
    }
  }
  const xDomain = expandDomain(xMinimum, xMaximum);
  const yDomain = expandDomain(yMinimum, yMaximum);
  for (const panel of panels) {
    panel.x_domain ??= xDomain;
    panel.y_domain ??= yDomain;
  }
}

function builderAxisDomain(definition) {
  if (definition.id === "age_gyr") {
    return [0.0, 15.0];
  }
  if (definition.id === "mh" || definition.id === "harris_mh") {
    return [-2.1, 0.25];
  }
  return null;
}

function buildBuilderFigure() {
  const xDefinition = state.variablesById.get(state.builder.x);
  const yDefinition = state.variablesById.get(state.builder.y);
  const colorDefinition = state.variablesById.get(state.builder.color);
  if (!xDefinition || !yDefinition || xDefinition.id === yDefinition.id) {
    throw new Error("Choose two distinct axis variables.");
  }

  const allClusters = state.data.clusters;
  const reliableClusters = state.builder.hideLikely
    ? allClusters.filter((cluster) => !originIsLikely(cluster.origin))
    : allClusters;
  const clusters = reliableClusters.filter(
    (cluster) => (cluster.counts?.valid_stars || 0) >= state.builder.minStars,
  );
  const hiddenUncertainCount = allClusters.length - reliableClusters.length;
  const hiddenLowStarCount = reliableClusters.length - clusters.length;
  const xLabel = axisLabel(xDefinition);
  const yLabel = axisLabel(yDefinition);
  const colorLabel = colorDefinition ? axisLabel(colorDefinition) : null;
  const xiangAllowed =
    new Set([xDefinition.id, yDefinition.id]).has("age_gyr") &&
    ([xDefinition.id, yDefinition.id].includes("mh") ||
      [xDefinition.id, yDefinition.id].includes("harris_mh"));
  const showXiang = Boolean(state.builder.showXiang && xiangAllowed);
  const savedColorRange = colorDefinition
    ? state.colorRanges.get(colorDefinition.id)
    : null;
  const colorRange = colorDefinition
    ? {
        min: finite(savedColorRange?.min)
          ? savedColorRange.min
          : colorDefinition.color_min,
        max: finite(savedColorRange?.max)
          ? savedColorRange.max
          : colorDefinition.color_max,
      }
    : null;
  const colorbar = colorDefinition
    ? {
        label: colorLabel,
        min: colorRange.min,
        max: colorRange.max,
        full_min: colorDefinition.color_min,
        full_max: colorDefinition.color_max,
        colors: colorDefinition.color_stops,
        variable_id: colorDefinition.id,
      }
    : null;

  let panels;
  if (state.builder.layout === "progenitor") {
    const allMembership = originMembership(allClusters);
    const membership = originMembership(clusters);
    panels = [];
    for (const group of allMembership.groups) {
      const assigned = membership.assigned[group] || [];
      const likely = state.builder.hideLikely
        ? []
        : membership.likely[group] || [];
      const assignedSeries = builderPointSeries(
        assigned,
        xDefinition,
        yDefinition,
        colorDefinition,
        "circle",
        colors.bhb,
        "Assigned",
        colorRange,
      );
      const likelySeries = builderPointSeries(
        likely,
        xDefinition,
        yDefinition,
        colorDefinition,
        "square",
        colors.ink,
        "Uncertain",
        colorRange,
      );
      panels.push({
        title: `${group}: ${assignedSeries.cluster_ids.length} assigned, ${likelySeries.cluster_ids.length} uncertain`,
        x_label: xLabel,
        y_label: yLabel,
        x_domain: builderAxisDomain(xDefinition),
        y_domain: builderAxisDomain(yDefinition),
        x_inverted: state.builder.invertX,
        y_inverted: state.builder.invertY,
        series: [assignedSeries, likelySeries],
        annotations: [],
        colorbar: null,
        density_ref: showXiang ? "xiang" : null,
        note: null,
      });
    }
    setSharedBuilderDomains(panels);
  } else {
    const series = builderPointSeries(
      clusters,
      xDefinition,
      yDefinition,
      colorDefinition,
      "circle",
      colors.bhb,
      null,
      colorRange,
    );
    panels = [
      {
        title: `${yDefinition.label} vs ${xDefinition.label}`,
        x_label: xLabel,
        y_label: yLabel,
        x_domain: builderAxisDomain(xDefinition),
        y_domain: builderAxisDomain(yDefinition),
        x_inverted: state.builder.invertX,
        y_inverted: state.builder.invertY,
        series: [series],
        annotations: [],
        colorbar: null,
        density_ref: showXiang ? "xiang" : null,
        note: null,
      },
    ];
  }

  const plottedIds = new Set(
    panels.flatMap((panel) =>
      panel.series.flatMap((series) => series.cluster_ids),
    ),
  );
  const title = `${yDefinition.label} vs ${xDefinition.label}`;
  const descriptionParts = [
    `${plottedIds.size} clusters`,
    state.builder.layout === "progenitor"
      ? "split by CARMA progenitor"
      : state.builder.hideLikely
        ? "assigned origins only"
        : "all clusters",
  ];
  if (colorDefinition) {
    descriptionParts.push(`colour: ${colorDefinition.label}`);
  }
  if (showXiang) {
    descriptionParts.push("Xiang & Rix 2022 density background");
  }
  if (state.builder.invertX || state.builder.invertY) {
    const inverted = [
      state.builder.invertX ? "X" : null,
      state.builder.invertY ? "Y" : null,
    ].filter(Boolean);
    descriptionParts.push(
      `${inverted.join(" and ")} ${inverted.length === 2 ? "axes" : "axis"} reversed`,
    );
  }
  if (hiddenUncertainCount) {
    descriptionParts.push(
      `${hiddenUncertainCount} uncertain-origin ${hiddenUncertainCount === 1 ? "cluster" : "clusters"} hidden`,
    );
  }
  if (hiddenLowStarCount) {
    descriptionParts.push(
      `${hiddenLowStarCount} ${hiddenLowStarCount === 1 ? "cluster" : "clusters"} below ${state.builder.minStars} valid stars hidden`,
    );
  }

  const figure = {
    id: [
      "builder",
      state.builder.layout,
      xDefinition.id,
      yDefinition.id,
      colorDefinition?.id || "plain",
      showXiang ? "xiang" : "no-xiang",
      state.builder.invertX ? "x-inverted" : "x-forward",
      state.builder.invertY ? "y-inverted" : "y-forward",
      state.builder.hideLikely ? "uncertain-hidden" : "uncertain-shown",
      `min-stars-${state.builder.minStars}`,
    ].join("-"),
    title,
    description: `${descriptionParts.join(" · ")}.`,
    group: "CARMA clusters",
    columns: state.builder.layout === "progenitor" ? 4 : 1,
    panels,
    colorbar,
    legend: [
      ...(state.builder.layout === "progenitor"
        ? [
            {
              label: "Assigned",
              marker: "circle",
              color: colorDefinition ? "#9aa0a0" : colors.bhb,
            },
            ...(state.builder.hideLikely
              ? []
              : [
                  {
                    label: "Uncertain",
                    marker: "square",
                    color: colorDefinition ? "#9aa0a0" : colors.ink,
                  },
                ]),
          ]
        : []),
      ...(showXiang
        ? [{ label: "Xiang & Rix 2022 density", swatch: "#66ccff" }]
        : []),
    ],
    plottedClusterCount: plottedIds.size,
    xiangAllowed,
  };
  return figure;
}

function syncBuilderForm() {}
function applyPlotBuilder(options = {}) {
  if (state.builder.x === state.builder.y) {
    const fallback = [...state.variablesById.keys()].find(
      (variableId) => variableId !== state.builder.x,
    );
    state.builder.y = fallback || state.builder.y;
  }
  syncBuilderForm();
  const figure = buildBuilderFigure();
  state.figureById.clear();
  state.figureById.set(figure.id, figure);
  state.activeFigureId = figure.id;
  elements.figureGroup.textContent = "CARMA clusters";
  renderFigure(figure);
  elements.builderStatus.textContent =
    `${figure.plottedClusterCount} plotted · ` +
    `${state.builder.layout === "progenitor" ? `${figure.panels.length} progenitor panels` : "main panel"}` +
    ` · ≥ ${state.builder.minStars} stars` +
    (state.builder.hideLikely ? " · uncertain hidden" : "");
  if (options.updateHash !== false) {
    writeHash();
  }
}

function populateBuilderControls() {}
function resetClusterInformation() {
  elements.infoEmpty.hidden = false;
  elements.infoValues.hidden = true;
  elements.countStrip.hidden = true;
  elements.clusterTitle.textContent = "Awaiting selection";
  elements.clusterOrigin.hidden = true;
  elements.cmdTitle.textContent = "No cluster selected";
  elements.cmdCanvas.setAttribute(
    "aria-label",
    "Interactive colour-magnitude diagram. Select a cluster first.",
  );
  elements.cmdZoomIn.disabled = true;
  elements.cmdZoomOut.disabled = true;
  elements.cmdReset.disabled = true;
  elements.cmdPayload = null;
  state.cmdView = null;
  state.cmdInitialView = null;
}

function clearClusterSelection() {
  state.selectedClusterId = null;
  state.hoveredClusterId = null;
  state.cmdPayload = null;
  state.cmdView = null;
  state.cmdInitialView = null;
  updatePointStates();
  resetClusterInformation();
  showCmdState("empty");
  elements.globalStatus.textContent = "Cluster selection cleared.";
}

function showCmdState(mode, message = "") {
  elements.cmdEmpty.hidden = mode !== "empty";
  elements.cmdLoading.hidden = mode !== "loading";
  elements.cmdError.hidden = mode !== "error";
  elements.cmdCanvas.hidden = mode !== "ready";
  elements.cmdLegend.hidden = mode === "empty";
  if (mode === "error") {
    elements.cmdErrorMessage.textContent = message;
  }
}

function loadCMD(cluster, payload) {
  state.cmdPayload = payload;
  state.cmdInitialView = {
    xMin: payload.x_domain[0],
    xMax: payload.x_domain[1],
    yMin: payload.y_domain[0],
    yMax: payload.y_domain[1],
  };
  state.cmdView = { ...state.cmdInitialView };
  showCmdState("ready");
  elements.cmdZoomIn.disabled = false;
  elements.cmdZoomOut.disabled = false;
  elements.cmdReset.disabled = false;
  elements.globalStatus.textContent = `${cluster.name} selected. CMD loaded with ${payload.counts.bhb} BHB, ${payload.counts.rhb} RHB, ${payload.counts.rgb} RGB, and ${payload.counts.rrl} RR Lyrae stars.`;
  drawCMD();
}

function cmdPlotRect() {
  const width = elements.cmdCanvas.clientWidth;
  const height = elements.cmdCanvas.clientHeight;
  const margin = {
    left: width < 360 ? 48 : 58,
    right: 18,
    top: 18,
    bottom: 48,
  };
  return {
    width,
    height,
    margin,
    innerWidth: Math.max(1, width - margin.left - margin.right),
    innerHeight: Math.max(1, height - margin.top - margin.bottom),
  };
}

function cmdScale(view, rectangle, inverted = false) {
  return {
    x: (value) =>
      rectangle.margin.left +
      ((value - view.xMin) / (view.xMax - view.xMin)) * rectangle.innerWidth,
    y: (value) =>
      inverted
        ? rectangle.margin.top +
          ((value - view.yMin) / (view.yMax - view.yMin)) *
            rectangle.innerHeight
        : rectangle.margin.top +
          rectangle.innerHeight -
          ((value - view.yMin) / (view.yMax - view.yMin)) *
            rectangle.innerHeight,
  };
}

function clippedPath(context, coordinates, rectangle) {
  context.beginPath();
  context.rect(
    rectangle.margin.left,
    rectangle.margin.top,
    rectangle.innerWidth,
    rectangle.innerHeight,
  );
  context.clip();
  context.beginPath();
  coordinates();
}

function drawBaseCMD() {
  if (!state.cmdPayload || !state.cmdView || elements.cmdCanvas.hidden) {
    return;
  }
  const canvas = elements.cmdCanvas;
  const rectangle = cmdPlotRect();
  canvas.dataset.view = [
    state.cmdView.xMin,
    state.cmdView.xMax,
    state.cmdView.yMin,
    state.cmdView.yMax,
  ]
    .map((value) => value.toPrecision(10))
    .join(",");
  canvas.dataset.renderCount = String(
    (Number(canvas.dataset.renderCount) || 0) + 1,
  );
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rectangle.width * dpr));
  canvas.height = Math.max(1, Math.round(rectangle.height * dpr));
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, rectangle.width, rectangle.height);
  context.fillStyle = colors.paper;
  context.fillRect(0, 0, rectangle.width, rectangle.height);

  const view = state.cmdView;
  const scale = cmdScale(view, rectangle, Boolean(state.cmdPayload.y_inverted));
  const payload = state.cmdPayload;

  context.save();
  clippedPath(context, () => {}, rectangle);

  context.strokeStyle = colors.rule;
  context.lineWidth = 0.65;
  context.setLineDash([3, 4]);
  const xTicks = ticksForDomain([view.xMin, view.xMax], 5);
  const yTicks = ticksForDomain([view.yMin, view.yMax], 6);
  for (const value of xTicks) {
    const x = scale.x(value);
    context.beginPath();
    context.moveTo(x, rectangle.margin.top);
    context.lineTo(x, rectangle.margin.top + rectangle.innerHeight);
    context.stroke();
  }
  for (const value of yTicks) {
    const y = scale.y(value);
    context.beginPath();
    context.moveTo(rectangle.margin.left, y);
    context.lineTo(rectangle.margin.left + rectangle.innerWidth, y);
    context.stroke();
  }
  context.setLineDash([]);

  context.fillStyle = getComputedStyle(
    document.documentElement,
  ).getPropertyValue("--star-ink");
  const stars = payload.stars;
  const starSize = state.cmdDotSize || 1.6;
  for (let index = 0; index < stars.x.length; index += 1) {
    const x = stars.x[index];
    const y = stars.y[index];
    if (
      !finite(x) ||
      !finite(y) ||
      x < view.xMin ||
      x > view.xMax ||
      y < view.yMin ||
      y > view.yMax
    ) {
      continue;
    }
    context.fillRect(scale.x(x), scale.y(y), starSize, starSize);
  }

  context.restore();

  context.strokeStyle = colors.ruleStrong;
  context.lineWidth = 1;
  context.strokeRect(
    rectangle.margin.left,
    rectangle.margin.top,
    rectangle.innerWidth,
    rectangle.innerHeight,
  );

  context.fillStyle = colors.tertiary;
  context.font = "8.5px ui-monospace, SFMono-Regular, Consolas, monospace";
  context.textAlign = "center";
  context.textBaseline = "top";
  for (const value of xTicks) {
    const x = scale.x(value);
    context.fillText(
      formatTick(value, view.xMax - view.xMin),
      x,
      rectangle.margin.top + rectangle.innerHeight + 8,
    );
  }
  context.textAlign = "right";
  context.textBaseline = "middle";
  for (const value of yTicks) {
    const y = scale.y(value);
    context.fillText(
      formatTick(value, view.yMax - view.yMin),
      rectangle.margin.left - 8,
      y,
    );
  }

  context.fillStyle = colors.ink;
  context.font = "10px ui-sans-serif, Avenir, Helvetica, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "bottom";
  context.fillText(
    payload.x_label,
    rectangle.margin.left + rectangle.innerWidth / 2,
    rectangle.height - 8,
  );
  context.save();
  context.translate(12, rectangle.margin.top + rectangle.innerHeight / 2);
  context.rotate(-Math.PI / 2);
  context.textBaseline = "top";
  context.fillText(payload.y_label, 0, 0);
  context.restore();
}

function zoomCMD(factor, anchor = null) {
  if (!state.cmdView || !state.cmdInitialView) {
    return;
  }
  const rectangle = cmdPlotRect();
  const view = state.cmdView;
  const margin = rectangle.margin;
  const plotX = anchor?.x ?? rectangle.width / 2;
  const plotY = anchor?.y ?? rectangle.height / 2;
  const fractionX = Math.min(
    1,
    Math.max(0, (plotX - margin.left) / rectangle.innerWidth),
  );
  const fractionY = Math.min(
    1,
    Math.max(0, (plotY - margin.top) / rectangle.innerHeight),
  );
  const dataX = view.xMin + fractionX * (view.xMax - view.xMin);
  const inverted = Boolean(state.cmdPayload?.y_inverted);
  const dataY = inverted
    ? view.yMin + fractionY * (view.yMax - view.yMin)
    : view.yMax - fractionY * (view.yMax - view.yMin);
  let newXRange = (view.xMax - view.xMin) * factor;
  let newYRange = (view.yMax - view.yMin) * factor;
  const initialXRange = state.cmdInitialView.xMax - state.cmdInitialView.xMin;
  const initialYRange = state.cmdInitialView.yMax - state.cmdInitialView.yMin;
  newXRange = Math.min(
    initialXRange * 1.5,
    Math.max(initialXRange / 25, newXRange),
  );
  newYRange = Math.min(
    initialYRange * 1.5,
    Math.max(initialYRange / 25, newYRange),
  );
  state.cmdView = {
    xMin: dataX - fractionX * newXRange,
    xMax: dataX + (1 - fractionX) * newXRange,
    yMin: inverted
      ? dataY - fractionY * newYRange
      : dataY - (1 - fractionY) * newYRange,
    yMax: inverted
      ? dataY + (1 - fractionY) * newYRange
      : dataY + fractionY * newYRange,
  };
  drawCMD();
}

function resetCMD() {
  if (!state.cmdInitialView) {
    return;
  }
  state.cmdView = { ...state.cmdInitialView };
  drawCMD();
}

function cmdPointerIsInsideAxes(event) {
  const rectangle = elements.cmdCanvas.getBoundingClientRect();
  const plot = cmdPlotRect();
  const x = event.clientX - rectangle.left;
  const y = event.clientY - rectangle.top;
  return (
    x >= plot.margin.left &&
    x <= plot.margin.left + plot.innerWidth &&
    y >= plot.margin.top &&
    y <= plot.margin.top + plot.innerHeight
  );
}

function setupCMDInteractions() {
  elements.cmdZoomIn.addEventListener("click", () => zoomCMD(0.8));
  elements.cmdZoomOut.addEventListener("click", () => zoomCMD(1.25));
  elements.cmdReset.addEventListener("click", resetCMD);
  elements.cmdCanvas.addEventListener("dblclick", resetCMD);
  elements.cmdCanvas.addEventListener(
    "wheel",
    (event) => {
      if (elements.cmdCanvas.hidden) {
        return;
      }
      if (!cmdPointerIsInsideAxes(event)) {
        return;
      }
      event.preventDefault();
      const rectangle = elements.cmdCanvas.getBoundingClientRect();
      zoomCMD(Math.exp(event.deltaY * 0.0015), {
        x: event.clientX - rectangle.left,
        y: event.clientY - rectangle.top,
      });
    },
    { passive: false },
  );

  elements.cmdCanvas.addEventListener("pointerdown", (event) => {
    if (!state.cmdView) {
      return;
    }
    event.preventDefault();
    elements.cmdCanvas.setPointerCapture(event.pointerId);
    state.cmdDrag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      view: { ...state.cmdView },
    };
    elements.cmdCanvas.style.cursor = "grabbing";
  });
  elements.cmdCanvas.addEventListener("pointermove", (event) => {
    if (!state.cmdDrag || state.cmdDrag.pointerId !== event.pointerId) {
      return;
    }
    const rectangle = cmdPlotRect();
    const dx = event.clientX - state.cmdDrag.x;
    const dy = event.clientY - state.cmdDrag.y;
    const source = state.cmdDrag.view;
    const xShift = (dx * (source.xMax - source.xMin)) / rectangle.innerWidth;
    const yShift = (dy * (source.yMax - source.yMin)) / rectangle.innerHeight;
    const yDirection = state.cmdPayload?.y_inverted ? -1 : 1;
    state.cmdView = {
      xMin: source.xMin - xShift,
      xMax: source.xMax - xShift,
      yMin: source.yMin + yDirection * yShift,
      yMax: source.yMax + yDirection * yShift,
    };
    drawCMD();
  });
  const endDrag = (event) => {
    if (!state.cmdDrag || state.cmdDrag.pointerId !== event.pointerId) {
      return;
    }
    state.cmdDrag = null;
    elements.cmdCanvas.style.cursor = "grab";
  };
  elements.cmdCanvas.addEventListener("pointerup", endDrag);
  elements.cmdCanvas.addEventListener("pointercancel", endDrag);
  elements.cmdCanvas.style.cursor = "grab";

  elements.cmdCanvas.addEventListener("keydown", (event) => {
    if (!state.cmdView) {
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomCMD(0.8);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomCMD(1.25);
    } else if (event.key.toLowerCase() === "r" || event.key === "0") {
      event.preventDefault();
      resetCMD();
    }
  });

  const observer = new ResizeObserver(() => drawCMD());
  observer.observe(elements.cmdCanvas);
}

function showFatal(error) {
  elements.figureLoading.hidden = true;
  elements.summaryLine.textContent = "Prepared data unavailable";
  elements.figureTitle.textContent = "The atlas data are not ready";
  elements.figureDescription.textContent =
    "Run prepare.py in the project environment, then reload this page.";
  const message = htmlElement("div", "cmd-state cmd-error");
  message.style.position = "relative";
  message.style.minHeight = "320px";
  message.append(
    htmlElement("p", null, "Could not load site.json"),
    htmlElement("span", null, error.message),
    htmlElement("code", null, "python interactive_hb_atlas/prepare.py"),
  );
  elements.figureMount.replaceChildren(message);
  console.error(error);
}

function applyBuilderRoute(route) {
  if (route.x && state.variablesById.has(route.x)) {
    state.builder.x = route.x;
  }
  if (route.y && state.variablesById.has(route.y)) {
    state.builder.y = route.y;
  }
  state.builder.color =
    route.color && state.variablesById.has(route.color) ? route.color : "";
  if (route.layout === "main" || route.layout === "progenitor") {
    state.builder.layout = route.layout;
  }
  if (route.xiang !== null) {
    state.builder.showXiang = route.xiang === "1";
  }
  if (route.invertX !== null) {
    state.builder.invertX = route.invertX === "1";
  }
  if (route.invertY !== null) {
    state.builder.invertY = route.invertY === "1";
  }
  if (route.hideLikely !== null) {
    state.builder.hideLikely = route.hideLikely === "1";
  }
  if (route.minStars !== null) {
    const minimum = Number(route.minStars);
    if (finite(minimum) && minimum >= 0) {
      state.builder.minStars = Math.floor(minimum);
    }
  }
}

function setupCMDDotSize() {
  const input = document.querySelector("#cmd-dot-size");
  const output = document.querySelector("#cmd-dot-size-value");
  let size = 1.6;
  try {
    const stored = Number(
      localStorage.getItem("gc-viewer-cmd-dot-size") || 1.6,
    );
    if (Number.isFinite(stored)) size = clamp(stored, 0.5, 4);
  } catch {}
  state.cmdDotSize = size;
  input.value = String(size);
  output.textContent = `${size.toFixed(1)} px`;
  input.addEventListener("input", () => {
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    state.cmdDotSize = clamp(value, 0.5, 4);
    output.textContent = `${state.cmdDotSize.toFixed(1)} px`;
    try {
      localStorage.setItem("gc-viewer-cmd-dot-size", String(state.cmdDotSize));
    } catch {}
    drawCMD();
  });
}

async function initialize() {
  setupCMDDotSize();
  setupServerSessionWatcher();
  setupCMDInteractions();
  setupColumnResizers();
  setupPlotHeightResizer();
  setupFigureZoom();
  setupClusterSearch();
  restorePanelLayout();
  restorePlotFrameHeight();
  elements.resetPlotViews.addEventListener("click", resetCurrentFigureViews);
  bindHashChange();
  try {
    const response = await fetch("./data/site.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    state.data = await response.json();
    state.clusterById = new Map(
      state.data.clusters.map((cluster) => [cluster.id, cluster]),
    );
    state.variablesById = new Map(
      state.data.variables.map((variable) => [variable.id, variable]),
    );
    elements.clusterSearchInput.disabled = false;

    elements.summaryLine.textContent = `${state.data.summary.clusters} clusters · ${state.data.variables.length} variables · ${state.data.summary.excluded} excluded`;
    state.builder.minStars = Number(
      state.data.provenance.valid_stars_threshold,
    );
    if (!finite(state.builder.minStars) || state.builder.minStars < 0) {
      state.builder.minStars = 100;
    }
    renderProvenance();

    const route = parseHash();
    applyBuilderRoute(route);
    populateBuilderControls();
    setupPlotBuilder();
    applyPlotBuilder({ updateHash: false });
    // A fresh visit starts with no cluster selected, even when an older local
    // URL still contains a cluster parameter.
    resetClusterInformation();
    showCmdState("empty");
    // GC selection is restored by refreshSelection.
  } catch (error) {
    showFatal(error);
  }
}

for (const [key, token] of Object.entries({
  ink: "ink",
  secondary: "ink-secondary",
  tertiary: "ink-tertiary",
  muted: "ink-muted",
  rule: "rule",
  ruleStrong: "rule-strong",
  paper: "paper-raised",
  selection: "selection",
})) {
  Object.defineProperty(colors, key, {
    get: () =>
      getComputedStyle(document.documentElement)
        .getPropertyValue(`--${token}`)
        .trim(),
  });
}
window.addEventListener("viewer-theme", () => {
  if (state.data) {
    applyPlotBuilder({ updateHash: false });
    drawCMD();
  }
});

state.selectedIds = [];
state.compare = false;
state.builder = {
  ...state.builder,
  x: "age_gyr",
  y: "mh",
  color: "",
  layout: "main",
  showXiang: false,
  hideLikely: false,
  minStars: 100,
};
const comparisonColours = ["#ff0000", "#66ccff", "#ed8c18"];
function syncComparisonControl() {
  const button = document.querySelector("#compare-multiple");
  button.textContent = `Compare multiple: ${state.compare ? "On" : "Off"}`;
  button.setAttribute("aria-pressed", String(state.compare));
}
function writeHash() {
  const p = new URLSearchParams();
  p.set("clusters", state.selectedIds.join(","));
  p.set("compare", state.compare ? "1" : "0");
  history.replaceState(null, "", `#${p}`);
}
function setupServerSessionWatcher() {}
function renderProvenance() {
  elements.provenance.textContent = `Prepared ${state.data.generated_at}; original scientific cuts retained; ${state.data.excluded.length} excluded clusters.`;
}
function toggleComparison() {
  state.compare = !state.compare;
  syncComparisonControl();
  if (!state.compare) state.selectedIds = state.selectedIds.slice(0, 1);
  refreshSelection();
}
function setupPlotBuilder() {
  const button = document.querySelector("#compare-multiple");
  button.onclick = toggleComparison;
  document.addEventListener("keydown", (event) => {
    if (
      event.key !== "Shift" ||
      event.repeat ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    if (
      event.target?.closest("input, textarea, select, [contenteditable='true']")
    )
      return;
    toggleComparison();
  });
  document.querySelector("#clear-comparison").onclick = () => {
    state.selectedIds = [];
    refreshSelection();
  };
  const route = new URLSearchParams(location.hash.slice(1));
  state.compare = route.get("compare") === "1";
  state.selectedIds = (route.get("clusters") || "")
    .split(",")
    .filter((id, i, ids) => state.clusterById.has(id) && ids.indexOf(id) === i)
    .slice(0, state.compare ? 3 : 1);
  syncComparisonControl();
  setTimeout(refreshSelection, 0);
}
function bindHashChange() {
  window.addEventListener("hashchange", () => {
    const p = new URLSearchParams(location.hash.slice(1));
    state.compare = p.get("compare") === "1";
    state.selectedIds = [...new Set((p.get("clusters") || "").split(","))]
      .filter((id) => state.clusterById.has(id))
      .slice(0, state.compare ? 3 : 1);
    syncComparisonControl();
    refreshSelection();
  });
}
function renderClusterInformation() {
  elements.infoEmpty.hidden = state.selectedIds.length > 0;
  elements.infoEmpty.textContent =
    "Select up to three clusters to compare their CARMA measurements.";
  elements.infoValues.hidden = false;
  elements.infoValues.replaceChildren();
  elements.countStrip.hidden = true;
  elements.clusterOrigin.hidden = true;
  elements.clusterTitle.textContent = "CARMA measurements";
  elements.infoValues.hidden = state.selectedIds.length === 0;
  const header = htmlElement("tr");
  const corner = htmlElement("th", null, "Measurement");
  corner.setAttribute("scope", "col");
  header.append(corner);
  state.selectedIds.forEach((id, index) => {
    const heading = htmlElement("th", null, state.clusterById.get(id).name);
    heading.setAttribute("scope", "col");
    if (state.selectedIds.length > 1)
      heading.style.borderTop = `3px solid ${comparisonColours[index]}`;
    header.append(heading);
  });
  const head = htmlElement("thead");
  head.append(header);
  const body = htmlElement("tbody");
  for (const [label, field, lowField, highField, unit] of [
    ["[M/H]", "mh", "mh_low", "mh_high", "dex"],
    ["Age", "age_gyr", "age_low", "age_high", "Gyr"],
    ["E(B−V)", "ebv", "ebv_err", "ebv_err", "mag"],
  ]) {
    const row = htmlElement("tr");
    const heading = htmlElement("th", null, label);
    heading.setAttribute("scope", "row");
    row.append(heading);
    for (const id of state.selectedIds) {
      const cluster = state.clusterById.get(id);
      const cell = htmlElement("td");
      const number = htmlElement("span", "carma-number");
      number.append(
        htmlElement("span", "carma-central", formatNumber(cluster[field])),
      );
      const low = cluster[lowField],
        high = cluster[highField];
      if (finite(low) && finite(high)) {
        const uncertainty = htmlElement("span", "carma-uncertainty");
        uncertainty.setAttribute(
          "aria-label",
          `plus ${formatNumber(high)}, minus ${formatNumber(low)}`,
        );
        uncertainty.append(
          htmlElement("sup", null, `+${formatNumber(high)}`),
          htmlElement("sub", null, `−${formatNumber(low)}`),
        );
        number.append(uncertainty);
      } else
        number.append(
          htmlElement("span", "carma-unit", "uncertainty unavailable"),
        );
      cell.append(
        number,
        htmlElement("span", "carma-unit carma-table-unit", unit),
      );
      row.append(cell);
    }
    body.append(row);
  }
  elements.infoValues.append(head, body);
}
function updatePointStates() {
  for (const e of elements.figureMount.querySelectorAll(".cluster-point")) {
    const i = state.selectedIds.indexOf(e.dataset.clusterId);
    e.classList.toggle("is-selected", i >= 0);
    e.classList.toggle(
      "is-hovered",
      e.dataset.clusterId === state.hoveredClusterId,
    );
    e.setAttribute("aria-pressed", String(i >= 0));
    const ring = e.querySelector(".selection-ring");
    if (ring) {
      ring.toggleAttribute("hidden", i < 0);
      ring.style.stroke = comparisonColours[i] || colors.selection;
    }
  }
}
async function selectCluster(id) {
  if (!state.clusterById.has(id)) return;
  const multiple = state.compare;
  if (multiple) {
    state.compare = true;
    syncComparisonControl();
    const i = state.selectedIds.indexOf(id);
    if (i >= 0) state.selectedIds.splice(i, 1);
    else if (state.selectedIds.length < 3) state.selectedIds.push(id);
    else {
      document.querySelector("#comparison-status").textContent =
        "Maximum three clusters. Remove one before adding another.";
      return;
    }
  } else state.selectedIds = [id];
  await refreshSelection();
}
async function refreshSelection() {
  const request = ++state.cmdRequest;
  state.selectedClusterId = state.selectedIds[0] || null;
  writeHash();
  updatePointStates();
  renderClusterInformation();
  const list = document.querySelector("#comparison-selection");
  list.replaceChildren();
  state.selectedIds.forEach((id, i) => {
    const b = htmlElement(
      "button",
      "comparison-chip",
      `${state.clusterById.get(id).name} ×`,
    );
    b.type = "button";
    b.style.borderLeft = `4px solid ${comparisonColours[i]}`;
    b.setAttribute("aria-label", `Remove ${id}`);
    b.onclick = () => {
      state.selectedIds = state.selectedIds.filter((x) => x !== id);
      refreshSelection();
    };
    list.append(b);
  });
  document.querySelector("#comparison-status").textContent =
    `${state.selectedIds.length} / 3 selected`;
  elements.cmdTitle.textContent =
    state.selectedIds.map((id) => state.clusterById.get(id).name).join(" + ") ||
    "No cluster selected";
  if (!state.selectedIds.length) {
    state.cmdPayload = null;
    state.cmdView = null;
    state.cmdInitialView = null;
    elements.cmdZoomIn.disabled = true;
    elements.cmdZoomOut.disabled = true;
    elements.cmdReset.disabled = true;
    showCmdState("empty");
    return;
  }
  elements.cmdError.querySelectorAll("button").forEach((b) => b.remove());
  showCmdState("loading");
  try {
    const payloads = await Promise.all(
      state.selectedIds.map(async (id) => {
        if (state.cmdCache.has(id)) return state.cmdCache.get(id);
        const c = state.clusterById.get(id);
        const r = await fetch(`./data/cmd/${c.slug}.json`);
        if (!r.ok) throw Error(`${id}: HTTP ${r.status}`);
        const data = await r.json();
        state.cmdCache.set(id, data);
        return data;
      }),
    );
    if (request !== state.cmdRequest) return;
    state.cmdPayload = {
      ...payloads[0],
      stars: {
        x: payloads.flatMap((p) => p.stars.x),
        y: payloads.flatMap((p) => p.stars.y),
      },
      payloads,
    };
    state.cmdInitialView = {
      xMin: Math.min(...payloads.map((p) => p.x_domain[0])),
      xMax: Math.max(...payloads.map((p) => p.x_domain[1])),
      yMin: Math.min(...payloads.map((p) => p.y_domain[0])),
      yMax: Math.max(...payloads.map((p) => p.y_domain[1])),
    };
    state.cmdView = { ...state.cmdInitialView };
    showCmdState("ready");
    elements.cmdZoomIn.disabled = false;
    elements.cmdZoomOut.disabled = false;
    elements.cmdReset.disabled = false;
    elements.cmdCanvas.setAttribute(
      "aria-label",
      `Corrected absolute-magnitude CMD: ${state.selectedIds.join(", ")}`,
    );
    elements.cmdLegend.textContent =
      state.selectedIds
        .map(
          (id, i) =>
            `${state.selectedIds.length > 1 ? ["Red", "Blue", "Orange"][i] + ": " : ""}${id}`,
        )
        .join(" · ") + " · × RR Lyrae";
    drawCMD();
  } catch (error) {
    if (request === state.cmdRequest) {
      showCmdState("error", error.message);
      const retry = htmlElement("button", null, "Retry CMD loading");
      retry.onclick = refreshSelection;
      elements.cmdError.append(retry);
    }
  }
}
function drawCMD() {
  if (!state.cmdPayload?.payloads || !state.cmdView) return;
  // Base renderer draws the frame; samples are rendered below in cluster colours.
  const combined = state.cmdPayload.stars;
  state.cmdPayload.stars = { x: [], y: [] };
  drawBaseCMD();
  state.cmdPayload.stars = combined;
  const r = cmdPlotRect(),
    s = cmdScale(state.cmdView, r, true),
    v = state.cmdView,
    ctx = elements.cmdCanvas.getContext("2d");
  ctx.save();
  clippedPath(ctx, () => {}, r);
  state.cmdPayload.payloads.forEach((p, j) => {
    const colour =
      state.selectedIds.length > 1
        ? comparisonColours[j]
        : getComputedStyle(document.documentElement).getPropertyValue(
            "--star-ink",
          );
    ctx.fillStyle = colour;
    ctx.globalAlpha = 0.75;
    for (let i = 0; i < p.stars.x.length; i++) {
      const x = p.stars.x[i],
        y = p.stars.y[i];
      if (x < v.xMin || x > v.xMax || y < v.yMin || y > v.yMax) continue;
      ctx.fillRect(
        s.x(x),
        s.y(y),
        state.cmdDotSize || 1.6,
        state.cmdDotSize || 1.6,
      );
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = state.selectedIds.length > 1 ? colour : colors.rrl;
    ctx.lineWidth = 1.1;
    p.stars.rrl.forEach((rr, i) => {
      if (!rr) return;
      const x = s.x(p.stars.x[i]),
        y = s.y(p.stars.y[i]);
      ctx.beginPath();
      ctx.moveTo(x - 2.5, y - 2.5);
      ctx.lineTo(x + 2.5, y + 2.5);
      ctx.moveTo(x + 2.5, y - 2.5);
      ctx.lineTo(x - 2.5, y + 2.5);
      ctx.stroke();
    });
  });
  ctx.restore();
}

initialize();
