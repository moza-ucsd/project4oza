"use strict";

/* Visual 5 — "Who outlives whom?" (static version, D3 v7 only)

   One dumbbell per country: the gap between female and male life expectancy at birth
   (female minus male, in years) in a start year (open dot) and an end year (filled dot).

   Built so interactivity can be added later without a rewrite:
     - all data work lives in buildRows(start, end); all drawing in draw(start, end)
     - draw() uses keyed data joins, so calling it again with a new end year (e.g. from a
       slider or a scroll step) updates the same marks instead of redrawing the page
     - every mark carries a class and data-code attribute for hover / brushing / linking */

(function () {
  const DATA_URL = "life_expectancy_gap.csv";
  const START = 1960;
  const END = 2019;
  const CHANGE_THRESHOLD = 0.5; // years; smaller moves count as "about the same"

  // Same palette as the CSS variables (female pink, male blue)
  const COLORS = { widened: "#c0508a", narrowed: "#3f7fb3", same: "#8a94a6", ink: "#475569" };

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

  d3.csv(DATA_URL, d3.autoType).then(init).catch((err) => {
    console.error(err);
    d3.select("#error").property("hidden", false);
  });

  function init(data) {
    const featured = data.filter((d) => d.featured === true || d.featured === "True");

    /* ---------- data: one row per country with start and end values ---------- */
    function buildRows(start, end) {
      const byCode = d3.group(featured, (d) => d.code);
      const rows = [];
      byCode.forEach((vals, code) => {
        const a = vals.find((d) => d.year === start);
        const b = vals.find((d) => d.year === end);
        if (!a || !b) return;
        const change = b.gap - a.gap;
        rows.push({
          code, country: b.country, name: label(b.country),
          start: a.gap, end: b.gap, change, population: b.population,
          startF: a.life_exp_female, startM: a.life_exp_male,
          endF: b.life_exp_female, endM: b.life_exp_male,
          kind: change > CHANGE_THRESHOLD ? "widened" : change < -CHANGE_THRESHOLD ? "narrowed" : "same",
        });
      });
      return rows.sort((p, q) => d3.descending(p.end, q.end));
    }

    /* ---------- text generated from the data so it can't drift out of date ---------- */
    function writeText(rows, start, end) {
      const n = rows.length;
      const womenLonger = rows.filter((d) => d.end > 0).length;
      const menStart = rows.filter((d) => d.start < 0);
      const all = womenLonger === n;

      const menTxt = menStart.length === 0 ? ""
        : menStart.length === 1 ? ` — in ${start}, men lived longer in one of them`
        : ` — in ${start}, men lived longer in ${menStart.length} of them`;
      d3.select("#f1-title").text(
        `${all ? "Women now outlive men in all" : `Women now outlive men in ${womenLonger} of`} ${n} of the most populous countries${menTxt}`
      );

      d3.select("#f1-subtitle").text(
        `Each row is one of the ${n} most populous countries (by ${end} population). The dots show the gap between ` +
        `female and male life expectancy at birth (female minus male, in years) in ${start} (open) and ${end} (filled). ` +
        `Regional and income-group aggregates were removed, and countries are sorted by their ${end} gap.`
      );

      const widened = rows.filter((d) => d.kind === "widened").length;
      const narrowed = rows.filter((d) => d.kind === "narrowed").length;
      const same = n - widened - narrowed;
      d3.select("#f1-note").text(
        `Since ${start}, the gap widened by more than ${CHANGE_THRESHOLD} year in ${widened} of these countries, ` +
        `narrowed in ${narrowed}, and changed little in ${same}. ` +
        `Source: World Bank life expectancy at birth by sex. Gap = female minus male, in years.`
      );
    }

    /* ---------- legend ---------- */
    function drawLegend(start, end) {
      const box = d3.select("#legend").html("");
      const item = (text, draw) => {
        const el = box.append("span").attr("class", "legend-item");
        const svg = el.append("svg").attr("width", 34).attr("height", 16);
        draw(svg);
        el.append("span").text(text);
      };
      item(`${start}`, (s) => s.append("circle").attr("cx", 17).attr("cy", 8).attr("r", 5)
        .attr("fill", "#fff").attr("stroke", COLORS.ink).attr("stroke-width", 1.8));
      item(`${end}`, (s) => s.append("circle").attr("cx", 17).attr("cy", 8).attr("r", 5).attr("fill", COLORS.ink));
      [["widened", "Gap widened (women pulled ahead)"],
       ["narrowed", "Gap narrowed (men caught up)"],
       ["same", `About the same (±${CHANGE_THRESHOLD} yr)`]].forEach(([k, t]) =>
        item(t, (s) => s.append("line").attr("x1", 0).attr("x2", 34).attr("y1", 8).attr("y2", 8)
          .attr("stroke", COLORS[k]).attr("stroke-width", 3).attr("stroke-linecap", "round")));
    }

    /* ---------- chart ---------- */
    const rowH = 23;
    const m = { top: 54, right: 24, bottom: 56, left: 118 };
    
    const getW = () => Math.max(300, Math.min(960, Math.round(document.querySelector("#chart").clientWidth || 960)));

    const svg = d3.select("#chart").append("svg")
      .attr("viewBox", `0 0 ${getW()} 100`) // height set in draw()
      .attr("role", "img");
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const layers = {
      zones: g.append("g"), bands: g.append("g"), grid: g.append("g").attr("class", "grid-x"),
      zero: g.append("g"), links: g.append("g"), starts: g.append("g"), ends: g.append("g"),
      labels: g.append("g"), notes: g.append("g"), axis: g.append("g").attr("class", "axis"),
    };

    function draw(start, end) {
      const W = getW();
      const wide = W >= 760; // callouts only when there is room
      const rows = buildRows(start, end);
      const n = rows.length;
      const ml = W < 560 ? 92 : m.left;      // narrower label gutter on phones
      const iw = W - ml - m.right;
      g.attr("transform", `translate(${ml},${m.top})`);
      const ih = n * rowH;
      const H = m.top + ih + m.bottom;

      svg.attr("viewBox", `0 0 ${W} ${H}`)
        .attr("aria-label",
          `Dumbbell chart of the female minus male life expectancy gap in ${start} and ${end} for the ${n} most populous countries`);

      const lo = Math.floor(d3.min(rows, (d) => Math.min(d.start, d.end)) - 1);
      const hi = Math.ceil(d3.max(rows, (d) => Math.max(d.start, d.end)) + (wide ? 2.6 : 1)); // room for callouts
      const x = d3.scaleLinear().domain([lo, hi]).range([0, iw]);
      const y = d3.scaleBand().domain(rows.map((d) => d.code)).range([0, ih]).paddingInner(0);
      const cy = (d) => y(d.code) + y.bandwidth() / 2;

      /* zones: tint either side of "no gap" */
      layers.zones.selectAll("rect").data([
        { cls: "male", x: 0, w: x(0), fill: "#edf4fa" },
        { cls: "female", x: x(0), w: iw - x(0), fill: "#fdf6fa" },
      ]).join("rect").attr("class", (d) => `zone ${d.cls}`)
        .attr("x", (d) => d.x).attr("y", 0).attr("width", (d) => d.w).attr("height", ih).attr("fill", (d) => d.fill);

      /* zebra bands */
      layers.bands.selectAll("rect").data(rows.filter((_, i) => i % 2 === 0), (d) => d.code)
        .join("rect").attr("class", "row-band").attr("x", 0).attr("width", iw)
        .attr("y", (d) => y(d.code)).attr("height", y.bandwidth()).attr("fill", "#0f172a").attr("fill-opacity", 0.025);

      /* vertical grid + axis */
      const tickCount = iw < 420 ? 6 : Math.min(hi - lo, 15);
      const xAxis = d3.axisBottom(x).ticks(tickCount).tickFormat((v) => (v > 0 ? "+" + v : v < 0 ? "−" + Math.abs(v) : "0"));
      layers.grid.attr("transform", `translate(0,${ih})`)
        .call(d3.axisBottom(x).ticks(tickCount).tickSize(-ih).tickFormat(""));
      layers.axis.attr("transform", `translate(0,${ih})`).call(xAxis);
      layers.axis.selectAll(".axis-label").data([0]).join("text").attr("class", "axis-label")
        .attr("x", iw / 2).attr("y", 44).attr("text-anchor", "middle")
        .text("Female − male life expectancy at birth (years)");

      /* zero line + zone captions */
      layers.zero.selectAll("line").data([0]).join("line").attr("class", "zero-line")
        .attr("x1", x(0)).attr("x2", x(0)).attr("y1", -8).attr("y2", ih);
      layers.zero.selectAll("text").data([
        { t: "◄ Men live longer", cls: "m", dx: -8, anchor: "end" },
        { t: "Women live longer ►", cls: "f", dx: 8, anchor: "start" },
      ]).join("text").attr("class", (d) => `zone-label ${d.cls}`)
        .attr("x", (d) => x(0) + d.dx).attr("y", -16).attr("text-anchor", (d) => d.anchor).text((d) => d.t);

      /* connectors (keyed by country so a later year change animates in place) */
      layers.links.selectAll("line").data(rows, (d) => d.code).join("line")
        .attr("class", (d) => `link ${d.kind}`).attr("data-code", (d) => d.code)
        .attr("x1", (d) => x(d.start)).attr("x2", (d) => x(d.end))
        .attr("y1", cy).attr("y2", cy)
        .attr("stroke", (d) => COLORS[d.kind]).attr("stroke-width", 3.2).attr("stroke-linecap", "round")
        .attr("stroke-opacity", 0.85);

      layers.starts.selectAll("circle").data(rows, (d) => d.code).join("circle")
        .attr("class", "dot start").attr("data-code", (d) => d.code)
        .attr("cx", (d) => x(d.start)).attr("cy", cy).attr("r", 5.2)
        .attr("fill", "#fff").attr("stroke", COLORS.ink).attr("stroke-width", 1.8);

      layers.ends.selectAll("circle").data(rows, (d) => d.code).join("circle")
        .attr("class", (d) => `dot end ${d.kind}`).attr("data-code", (d) => d.code)
        .attr("cx", (d) => x(d.end)).attr("cy", cy).attr("r", 5.6)
        .attr("fill", (d) => COLORS[d.kind]).attr("stroke", "#fff").attr("stroke-width", 1.2);

      /* country labels, outside the plot on the left */
      layers.labels.selectAll("text").data(rows, (d) => d.code).join("text")
        .attr("class", "country-label").attr("data-code", (d) => d.code)
        .attr("x", -10).attr("y", cy).attr("dy", "0.34em").text((d) => d.name);

      drawAnnotations(wide ? rows : [], x, cy, start, end);
    }

    /* A few single-line callouts chosen from the data (not hard-coded), each beside the row it describes */
    function drawAnnotations(rows, x, cy, start, end) {
      const pick = [];
      if (rows.length) {
        const top = rows[0];
        pick.push({ row: top, lead: `Largest gap in ${end}:`, rest: ` ${signed(top.end)} yrs` });

        const widest = d3.greatest(rows, (d) => d.change);
        const narrow = d3.least(rows, (d) => d.change);
        const has = (r) => pick.some((p) => p.row === r);

        if (widest && !has(widest))
          pick.push({ row: widest, lead: `Biggest widening: ${signed(widest.change)} yrs`,
            rest: widest.start < 0 ? ` (men led in ${start})` : "" });
        if (narrow && narrow.change < -CHANGE_THRESHOLD && !has(narrow))
          pick.push({ row: narrow, lead: `Biggest narrowing: ${signed(narrow.change)} yrs`, rest: "" });
        rows.filter((d) => d.start < 0).forEach((r) => {
          if (!has(r)) pick.push({ row: r, lead: `Men led in ${start}:`, rest: ` ${signed(r.start)} → ${signed(r.end)}` });
        });
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
        const r = d.row;
        const edge = Math.max(x(r.start), x(r.end));
        const sel = d3.select(this);
        sel.select("line").attr("x1", edge + 8).attr("x2", edge + 15).attr("y1", cy(r)).attr("y2", cy(r));
        sel.select("text").attr("x", edge + 19).attr("y", cy(r)).attr("dy", "0.34em");
        sel.select(".lead").text(d.lead);
        sel.select(".rest").text(d.rest);
      });
    }

    /* ---------- go ---------- */
    const rows0 = buildRows(START, END);
    writeText(rows0, START, END);
    drawLegend(START, END);
    draw(START, END);

    // exposed so an interactive layer (slider, scroll steps, brushing) can reuse the same drawing code
    window.visual5 = { draw, buildRows, data, featured };

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => draw(START, END), 120);
    });
  }
})();