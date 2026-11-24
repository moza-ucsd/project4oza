/*
==================================================
LOAD SHARED DATA
==================================================

Visuals 1 and 2 currently use merged_data.csv.

Teammates may:
1. Use cleanData if their visual needs the same data.
2. Load another CSV inside their own visual section.
*/

/*
==================================================
LOAD DASHBOARD DATA
==================================================
*/

Promise.all([
    d3.csv("merged_data.csv"),
    d3.csv("survival_65.csv")
]).then(([data, survivalData]) => {

    /*
    ==============================================
    CLEAN MERGED DATA
    Used by Visuals 1 and 2
    ==============================================
    */

    data.forEach(d => {
        d.Year = +d.Year;
        d.female_life_expectancy =
            +d.female_life_expectancy;
        d.male_life_expectancy =
            +d.male_life_expectancy;
        d.population_65_plus =
            +d.population_65_plus;

        d.life_expectancy_gap =
            d.female_life_expectancy -
            d.male_life_expectancy;
    });


    const cleanData = data.filter(d =>
        Number.isFinite(d.Year) &&
        Number.isFinite(d.female_life_expectancy) &&
        Number.isFinite(d.male_life_expectancy) &&
        Number.isFinite(d.population_65_plus)
    );


    /*
    ==============================================
    CLEAN SURVIVAL-TO-65 DATA
    Used by Visual 3
    ==============================================
    */

    survivalData.forEach(d => {
        d.Year = +d.Year;

        d.female_survival_65 =
            +d.female_survival_65;

        d.male_survival_65 =
            +d.male_survival_65;

        d.survival_gap =
            d.female_survival_65 -
            d.male_survival_65;
    });


    const cleanSurvivalData =
        survivalData.filter(d =>
            Number.isFinite(d.Year) &&
            Number.isFinite(d.female_survival_65) &&
            Number.isFinite(d.male_survival_65) &&
            Number.isFinite(d.survival_gap)
        );


    /*
    ==============================================
    SHARED YEARS

    Use years available in both datasets.
    ==============================================
    */

    const mergedYears = new Set(
        cleanData.map(d => d.Year)
    );

    const survivalYears = new Set(
        cleanSurvivalData.map(d => d.Year)
    );


    const availableYears = Array.from(
        mergedYears
    )
        .filter(year =>
            survivalYears.has(year)
        )
        .sort((a, b) => a - b);


    const minimumYear =
        d3.min(availableYears);

    const maximumYear =
        d3.max(availableYears);


    let selectedYear =
        availableYears.includes(2019)
            ? 2019
            : maximumYear;

    let selectedGender = "both";

    let animationTimer = null;


    /*
    ==============================================
    SHARED HTML CONTROLS
    ==============================================
    */

    const slider =
        d3.select("#year-slider");

    const selectedYearText =
        d3.select("#selected-year");

    const playButton =
        d3.select("#play-button");

    const tooltip =
        d3.select("#tooltip");

    const genderButtons =
        d3.selectAll(".gender-button");


    slider
        .attr("min", minimumYear)
        .attr("max", maximumYear)
        .property("value", selectedYear);


    d3.select("#minimum-year")
        .text(minimumYear);

    d3.select("#maximum-year")
        .text(maximumYear);

    selectedYearText
        .text(selectedYear);


    /*
    ==============================================
    TOOLTIP FOR VISUALS 1 AND 2
    ==============================================
    */

    function showTooltip(event, d, type) {

        let selectedMark;

        if (type === "female") {
            selectedMark = "Female";
        }

        else if (type === "male") {
            selectedMark = "Male";
        }

        else {
            selectedMark = "Life expectancy gap";
        }


        tooltip
            .style("display", "block")
            .style(
                "left",
                `${event.pageX + 16}px`
            )
            .style(
                "top",
                `${event.pageY - 30}px`
            )
            .html(`
                <div class="tooltip-title">
                    ${d["Country Name"]}
                    (${d["Country Code"]})
                </div>

                <div>
                    <strong>Year:</strong>
                    ${d.Year}
                </div>

                <div>
                    <strong>Female:</strong>
                    ${d3.format(".1f")(
                        d.female_life_expectancy
                    )} years
                </div>

                <div>
                    <strong>Male:</strong>
                    ${d3.format(".1f")(
                        d.male_life_expectancy
                    )} years
                </div>

                <div>
                    <strong>Female − male:</strong>
                    ${d3.format("+.1f")(
                        d.life_expectancy_gap
                    )} years
                </div>

                <div>
                    <strong>Population age 65+:</strong>
                    ${d3.format(".1f")(
                        d.population_65_plus
                    )}%
                </div>

                <div>
                    <strong>Selected:</strong>
                    ${selectedMark}
                </div>
            `);
    }


    /*
    ==============================================
    TOOLTIP FOR VISUAL 3
    ==============================================
    */

    function showSurvivalTooltip(event, d) {

        const comparison =
            d.survival_gap > 0
                ? "Higher female survival"
                : d.survival_gap < 0
                    ? "Higher male survival"
                    : "Equal survival";


        tooltip
            .style("display", "block")
            .style(
                "left",
                `${event.pageX + 16}px`
            )
            .style(
                "top",
                `${event.pageY - 30}px`
            )
            .html(`
                <div class="tooltip-title">
                    ${d["Country Name"]}
                    (${d["Country Code"]})
                </div>

                <div>
                    <strong>Year:</strong>
                    ${d.Year}
                </div>

                <div>
                    <strong>Female survival to 65:</strong>
                    ${d3.format(".1f")(
                        d.female_survival_65
                    )}%
                </div>

                <div>
                    <strong>Male survival to 65:</strong>
                    ${d3.format(".1f")(
                        d.male_survival_65
                    )}%
                </div>

                <div>
                    <strong>Female − male:</strong>
                    ${d3.format("+.1f")(
                        d.survival_gap
                    )} percentage points
                </div>

                <div>
                    <strong>Comparison:</strong>
                    ${comparison}
                </div>
            `);
    }


    function hideTooltip() {
        tooltip.style(
            "display",
            "none"
        );
    }


    /*
    ==================================================
    VISUAL 1
    LIFE EXPECTANCY VS. POPULATION AGE 65+
    ==================================================
    */

    const v1Width = 700;
    const v1Height = 440;

    const v1Margin = {
        top: 40,
        right: 30,
        bottom: 60,
        left: 75
    };


    const svg = d3.select("#chart")
        .append("svg")
        .attr(
            "viewBox",
            `0 0 ${v1Width} ${v1Height}`
        );


    const xScale = d3.scaleLinear()
        .domain([
            d3.min(
                cleanData,
                d => Math.min(
                    d.female_life_expectancy,
                    d.male_life_expectancy
                )
            ),

            d3.max(
                cleanData,
                d => Math.max(
                    d.female_life_expectancy,
                    d.male_life_expectancy
                )
            )
        ])
        .nice()
        .range([
            v1Margin.left,
            v1Width - v1Margin.right
        ]);


    const yScale = d3.scaleLinear()
        .domain([
            0,

            d3.max(
                cleanData,
                d => d.population_65_plus
            )
        ])
        .nice()
        .range([
            v1Height - v1Margin.bottom,
            v1Margin.top
        ]);


    // Visual 1 grid lines

    svg.append("g")
        .attr(
            "transform",
            `translate(${v1Margin.left}, 0)`
        )
        .call(
            d3.axisLeft(yScale)
                .tickSize(
                    -(
                        v1Width -
                        v1Margin.left -
                        v1Margin.right
                    )
                )
                .tickFormat("")
        )
        .call(grid => {

            grid.select(".domain")
                .remove();

            grid.selectAll("line")
                .attr(
                    "stroke",
                    "#dfe6ee"
                )
                .attr(
                    "stroke-dasharray",
                    "4,4"
                );
        });


    // Visual 1 X-axis

    svg.append("g")
        .attr(
            "transform",
            `translate(
                0,
                ${v1Height - v1Margin.bottom}
            )`
        )
        .call(
            d3.axisBottom(xScale)
                .ticks(8)
        );


    // Visual 1 Y-axis

    svg.append("g")
        .attr(
            "transform",
            `translate(${v1Margin.left}, 0)`
        )
        .call(
            d3.axisLeft(yScale)
                .ticks(8)
                .tickFormat(
                    d => `${d}%`
                )
        );


    // Visual 1 X-axis label

    svg.append("text")
        .attr(
            "class",
            "axis-label"
        )
        .attr(
            "x",
            v1Width / 2
        )
        .attr(
            "y",
            v1Height - 22
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "Life Expectancy at Birth (Years)"
        );


    // Visual 1 Y-axis label

    svg.append("text")
        .attr(
            "class",
            "axis-label v1-y-axis-label"
        )
        .attr(
            "transform",
            "rotate(-90)"
        )
        .attr(
            "x",
            -v1Height / 2
        )
        .attr(
            "y",
            25
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "Population Age 65+ (% of Total Population)"
        );


    const backgroundYear =
        svg.append("text")
            .attr(
                "class",
                "background-year"
            )
            .attr(
                "x",
                v1Width - v1Margin.right
            )
            .attr(
                "y",
                v1Margin.top + 70
            )
            .attr(
                "text-anchor",
                "end"
            );


    /*
    ==============================================
    UPDATE VISUAL 1
    ==============================================
    */

    function updateVisual1(year) {

        const yearData =
            cleanData.filter(
                d => d.Year === year
            );


        backgroundYear.text(year);


        d3.select("#chart-title")
            .text(
                `Female and Male Life Expectancy, ${year}`
            );


        d3.select("#observation-count")
            .text(
                `${yearData.length} observations have complete data for ${year}.`
            );


        /*
        Connecting lines
        */

        svg.selectAll(".comparison-line")
            .data(
                yearData,
                d => d["Country Code"]
            )
            .join("line")
            .attr(
                "class",
                "comparison-line"
            )
            .attr(
                "stroke",
                "#aeb8c7"
            )
            .attr(
                "stroke-width",
                1.5
            )
            .transition()
            .duration(600)
            .attr(
                "x1",
                d => xScale(
                    d.male_life_expectancy
                )
            )
            .attr(
                "x2",
                d => xScale(
                    d.female_life_expectancy
                )
            )
            .attr(
                "y1",
                d => yScale(
                    d.population_65_plus
                )
            )
            .attr(
                "y2",
                d => yScale(
                    d.population_65_plus
                )
            )
            .attr(
                "opacity",
                selectedGender === "both"
                    ? 0.55
                    : 0
            );


        /*
        Male points
        */

        const malePoints =
            svg.selectAll(".male-point")
                .data(
                    yearData,
                    d => d["Country Code"]
                )
                .join("circle")
                .attr(
                    "class",
                    "male-point"
                )
                .attr(
                    "fill",
                    "#3487bd"
                )
                .attr(
                    "stroke",
                    "white"
                )
                .attr(
                    "stroke-width",
                    1.2
                )
                .attr(
                    "r",
                    5
                )
                .style(
                    "pointer-events",
                    selectedGender === "female"
                        ? "none"
                        : "auto"
                );


        malePoints
            .on(
                "mouseenter",
                function(event, d) {

                    d3.select(this)
                        .attr("r", 8);

                    showTooltip(
                        event,
                        d,
                        "male"
                    );
                }
            )
            .on(
                "mousemove",
                function(event, d) {

                    showTooltip(
                        event,
                        d,
                        "male"
                    );
                }
            )
            .on(
                "mouseleave",
                function() {

                    d3.select(this)
                        .attr("r", 5);

                    hideTooltip();
                }
            );


        malePoints
            .transition()
            .duration(600)
            .attr(
                "cx",
                d => xScale(
                    d.male_life_expectancy
                )
            )
            .attr(
                "cy",
                d => yScale(
                    d.population_65_plus
                )
            )
            .attr(
                "opacity",
                selectedGender === "female"
                    ? 0
                    : 0.85
            );


        /*
        Female points
        */

        const femalePoints =
            svg.selectAll(".female-point")
                .data(
                    yearData,
                    d => d["Country Code"]
                )
                .join("circle")
                .attr(
                    "class",
                    "female-point"
                )
                .attr(
                    "fill",
                    "#d35d91"
                )
                .attr(
                    "stroke",
                    "white"
                )
                .attr(
                    "stroke-width",
                    1.2
                )
                .attr(
                    "r",
                    5
                )
                .style(
                    "pointer-events",
                    selectedGender === "male"
                        ? "none"
                        : "auto"
                );


        femalePoints
            .on(
                "mouseenter",
                function(event, d) {

                    d3.select(this)
                        .attr("r", 8);

                    showTooltip(
                        event,
                        d,
                        "female"
                    );
                }
            )
            .on(
                "mousemove",
                function(event, d) {

                    showTooltip(
                        event,
                        d,
                        "female"
                    );
                }
            )
            .on(
                "mouseleave",
                function() {

                    d3.select(this)
                        .attr("r", 5);

                    hideTooltip();
                }
            );


        femalePoints
            .transition()
            .duration(600)
            .attr(
                "cx",
                d => xScale(
                    d.female_life_expectancy
                )
            )
            .attr(
                "cy",
                d => yScale(
                    d.population_65_plus
                )
            )
            .attr(
                "opacity",
                selectedGender === "male"
                    ? 0
                    : 0.85
            );
    }


    /*
    ==================================================
    VISUAL 2
    WHO OUTLIVES WHOM?
    ==================================================

    X = Female life expectancy
    Y = Female − male life-expectancy gap
    */

    const v2Width = 700;
    const v2Height = 650;

    const v2Margin = {
        top: 60,
        right: 45,
        bottom: 85,
        left: 85
    };


    const gapSvg = d3.select("#gap-chart")
        .append("svg")
        .attr(
            "viewBox",
            `0 0 ${v2Width} ${v2Height}`
        );


    const gapXScale = d3.scaleLinear()
        .domain(
            d3.extent(
                cleanData,
                d => d.female_life_expectancy
            )
        )
        .nice()
        .range([
            v2Margin.left,
            v2Width - v2Margin.right
        ]);


    const gapExtent = d3.extent(
        cleanData,
        d => d.life_expectancy_gap
    );


    const gapYMinimum = Math.min(
        gapExtent[0],
        0
    );

    const gapYMaximum = Math.max(
        gapExtent[1],
        0
    );


    const gapYScale = d3.scaleLinear()
        .domain([
            gapYMinimum,
            gapYMaximum
        ])
        .nice()
        .range([
            v2Height - v2Margin.bottom,
            v2Margin.top
        ]);


    // Visual 2 grid lines

    gapSvg.append("g")
        .attr(
            "transform",
            `translate(${v2Margin.left}, 0)`
        )
        .call(
            d3.axisLeft(gapYScale)
                .tickSize(
                    -(
                        v2Width -
                        v2Margin.left -
                        v2Margin.right
                    )
                )
                .tickFormat("")
        )
        .call(grid => {

            grid.select(".domain")
                .remove();

            grid.selectAll("line")
                .attr("stroke", "#e1e7ef")
                .attr(
                    "stroke-dasharray",
                    "3,3"
                );
        });


    // Visual 2 X-axis

    gapSvg.append("g")
        .attr(
            "transform",
            `translate(
                0,
                ${v2Height - v2Margin.bottom}
            )`
        )
        .call(
            d3.axisBottom(gapXScale)
                .ticks(7)
        );


    // Visual 2 Y-axis

    gapSvg.append("g")
        .attr(
            "transform",
            `translate(${v2Margin.left}, 0)`
        )
        .call(
            d3.axisLeft(gapYScale)
                .ticks(8)
        );


    // Visual 2 X-axis label

    gapSvg.append("text")
        .attr("class", "axis-label")
        .attr(
            "x",
            v2Width / 2
        )
        .attr(
            "y",
            v2Height - 25
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "Female Life Expectancy at Birth (Years)"
        );


    // Visual 2 Y-axis label

    gapSvg.append("text")
        .attr("class", "axis-label")
        .attr(
            "transform",
            "rotate(-90)"
        )
        .attr(
            "x",
            -v2Height / 2
        )
        .attr(
            "y",
            22
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "Female − Male Life Expectancy (Years)"
        );


    // Visual 2 zero line

    gapSvg.append("line")
        .attr(
            "class",
            "gap-zero-line"
        )
        .attr(
            "x1",
            v2Margin.left
        )
        .attr(
            "x2",
            v2Width - v2Margin.right
        )
        .attr(
            "y1",
            gapYScale(0)
        )
        .attr(
            "y2",
            gapYScale(0)
        );


    gapSvg.append("text")
        .attr(
            "class",
            "gap-explanation"
        )
        .attr(
            "x",
            v2Margin.left + 10
        )
        .attr(
            "y",
            gapYScale(0) - 10
        )
        .text(
            "Above: females outlive males"
        );


    gapSvg.append("text")
        .attr(
            "class",
            "gap-explanation"
        )
        .attr(
            "x",
            v2Margin.left + 10
        )
        .attr(
            "y",
            gapYScale(0) + 20
        )
        .text(
            "Below: males outlive females"
        );


    const gapBackgroundYear =
        gapSvg.append("text")
            .attr(
                "class",
                "background-year"
            )
            .attr(
                "x",
                v2Width - v2Margin.right
            )
            .attr(
                "y",
                v2Height -
                    v2Margin.bottom -
                    25
            )
            .attr(
                "text-anchor",
                "end"
            );


    /*
    ==============================================
    UPDATE VISUAL 2
    ==============================================
    */

    function updateVisual2(year) {

        const gapData = cleanData.filter(
            d => d.Year === year
        );


        d3.select("#gap-chart-title")
            .text(
                `Who Outlives Whom? ${year}`
            );


        gapBackgroundYear.text(year);


        const largestGap = d3.greatest(
            gapData,
            d => Math.abs(
                d.life_expectancy_gap
            )
        );


        if (largestGap) {

            d3.select("#largest-gap-value")
                .text(
                    `${d3.format("+.1f")(
                        largestGap.life_expectancy_gap
                    )} years`
                );


            const direction =
                largestGap.life_expectancy_gap >= 0
                    ? "females live longer"
                    : "males live longer";


            d3.select("#largest-gap-country")
                .text(
                    `${largestGap["Country Name"]}: ${direction}`
                );
        }


        const circles = gapSvg
            .selectAll(".gap-point")
            .data(
                gapData,
                d => d["Country Code"]
            );


        circles.exit()
            .transition()
            .duration(300)
            .attr("r", 0)
            .attr("opacity", 0)
            .remove();


        const newCircles = circles.enter()
            .append("circle")
            .attr(
                "class",
                "gap-point"
            )
            .attr(
                "cx",
                d => gapXScale(
                    d.female_life_expectancy
                )
            )
            .attr(
                "cy",
                d => gapYScale(
                    d.life_expectancy_gap
                )
            )
            .attr("r", 0)
            .attr(
                "stroke",
                "white"
            )
            .attr(
                "stroke-width",
                1.2
            );


        circles
            .merge(newCircles)

            .on(
                "mouseenter",
                function(event, d) {

                    d3.select(this)
                        .interrupt()
                        .attr("r", 9)
                        .attr(
                            "stroke",
                            "#243047"
                        )
                        .attr(
                            "stroke-width",
                            2
                        )
                        .attr(
                            "opacity",
                            1
                        );

                    showTooltip(
                        event,
                        d,
                        "gap"
                    );
                }
            )

            .on(
                "mousemove",
                function(event, d) {

                    showTooltip(
                        event,
                        d,
                        "gap"
                    );
                }
            )

            .on(
                "mouseleave",
                function() {

                    d3.select(this)
                        .interrupt()
                        .attr("r", 6)
                        .attr(
                            "stroke",
                            "white"
                        )
                        .attr(
                            "stroke-width",
                            1.2
                        )
                        .attr(
                            "opacity",
                            0.75
                        );

                    hideTooltip();
                }
            )

            .transition()
            .duration(650)

            .attr(
                "cx",
                d => gapXScale(
                    d.female_life_expectancy
                )
            )

            .attr(
                "cy",
                d => gapYScale(
                    d.life_expectancy_gap
                )
            )

            .attr("r", 6)

            .attr(
                "fill",
                d =>
                    d.life_expectancy_gap >= 0
                        ? "#d35d91"
                        : "#3487bd"
            )

            .attr(
                "opacity",
                0.75
            );
    }


    /*
    ==================================================
    VISUAL 3
    WHO MAKES IT TO 65?
    ==================================================

    X = Male survival to age 65
    Y = Female survival to age 65

    Each circle represents one country.
    */

    const v3Width = 700;
    const v3Height = 650;

    const v3Margin = {
        top: 60,
        right: 45,
        bottom: 85,
        left: 85
    };


    const survivalSvg =
        d3.select("#survival-chart")
            .append("svg")
            .attr(
                "viewBox",
                `0 0 ${v3Width} ${v3Height}`
            );


    const survivalMinimum = d3.min(
        cleanSurvivalData,
        d => Math.min(
            d.male_survival_65,
            d.female_survival_65
        )
    );


    const survivalMaximum = d3.max(
        cleanSurvivalData,
        d => Math.max(
            d.male_survival_65,
            d.female_survival_65
        )
    );


    const survivalPadding = 2;


    const paddedMinimum = Math.max(
        0,
        survivalMinimum - survivalPadding
    );


    const paddedMaximum = Math.min(
        100,
        survivalMaximum + survivalPadding
    );


    // Visual 3 X scale

    const survivalXScale = d3.scaleLinear()
        .domain([
            paddedMinimum,
            paddedMaximum
        ])
        .nice()
        .range([
            v3Margin.left,
            v3Width - v3Margin.right
        ]);


    // Visual 3 Y scale

    const survivalYScale = d3.scaleLinear()
        .domain(
            survivalXScale.domain()
        )
        .range([
            v3Height - v3Margin.bottom,
            v3Margin.top
        ]);


    // Visual 3 color scale

    const survivalColorScale =
        d3.scaleSequential()
            .domain(
                d3.extent(
                    cleanSurvivalData,
                    d => d.survival_gap
                )
            )
            .interpolator(
                d3.interpolateViridis
            );


    // Visual 3 grid lines

    survivalSvg.append("g")
        .attr(
            "transform",
            `translate(${v3Margin.left}, 0)`
        )
        .call(
            d3.axisLeft(survivalYScale)
                .ticks(7)
                .tickSize(
                    -(
                        v3Width -
                        v3Margin.left -
                        v3Margin.right
                    )
                )
                .tickFormat("")
        )
        .call(grid => {

            grid.select(".domain")
                .remove();

            grid.selectAll("line")
                .attr(
                    "stroke",
                    "#e1e7ef"
                )
                .attr(
                    "stroke-dasharray",
                    "3,3"
                );
        });


    // Visual 3 X-axis

    survivalSvg.append("g")
        .attr(
            "transform",
            `translate(
                0,
                ${v3Height - v3Margin.bottom}
            )`
        )
        .call(
            d3.axisBottom(
                survivalXScale
            )
                .ticks(7)
                .tickFormat(
                    d => `${d}%`
                )
        );


    // Visual 3 Y-axis

    survivalSvg.append("g")
        .attr(
            "transform",
            `translate(${v3Margin.left}, 0)`
        )
        .call(
            d3.axisLeft(
                survivalYScale
            )
                .ticks(7)
                .tickFormat(
                    d => `${d}%`
                )
        );


    // Visual 3 X-axis label

    survivalSvg.append("text")
        .attr(
            "class",
            "axis-label"
        )
        .attr(
            "x",
            v3Width / 2
        )
        .attr(
            "y",
            v3Height - 25
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "Male Survival to Age 65 (% of Cohort)"
        );


    // Visual 3 Y-axis label

    survivalSvg.append("text")
        .attr(
            "class",
            "axis-label"
        )
        .attr(
            "transform",
            "rotate(-90)"
        )
        .attr(
            "x",
            -v3Height / 2
        )
        .attr(
            "y",
            22
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "Female Survival to Age 65 (% of Cohort)"
        );


    /*
    Equality line:
    female survival = male survival
    */

    const survivalDomain =
        survivalXScale.domain();


    survivalSvg.append("line")
        .attr(
            "class",
            "survival-equality-line"
        )
        .attr(
            "x1",
            survivalXScale(
                survivalDomain[0]
            )
        )
        .attr(
            "y1",
            survivalYScale(
                survivalDomain[0]
            )
        )
        .attr(
            "x2",
            survivalXScale(
                survivalDomain[1]
            )
        )
        .attr(
            "y2",
            survivalYScale(
                survivalDomain[1]
            )
        );


    survivalSvg.append("text")
        .attr(
            "class",
            "survival-explanation"
        )
        .attr(
            "x",
            survivalXScale(
                survivalDomain[0]
            ) + 12
        )
        .attr(
            "y",
            survivalYScale(
                survivalDomain[0]
            ) - 10
        )
        .text(
            "Dashed line: equal survival"
        );


    const survivalBackgroundYear =
        survivalSvg.append("text")
            .attr(
                "class",
                "background-year"
            )
            .attr(
                "x",
                v3Width - v3Margin.right
            )
            .attr(
                "y",
                v3Margin.top + 70
            )
            .attr(
                "text-anchor",
                "end"
            );


    /*
    ==============================================
    UPDATE VISUAL 3
    ==============================================
    */

    function updateVisual3(year) {

        const yearData =
            cleanSurvivalData.filter(
                d => d.Year === year
            );


        d3.select(
            "#survival-chart-title"
        )
            .text(
                `Who Makes It to 65? ${year}`
            );


        survivalBackgroundYear
            .text(year);


        /*
        Largest absolute survival gap
        */

        const largestSurvivalGap =
            d3.greatest(
                yearData,
                d => Math.abs(
                    d.survival_gap
                )
            );


        if (largestSurvivalGap) {

            d3.select(
                "#largest-survival-gap"
            )
                .text(
                    `${d3.format(".1f")(
                        Math.abs(
                            largestSurvivalGap
                                .survival_gap
                        )
                    )} points`
                );


            const direction =
                largestSurvivalGap.survival_gap > 0
                    ? "higher female survival"
                    : largestSurvivalGap.survival_gap < 0
                        ? "higher male survival"
                        : "equal survival";


            d3.select(
                "#largest-survival-country"
            )
                .text(
                    `${
                        largestSurvivalGap[
                            "Country Name"
                        ]
                    }: ${direction}`
                );
        }

        else {

            d3.select(
                "#largest-survival-gap"
            )
                .text("—");


            d3.select(
                "#largest-survival-country"
            )
                .text(
                    `No complete survival data for ${year}`
                );
        }


        /*
        Join the selected year's countries.
        */

        const survivalPoints =
            survivalSvg
                .selectAll(
                    ".survival-point"
                )
                .data(
                    yearData,
                    d => d["Country Code"]
                );


        survivalPoints.exit()
            .transition()
            .duration(300)
            .attr("r", 0)
            .attr("opacity", 0)
            .remove();


        const newSurvivalPoints =
            survivalPoints.enter()
                .append("circle")
                .attr(
                    "class",
                    "survival-point"
                )
                .attr(
                    "cx",
                    d => survivalXScale(
                        d.male_survival_65
                    )
                )
                .attr(
                    "cy",
                    d => survivalYScale(
                        d.female_survival_65
                    )
                )
                .attr("r", 0)
                .attr(
                    "stroke",
                    "white"
                )
                .attr(
                    "stroke-width",
                    1.2
                );


        survivalPoints
            .merge(
                newSurvivalPoints
            )

            .on(
                "mouseenter",
                function(event, d) {

                    /*
                    Fade all other points.
                    */

                    survivalSvg
                        .selectAll(
                            ".survival-point"
                        )
                        .attr(
                            "opacity",
                            0.2
                        );


                    /*
                    Highlight hovered point.
                    */

                    d3.select(this)
                        .interrupt()
                        .attr("r", 9)
                        .attr(
                            "stroke",
                            "#243047"
                        )
                        .attr(
                            "stroke-width",
                            2
                        )
                        .attr(
                            "opacity",
                            1
                        )
                        .raise();


                    showSurvivalTooltip(
                        event,
                        d
                    );
                }
            )

            .on(
                "mousemove",
                function(event, d) {

                    showSurvivalTooltip(
                        event,
                        d
                    );
                }
            )

            .on(
                "mouseleave",
                function() {

                    survivalSvg
                        .selectAll(
                            ".survival-point"
                        )
                        .attr(
                            "opacity",
                            0.78
                        );


                    d3.select(this)
                        .interrupt()
                        .attr("r", 6)
                        .attr(
                            "stroke",
                            "white"
                        )
                        .attr(
                            "stroke-width",
                            1.2
                        );


                    hideTooltip();
                }
            )

            .transition()
            .duration(650)

            // X = male survival

            .attr(
                "cx",
                d => survivalXScale(
                    d.male_survival_65
                )
            )

            // Y = female survival

            .attr(
                "cy",
                d => survivalYScale(
                    d.female_survival_65
                )
            )

            // Color = survival gap

            .attr(
                "fill",
                d => survivalColorScale(
                    d.survival_gap
                )
            )

            .attr("r", 6)

            .attr(
                "opacity",
                0.78
            );
    }


    /*
    ==================================================
    VISUAL 4
    TEAMMATE SECTION
    ==================================================
    */

    // TEAMMATE VISUAL 4 CODE HERE


    /*
    ==================================================
    VISUAL 5
    TEAMMATE SECTION
    ==================================================
    */

    // TEAMMATE VISUAL 5 CODE HERE


    /*
    ==================================================
    VISUAL 6
    TEAMMATE SECTION
    ==================================================
    */

    // TEAMMATE VISUAL 6 CODE HERE


    /*
    ==================================================
    MASTER UPDATE FUNCTION
    ==================================================
    */

    function updateDashboard(year) {

        selectedYear = year;


        slider.property(
            "value",
            selectedYear
        );


        selectedYearText.text(
            selectedYear
        );


        // DENNISE VISUAL 1

        updateVisual1(
            selectedYear
        );


        // DENNISE VISUAL 2

        updateVisual2(
            selectedYear
        );


        // TEAM VISUAL 3

        updateVisual3(
            selectedYear
        );
    }


    /*
    ==================================================
    YEAR SLIDER
    ==================================================
    */

    slider.on(
        "input",
        function() {

            const newYear =
                +this.value;


            const nearestYear =
                availableYears.reduce(
                    (
                        nearest,
                        current
                    ) => {

                        return Math.abs(
                            current - newYear
                        ) <
                        Math.abs(
                            nearest - newYear
                        )
                            ? current
                            : nearest;
                    }
                );


            updateDashboard(
                nearestYear
            );
        }
    );


    /*
    ==================================================
    PLAY / PAUSE
    ==================================================
    */

    playButton.on(
        "click",
        function() {

            if (animationTimer !== null) {

                animationTimer.stop();

                animationTimer = null;

                playButton.text(
                    "▶ Play"
                );

                return;
            }


            playButton.text(
                "❚❚ Pause"
            );


            animationTimer =
                d3.interval(() => {

                    const currentIndex =
                        availableYears.indexOf(
                            selectedYear
                        );


                    const nextIndex =
                        currentIndex ===
                        availableYears.length - 1

                            ? 0

                            : currentIndex + 1;


                    updateDashboard(
                        availableYears[
                            nextIndex
                        ]
                    );

                }, 900);
        }
    );


    /*
    ==================================================
    FEMALE / MALE / BOTH BUTTONS

    These control Visual 1 only.
    ==================================================
    */

    genderButtons.on(
        "click",
        function() {

            selectedGender =
                this.dataset.gender;


            genderButtons.classed(
                "active",
                false
            );


            d3.select(this)
                .classed(
                    "active",
                    true
                );


            hideTooltip();


            updateVisual1(
                selectedYear
            );
        }
    );


    /*
    ==================================================
    INITIAL PAGE LOAD
    ==================================================
    */

    updateDashboard(
        selectedYear
    );


}).catch(error => {

    console.error(
        "Dashboard could not load:",
        error
    );


    d3.select(".dashboard")
        .append("p")
        .style(
            "color",
            "#b42318"
        )
        .style(
            "font-weight",
            "bold"
        )
        .text(
            "The dashboard could not load. Check the browser console and confirm merged_data.csv and survival_65.csv are in the project folder."
        );
});