"use strict";

/* Figure 1 Dumbell Chart: one dumbbell per country -  gap between female and male life expectancy at birth */

(function () {
  const DATA_URL = "life_expectancy_gap.csv";
  const MIN_YEAR = 1960;
  const MAX_YEAR = 2019;
  const CHANGE_THRESHOLD = 0.5; 
  const ROW_H = 23;

  // palette from stylesheet
  const COLORS = {
    widened: "#c0508a", narrowed: "#3f7fb3", same: "#8a94a6", ink: "#475569",
    female: "#c0508a", male: "#3f7fb3",
  };

  const NAMES = {
    "Russian Federation": "Russia",
    "Iran, Islamic Rep.": "Iran",
    "Egypt, Arab Rep.": "Egypt",
    "Korea, Rep.": "South Korea",
    "Congo, Dem. Rep.": "DR Congo",
  };
  const label = (c) => NAMES[c] || c;
  const fmt1 = d3.format(".1f");
  const signed = d3.format("+.1f");
  const minus = (v) => (v > 0 ? "+" + v : v < 0 ? "−" + Math.abs(v) : "0");

  const SORTS = {
    latest: { text: `their ${MAX_YEAR} gap`, fn: (a, b) => d3.descending(a.latest, b.latest) },
    end: { text: "the gap in the end year", fn: (a, b) => d3.descending(a.end, b.end) },
    change: { text: "how much their gap changed", fn: (a, b) => d3.descending(a.change, b.change) },
    population: { text: `${MAX_YEAR} population`, fn: (a, b) => d3.descending(a.population, b.population) },
    name: { text: "name (A–Z)", fn: (a, b) => d3.ascending(a.name, b.name) },
  };

  // Presets
  const STORIES = {
    big: { from: 1960, to: 2019, highlight: [], select: "USA" },
    russia: {
      from: 1989, to: 1994, highlight: ["RUS"], select: "RUS",
      context: "The drop in men’s life expectancy coincides with the upheaval after the Soviet Union’s collapse. The data show the gap, not its causes.",
    },
    iran: {
      from: 1979, to: 1984, highlight: ["IRN"], select: "IRN",
      context: "This coincides with the Iran–Iraq War (1980–88), which killed many young men. The data show the gap, not its causes.",
    },
    menfirst: { from: 1960, to: 2019, highlight: ["BGD", "IND", "IRN"], select: "BGD" },
  };

  d3.csv(DATA_URL, d3.autoType).then(init).catch((err) => {
    console.error(err);
    d3.select("#error").property("hidden", false);
  });

  function init(data) {
    const featured = data.filter((d) => d.featured === true || d.featured === "True");

    /* indexing */
    const series = new Map();      // rows sorted by year
    const atYear = new Map();      // map(year to row)
    d3.group(featured, (d) => d.code).forEach((vals, code) => {
      vals.sort((a, b) => d3.ascending(a.year, b.year));
      series.set(code, vals);
      atYear.set(code, new Map(vals.map((d) => [d.year, d])));
    });
    const codes = Array.from(series.keys());
    const nameOf = (code) => label(series.get(code)[0].country);
    const globalMaxGap = d3.max(data, (d) => d.gap);

    // make positions comparable in every year
    const X_LO = Math.floor(d3.min(featured, (d) => d.gap) - 1);
    const X_HI = Math.ceil(d3.max(featured, (d) => d.gap)) + 1;

    /* default state */
    const state = {
      from: 1960, to: 2019, sort: "latest",
      selected: "USA", highlight: new Set(), story: "big",
      playing: false, hover: null,
    };
    let timer = null;
    const view = { L: { W: 960, ml: 118, iw: 778 } };   // latest main-chart layout (used to place the tooltip)

    /* rows based on current start and end */
    function rowsFor(from, to) {
      const rows = codes.map((code) => {
        const a = atYear.get(code).get(from), b = atYear.get(code).get(to);
        const last = atYear.get(code).get(MAX_YEAR);
        const change = b.gap - a.gap;
        return {
          code, name: nameOf(code), start: a.gap, end: b.gap, change,
          latest: last.gap, population: last.population,
          startF: a.life_exp_female, startM: a.life_exp_male,
          endF: b.life_exp_female, endM: b.life_exp_male,
          kind: change > CHANGE_THRESHOLD ? "widened" : change < -CHANGE_THRESHOLD ? "narrowed" : "same",
        };
      });
      return rows.sort(SORTS[state.sort].fn);
    }

    /* DOM refs */
    const fromInput = d3.select("#from-year"), toInput = d3.select("#to-year");
    const fromOut = d3.select("#from-out"), toOut = d3.select("#to-out");
    const playBtn = d3.select("#play");
    const sortSel = d3.select("#sort");
    const countrySel = d3.select("#country-select");
    const tooltip = d3.select("#tooltip");

    const sortedNames = codes.slice().sort((a, b) => d3.ascending(nameOf(a), nameOf(b)));
    countrySel.selectAll("option").data(sortedNames).join("option")
      .attr("value", (c) => c).text((c) => nameOf(c));

    /* data based text generation */
    function writeText(rows) {
      const { from, to } = state;
      const n = rows.length;
      const womenLonger = rows.filter((d) => d.end > 0).length;
      const menStart = rows.filter((d) => d.start < 0).length;
      const lead = to === MAX_YEAR ? "Today" : `In ${to}`;

      const outlive = to === MAX_YEAR ? "outlive" : "outlived";
      const them = (k) => (k === 1 ? "one of them" : `${k} of them`);
      let title;
      if (womenLonger === n) {
        title = `${lead}, women ${outlive} men in all ${n} of the most populous countries`;
        if (from < to && menStart > 0)
          title += ` — in ${from}, men lived longer in ${them(menStart)}`;
      } else {
        title = `In ${to}, women ${outlive} men in ${womenLonger} of the ${n} most populous countries; ` +
                `men lived longer in ${n - womenLonger}`;
      }
      d3.select("#f1-title").text(title);

      d3.select("#f1-subtitle").style("white-space", "pre-line").text(
        `Each row is one of the ${n} most populous countries (by ${MAX_YEAR} population). The dots show the gap between ` +
        `female and male life expectancy at birth in years (female - male) in ${from} (open bubbles) and ${to} (filled bubbles). ` +
        `\nRegional and income-group aggregates were removed. \nRows are sorted by ${SORTS[state.sort].text}.`
      );

      const widened = rows.filter((d) => d.kind === "widened").length;
      const narrowed = rows.filter((d) => d.kind === "narrowed").length;
      d3.select("#f1-note").text(
        from === to
          ? `Both dots show ${to}, so no change is drawn. Source: World Bank life expectancy at birth by sex. Gap = female minus male, in years.`
          : `From ${from} to ${to}, the gap widened by more than ${CHANGE_THRESHOLD} years in ${widened} of these countries, ` +
            `narrowed in ${narrowed}, and changed little in ${n - widened - narrowed}. ` +
            `Source: World Bank life expectancy at birth by sex. Gap = female minus male, in years.`
      );
    }

    function crossingYear(code) {
      const s = series.get(code);
      const lastNonPositive = d3.max(s.filter((d) => d.gap <= 0), (d) => d.year);
      return lastNonPositive === undefined ? MIN_YEAR : lastNonPositive + 1;
    }

    function writeStory(rows) {
      const box = d3.select("#story-text");
      const key = state.story;
      if (!key) { box.html(""); return; }
      const spec = STORIES[key];
      const { from, to } = state;

      let html = "";
      if (key === "big") {
        const widened = rows.filter((d) => d.kind === "widened").length;
        const narrowed = rows.filter((d) => d.kind === "narrowed").length;
        html = `Between ${from} and ${to}, the gap <strong>widened</strong> in ${widened} of ${rows.length} countries, ` +
               `<strong>narrowed</strong> in ${narrowed} and barely moved in ${rows.length - widened - narrowed}. ` +
               `Try <em>Play</em>, or sort by “Change in the gap”.`;
      } else {
        const hs = rows.filter((d) => state.highlight.has(d.code));
        if (hs.length === 1) {
          const r = hs[0];
          html = `<strong>${r.name}</strong>: the gap went from <strong>${signed(r.start)}</strong> years in ${from} to ` +
                 `<strong>${signed(r.end)}</strong> in ${to}. Men’s life expectancy moved ${fmt1(r.startM)} → ${fmt1(r.endM)}; ` +
                 `women’s ${fmt1(r.startF)} → ${fmt1(r.endF)}.` +
                 (r.end === globalMaxGap ? ` That is the largest gap of any country in any year in this dataset.` : "");
        } else {
          html = hs.map((r) => `<strong>${r.name}</strong> ${signed(r.start)} → ${signed(r.end)}`).join(" · ") +
                 ` years (${from} → ${to}). ` +
                 `Women moved permanently ahead in ` +
                 hs.map((r) => `${r.name} in ${crossingYear(r.code)}`).join(", ").replace(/, ([^,]*)$/, ", and $1") + ".";
        }
        if (spec.context && from === spec.from && to === spec.to) html += ` <span class="muted">${spec.context}</span>`;
      }
      box.html(html);
    }

    /* legend */
    (function buildLegend() {
      const box = d3.select("#legend").html("");
      const item = (text, draw, cls) => {
        const el = box.append("span").attr("class", "legend-item");
        const svg = el.append("svg").attr("width", 34).attr("height", 16);
        draw(svg);
        el.append("span").attr("class", cls || null).text(text);
      };
      item("", (s) => s.append("circle").attr("cx", 17).attr("cy", 8).attr("r", 5)
        .attr("fill", "#fff").attr("stroke", COLORS.ink).attr("stroke-width", 1.8), "lg-from");
      item("", (s) => s.append("circle").attr("cx", 17).attr("cy", 8).attr("r", 5).attr("fill", COLORS.ink), "lg-to");
      [["widened", "Gap widened (women living longer)"],
       ["narrowed", "Gap narrowed (men catching up)"],
       ["same", `About the same (±${CHANGE_THRESHOLD} yr)`]].forEach(([k, t]) =>
        item(t, (s) => s.append("line").attr("x1", 0).attr("x2", 34).attr("y1", 8).attr("y2", 8)
          .attr("stroke", COLORS[k]).attr("stroke-width", 3).attr("stroke-linecap", "round")));
    })();

    /* main chart */
    const m = { top: 54, right: 40, bottom: 56, left: 118 };
    const getW = () => Math.max(300, Math.min(960, Math.round(document.querySelector("#chart").clientWidth || 960)));
    const svg = d3.select("#chart").append("svg").attr("role", "group");
    const g = svg.append("g");
    const layers = {
      zones: g.append("g"), bands: g.append("g"), grid: g.append("g").attr("class", "grid-x"),
      zero: g.append("g"), rows: g.append("g"), notes: g.append("g"), axis: g.append("g").attr("class", "axis"),
    };

    function layout() {
      const W = getW();
      const ml = W < 560 ? 92 : m.left;
      const iw = W - ml - m.right;
      const ih = codes.length * ROW_H;
      const x = d3.scaleLinear().domain([X_LO, X_HI]).range([0, iw]);
      return { W, ml, iw, ih, H: m.top + ih + m.bottom, x, wide: W >= 760 };
    }

    function drawFrame(L) {
      svg.attr("viewBox", `0 0 ${L.W} ${L.H}`)
        .attr("aria-label", `Dumbbell chart: female minus male life expectancy gap for the ${codes.length} most populous countries`);
      g.attr("transform", `translate(${L.ml},${m.top})`);

      layers.zones.selectAll("rect").data([
        { x: 0, w: L.x(0), fill: "#edf4fa" }, { x: L.x(0), w: L.iw - L.x(0), fill: "#fdf6fa" },
      ]).join("rect").attr("x", (d) => d.x).attr("y", 0).attr("width", (d) => d.w)
        .attr("height", L.ih).attr("fill", (d) => d.fill);

      layers.bands.selectAll("rect").data(d3.range(0, codes.length, 2)).join("rect")
        .attr("class", "row-band").attr("x", 0).attr("width", L.iw)
        .attr("y", (i) => i * ROW_H).attr("height", ROW_H).attr("fill", "#0f172a").attr("fill-opacity", 0.025);

      const tickCount = L.iw < 420 ? 6 : 10;
      layers.grid.attr("transform", `translate(0,${L.ih})`)
        .call(d3.axisBottom(L.x).ticks(tickCount).tickSize(-L.ih).tickFormat(""));
      layers.axis.attr("transform", `translate(0,${L.ih})`)
        .call(d3.axisBottom(L.x).ticks(tickCount).tickFormat(minus));
      layers.axis.selectAll(".axis-label").data([0]).join("text").attr("class", "axis-label")
        .attr("x", L.iw / 2).attr("y", 44).attr("text-anchor", "middle")
        .text("Female − male life expectancy at birth (years)");

      layers.zero.selectAll("line").data([0]).join("line").attr("class", "zero-line")
        .attr("x1", L.x(0)).attr("x2", L.x(0)).attr("y1", -8).attr("y2", L.ih);
      layers.zero.selectAll("text").data([
        { t: "◄ Men live longer", cls: "m", dx: -8, anchor: "end" },
        { t: "Women live longer ►", cls: "f", dx: 8, anchor: "start" },
      ]).join("text").attr("class", (d) => `zone-label ${d.cls}`)
        .attr("x", (d) => L.x(0) + d.dx).attr("y", -16).attr("text-anchor", (d) => d.anchor).text((d) => d.t);
    }

    /* tooltip */
    function showTip(event, d) {
      const pop = d.population >= 1e9 ? d3.format(".2f")(d.population / 1e9) + " billion"
        : d3.format(".0f")(d.population / 1e6) + " million";
      const row = (a, b) => `<div class="row"><span>${a}</span><span>${b}</span></div>`;
      const { from, to } = state;
      tooltip.html(
        `<strong>${d.name}</strong>` +
        `<div class="tip-h">${from}</div>` +
        row("Women / men", `${fmt1(d.startF)} / ${fmt1(d.startM)} yrs`) + row("Gap", signed(d.start) + " yrs") +
        (from !== to
          ? `<div class="tip-h">${to}</div>` + row("Women / men", `${fmt1(d.endF)} / ${fmt1(d.endM)} yrs`) +
            row("Gap", signed(d.end) + " yrs") + row("Change", signed(d.change) + " yrs")
          : "") +
        `<div class="tip-h">${MAX_YEAR} population</div>` + row("People", pop) +
        `<div class="tip-foot">Click to zoom in below</div>`
      ).style("opacity", 1).attr("aria-hidden", "false");
      placeTip(event.currentTarget);
    }
    // anchoring tooltip to right margin
    function placeTip(rowEl) {
      const node = tooltip.node();
      const w = node.offsetWidth, h = node.offsetHeight;
      const sr = svg.node().getBoundingClientRect();
      const rr = rowEl.getBoundingClientRect();
      const k = sr.width / view.L.W;
      const plotRight = sr.left + k * (view.L.ml + view.L.iw);
      let left = Math.max(8, plotRight - w) + window.scrollX;
      let top = rr.top + window.scrollY - 4;
      const chartTop = sr.top + window.scrollY, chartBottom = sr.bottom + window.scrollY;
      top = Math.min(top, chartBottom - k * m.bottom - h);
      top = Math.max(top, chartTop);
      tooltip.style("left", left + "px").style("top", top + "px");
    }
    function hideTip() { tooltip.style("opacity", 0).attr("aria-hidden", "true"); }

    /* country rows */
    function drawRows(rows, L, dur) {
      const ease = state.playing ? d3.easeLinear : d3.easeCubicInOut;
      const T = (sel) => (dur > 0 ? sel.transition().duration(dur).ease(ease) : sel);
      const yOf = (i) => i * ROW_H;
      const mid = ROW_H / 2;
      const order = new Map(rows.map((r, i) => [r.code, i]));

      const rowSel = layers.rows.selectAll("g.row").data(rows, (d) => d.code).join((enter) => {
        const e = enter.append("g").attr("class", "row").attr("data-code", (d) => d.code)
          .attr("transform", (d) => `translate(0,${yOf(order.get(d.code))})`);
        e.append("rect").attr("class", "row-bg");
        e.append("line").attr("class", "link");
        e.append("circle").attr("class", "dot start").attr("r", 5.2);
        e.append("circle").attr("class", "dot end").attr("r", 5.6);
        e.append("text").attr("class", "country-label");
        e.append("rect").attr("class", "hit").attr("tabindex", 0).attr("role", "button");
        return e;
      });

      rowSel.classed("is-story", (d) => state.highlight.has(d.code))
        .classed("is-selected", (d) => d.code === state.selected);
      svg.classed("focus-mode", state.highlight.size > 0);

      T(rowSel).attr("transform", (d) => `translate(0,${yOf(order.get(d.code))})`);

      rowSel.select(".row-bg").attr("x", -L.ml).attr("width", L.W).attr("y", 0).attr("height", ROW_H);
      rowSel.select(".hit").attr("x", -L.ml).attr("width", L.W).attr("y", 0).attr("height", ROW_H)
        .attr("aria-label", (d) => `${d.name}: gap ${signed(d.start)} in ${state.from}, ${signed(d.end)} in ${state.to}. Press Enter to zoom in.`);

      T(rowSel.select(".link")).attr("x1", (d) => L.x(d.start)).attr("x2", (d) => L.x(d.end))
        .attr("y1", mid).attr("y2", mid).attr("stroke", (d) => COLORS[d.kind]);
      T(rowSel.select(".dot.start")).attr("cx", (d) => L.x(d.start)).attr("cy", mid);
      T(rowSel.select(".dot.end")).attr("cx", (d) => L.x(d.end)).attr("cy", mid).attr("fill", (d) => COLORS[d.kind]);
      rowSel.select(".country-label").attr("x", -10).attr("y", mid).attr("dy", "0.34em").text((d) => d.name);

      rowSel
        .on("mouseenter", (event, d) => { state.hover = d.code; svg.classed("hovering", true); markHover(); showTip(event, d); })
        .on("mouseleave", () => { state.hover = null; svg.classed("hovering", false); markHover(); hideTip(); })
        .on("click", (event, d) => selectCountry(d.code));
      rowSel.select(".hit").on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectCountry(d.code); }
      });
      markHover();
      return { order, yOf };
    }

    function markHover() {
      layers.rows.selectAll("g.row").classed("is-hover", (d) => d.code === state.hover);
    }

    /* handful/subset of callouts */
    function drawNotes(rows, L, pos) {
      const pick = [];
      if (!state.playing && L.wide && rows.length) {
        const { from, to } = state;
        const has = (r) => pick.some((p) => p.row === r);
        if (state.highlight.size) {
          rows.filter((r) => state.highlight.has(r.code)).forEach((r) =>
            pick.push({ row: r, lead: `${r.name}: `, rest: `${signed(r.start)} → ${signed(r.end)} yrs`, short: `${signed(r.start)} → ${signed(r.end)}` }));
        } else {
          const top = d3.greatest(rows, (d) => d.end);
          pick.push({ row: top, lead: `Largest gap in ${to}:`, rest: ` ${signed(top.end)} yrs`, short: `${signed(top.end)} yrs` });
          if (from !== to) {
            const widest = d3.greatest(rows, (d) => d.change);
            const narrow = d3.least(rows, (d) => d.change);
            if (!has(widest)) pick.push({ row: widest, lead: `Biggest widening: ${signed(widest.change)} yrs`, rest: widest.start < 0 ? ` (men led in ${from})` : "", short: `${signed(widest.change)} yrs` });
            if (narrow.change < -CHANGE_THRESHOLD && !has(narrow))
              pick.push({ row: narrow, lead: `Biggest narrowing: ${signed(narrow.change)} yrs`, rest: "", short: `${signed(narrow.change)} yrs` });
          }
          rows.filter((r) => r.end < 0 && !has(r)).slice(0, 3).forEach((r) =>
            pick.push({ row: r, lead: `Men still live longer:`, rest: ` ${signed(r.end)} yrs`, short: `${signed(r.end)} yrs` }));
        }
      }

      const gs = layers.notes.selectAll("g.note").data(pick, (d) => d.row.code).join((enter) => {
        const e = enter.append("g").attr("class", "note annotation");
        e.append("line").attr("class", "annotation-line");
        const t = e.append("text");
        t.append("tspan").attr("class", "lead").attr("font-weight", 700);
        t.append("tspan").attr("class", "rest");
        return e;
      });

      gs.each(function (d) {
        const r = d.row, sel = d3.select(this);
        const cy = pos.yOf(pos.order.get(r.code)) + ROW_H / 2;
        const right = Math.max(L.x(r.start), L.x(r.end));
        const limit = L.iw + m.right - 4;          // furthest x the text may reach
        const text = sel.select("text").attr("y", cy).attr("dy", "0.34em");
        const widthOf = (lead, rest) => {
          sel.select(".lead").text(lead); sel.select(".rest").text(rest);
          return text.node().getComputedTextLength ? text.node().getComputedTextLength() : 150;
        };
        let lead = d.lead, rest = d.rest, w = widthOf(lead, rest);
        if (right + 19 + w > limit && d.short) { lead = ""; rest = d.short; w = widthOf(lead, rest); }
        const x = right + 19 + w <= limit ? right + 19 : Math.max(right + 19, limit - w);
        text.attr("x", x).attr("text-anchor", "start");
        sel.select("line").attr("x1", right + 8).attr("x2", Math.min(right + 15, x - 3)).attr("y1", cy).attr("y2", cy);
      });
    }

    /* detail/story/exploration chart */
    const dm = { top: 22, right: 70, bottom: 36, left: 46 };
    const dH = 290;
    const getDW = () => Math.max(300, Math.min(960, Math.round(document.querySelector("#detail-chart").clientWidth || 960)));
    const dsvg = d3.select("#detail-chart").append("svg").attr("role", "group");
    const dg = dsvg.append("g");
    const dl = {
      gridG: dg.append("g").attr("class", "grid-x"), area: dg.append("path").attr("class", "gap-area"),
      axisX: dg.append("g").attr("class", "axis"), axisY: dg.append("g").attr("class", "axis"),
      fLine: dg.append("path").attr("class", "line-f"), mLine: dg.append("path").attr("class", "line-m"),
      marks: dg.append("g"), cross: dg.append("g").attr("class", "crosshair"),
      yLabel: dg.append("text").attr("class", "axis-label"),
      overlay: dg.append("rect").attr("class", "overlay"),
    };
    const dY = d3.scaleLinear().domain([30, 90]);
    let dX, dIW, dIH;

    function drawDetail() {
      const W = getDW();
      dIW = W - dm.left - dm.right; dIH = dH - dm.top - dm.bottom;
      dX = d3.scaleLinear().domain([MIN_YEAR, MAX_YEAR]).range([0, dIW]);
      dY.range([dIH, 0]);
      dsvg.attr("viewBox", `0 0 ${W} ${dH}`);
      dg.attr("transform", `translate(${dm.left},${dm.top})`);

      const s = series.get(state.selected);
      const name = nameOf(state.selected);
      dsvg.attr("aria-label", `Line chart of female and male life expectancy in ${name}, ${MIN_YEAR} to ${MAX_YEAR}`);

      dl.gridG.call(d3.axisLeft(dY).ticks(6).tickSize(-dIW).tickFormat(""));
      dl.axisX.attr("transform", `translate(0,${dIH})`).call(d3.axisBottom(dX).ticks(W < 560 ? 5 : 10).tickFormat(d3.format("d")));
      dl.axisY.call(d3.axisLeft(dY).ticks(6));
      dl.yLabel.attr("transform", "rotate(-90)").attr("x", -dIH / 2).attr("y", -dm.left + 12)
        .attr("text-anchor", "middle").text("Life expectancy at birth (years)");

      const lineF = d3.line().x((d) => dX(d.year)).y((d) => dY(d.life_exp_female));
      const lineM = d3.line().x((d) => dX(d.year)).y((d) => dY(d.life_exp_male));
      dl.area.attr("d", d3.area().x((d) => dX(d.year)).y0((d) => dY(d.life_exp_male)).y1((d) => dY(d.life_exp_female))(s));
      dl.fLine.attr("d", lineF(s)); dl.mLine.attr("d", lineM(s));

      // direct labels at the right end of each line
      const last = s[s.length - 1];
      let yF = dY(last.life_exp_female), yM = dY(last.life_exp_male);
      if (Math.abs(yF - yM) < 15) {
        const mid = (yF + yM) / 2, up = yF < yM ? -1 : 1;
        yF = mid + up * 7.5; yM = mid - up * 7.5;
      }
      dl.marks.selectAll("text.end-label").data([
        { t: "Women", y: yF, c: COLORS.female },
        { t: "Men", y: yM, c: COLORS.male },
      ]).join("text").attr("class", "end-label")
        .attr("x", dIW + 8).attr("y", (d) => d.y).attr("dy", "0.34em").attr("fill", (d) => d.c).text((d) => d.t);

      dl.overlay.attr("width", dIW).attr("height", dIH);
      drawDetailMarks();
    }

    function drawDetailMarks() {
      const s = series.get(state.selected);
      const get = (y) => atYear.get(state.selected).get(y);
      const pts = [
        { y: state.from, cls: "from" },
        ...(state.to !== state.from ? [{ y: state.to, cls: "to" }] : []),
      ];

      const vl = dl.marks.selectAll("line.year-mark").data(pts, (d) => d.cls).join("line")
        .attr("class", (d) => `year-mark ${d.cls}`)
        .attr("x1", (d) => dX(d.y)).attr("x2", (d) => dX(d.y)).attr("y1", 0).attr("y2", dIH);

      const tl = dl.marks.selectAll("text.year-mark-label").data(pts, (d) => d.cls).join("text")
        .attr("class", "year-mark-label").attr("y", -7).attr("text-anchor", "middle")
        .attr("x", (d) => dX(d.y)).text((d) => d.y);

      const dots = pts.flatMap((p) => [
        { k: p.cls + "f", x: dX(p.y), y: dY(get(p.y).life_exp_female), c: COLORS.female, open: p.cls === "from" },
        { k: p.cls + "m", x: dX(p.y), y: dY(get(p.y).life_exp_male), c: COLORS.male, open: p.cls === "from" },
      ]);
      dl.marks.selectAll("circle.mark-dot").data(dots, (d) => d.k).join("circle")
        .attr("class", "mark-dot").attr("r", 5).attr("cx", (d) => d.x).attr("cy", (d) => d.y)
        .attr("stroke", (d) => d.c).attr("stroke-width", 2).attr("fill", (d) => (d.open ? "#fff" : d.c));

      // readout above the chart
      const a = get(state.from), b = get(state.to), name = nameOf(state.selected);
      d3.select("#detail-title").text(`Explore Further: ${name}`);
      d3.select("#detail-sub").html(
        state.from === state.to
          ? `In <strong>${state.to}</strong>, women lived <strong>${fmt1(b.life_exp_female)}</strong> years and men <strong>${fmt1(b.life_exp_male)}</strong> — a gap of <strong>${signed(b.gap)}</strong> years.`
          : `In <strong>${state.from}</strong> the gap between women's and men's ages was <strong>${signed(a.gap)}</strong> years; in <strong>${state.to}</strong> it was <strong>${signed(b.gap)}</strong> ` +
            `(women ${fmt1(b.life_exp_female)}, men ${fmt1(b.life_exp_male)}). The shaded band is the gap.`
      );
      countrySel.property("value", state.selected);
    }

    // crosshair & click/drag to set the "end" year
    function yearFromEvent(event) {
      const [px] = d3.pointer(event, dl.overlay.node());
      return Math.max(MIN_YEAR, Math.min(MAX_YEAR, Math.round(dX.invert(px))));
    }
    function showCross(year) {
      const r = atYear.get(state.selected).get(year);
      dl.cross.html("");
      dl.cross.append("line").attr("x1", dX(year)).attr("x2", dX(year)).attr("y1", 0).attr("y2", dIH);
      // sex with higher life expectancy listed on top based on selected hover year
      [[r.life_exp_female, COLORS.female, "Women"], [r.life_exp_male, COLORS.male, "Men"]]
        .sort((p, q) => d3.descending(p[0], q[0]))
        .forEach(([v, c, who], i) => {
          dl.cross.append("circle").attr("cx", dX(year)).attr("cy", dY(v)).attr("r", 4).attr("fill", c);
          const flip = dX(year) > dIW - 120;
          dl.cross.append("text").attr("class", "halo").attr("x", dX(year) + (flip ? -9 : 9)).attr("y", dY(v) + (i === 0 ? -9 : 15))
            .attr("text-anchor", flip ? "end" : "start").text(`${year}: ${who} ${fmt1(v)}`);
        });
    }
    dl.overlay
      .on("pointermove", (event) => {
        const y = yearFromEvent(event);
        showCross(y);
        if (event.buttons === 1) setTo(y, 90);
      })
      .on("pointerleave", () => dl.cross.html(""))
      .on("pointerdown", (event) => {
        event.target.setPointerCapture && event.target.setPointerCapture(event.pointerId);
        setTo(yearFromEvent(event), 90);
      });

    /* rendering and controls */
    function render(dur) {
      const rows = rowsFor(state.from, state.to);
      const L = layout();
      view.L = L;
      drawFrame(L);
      const pos = drawRows(rows, L, dur);
      drawNotes(rows, L, pos);

      writeText(rows);
      writeStory(rows);
      d3.select(".lg-from").text(state.from);
      d3.select(".lg-to").text(state.to);

      fromInput.property("value", state.from); toInput.property("value", state.to);
      fromOut.text(state.from); toOut.text(state.to);
      sortSel.property("value", state.sort);
      d3.selectAll(".stories .chip").classed("active", function () { return this.dataset.story === state.story; })
        .attr("aria-pressed", function () { return String(this.dataset.story === state.story); });
      drawDetailMarks();
    }

    function selectCountry(code) {
      state.selected = code;
      drawDetail();
      render(0);
      d3.select("#detail-chart").node().closest(".detail").classList.add("flash");
      setTimeout(() => d3.select(".detail").classed("flash", false), 700);
    }

    function setTo(year, dur) {
      stopPlay();
      state.to = Math.max(MIN_YEAR, Math.min(MAX_YEAR, year));
      if (state.to < state.from) state.from = state.to;
      render(dur === undefined ? 150 : dur);
    }

    fromInput.on("input", function () {
      stopPlay();
      state.from = +this.value;
      if (state.from > state.to) state.to = state.from;
      render(120);
    });
    toInput.on("input", function () { setTo(+this.value, 120); });
    sortSel.on("change", function () { state.sort = this.value; render(700); });
    countrySel.on("change", function () { selectCountry(this.value); });

    /* play button */
    function startPlay() {
      if (state.to >= MAX_YEAR) { state.to = state.from; }
      state.playing = true;
      playBtn.text("❚❚ Pause").attr("aria-pressed", "true");
      d3.select("#story-text").attr("aria-live", "off");
      render(0);
      timer = d3.interval(() => {
        if (state.to >= MAX_YEAR) { stopPlay(); return; }
        state.to += 1;
        render(380);
        if (state.to >= MAX_YEAR) stopPlay();
      }, 420);
    }
    function stopPlay() {
      const was = state.playing;
      state.playing = false;
      if (timer) { timer.stop(); timer = null; }
      playBtn.text("▶ Play").attr("aria-pressed", "false");
      d3.select("#story-text").attr("aria-live", "polite");
      if (was) render(0);
    }
    playBtn.on("click", () => (state.playing ? stopPlay() : startPlay()));

    /* story */
    d3.selectAll(".stories .chip").on("click", function () {
      const key = this.dataset.story, spec = STORIES[key];
      stopPlay();
      state.story = key;
      state.from = spec.from; state.to = spec.to;
      state.highlight = new Set(spec.highlight);
      state.selected = spec.select;
      drawDetail();
      render(900);
    });

    /* resizing */
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { drawDetail(); render(0); }, 120);
    });
    drawDetail();
    render(0);

    // console debug
    window.figure1 = { state, render, rowsFor, series };
  }
})();