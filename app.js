(function () {
    const CFG = window.APP_CONFIG || {};
    mapboxgl.accessToken = CFG.mapboxToken;
    const MAP_STYLE = CFG.mapStyle || "mapbox://styles/lynnstahl/cmhc3o1h5004q01qu3snzehqi";
    const SOURCE_ID = "composite";
    const SOURCE_LAYER = "albersusa";
    const COUNTY_ID_PROP = "county_fips";
    const LOOKUP_URL = CFG.countyLookupUrl || "snap_households_county_2020_2024.json";

    let allData = {};      // store all years from JSON
    let currentYear = 2024;

    const COLORS = ["#e0938d", "#d06f68", "#bb4f47", "#a73f37", "#8e342e"];

    const map = new mapboxgl.Map({
        container: "map",
        style: MAP_STYLE,
        center: [0, 0],
        zoom: 5,
        minZoom: 3,
        maxZoom: 12,
        renderWorldCopies: false
    });


    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: "imperial" }));
    window.addEventListener("resize", () => map.resize());

    async function getFipsList(year) {
        const data = allData[String(year)] || {};
        return Object.entries(data)
            .filter(([, v]) => Number.isFinite(v) && v > 0)
            .map(([fips, val]) => ({ fips: fips.padStart(5, "0"), value: val }));
    }

    function updateLegend(values, colors) {
        const legend = document.querySelector("#legend .swatches");
        if (!legend) return;
        legend.innerHTML = "";

        // Compute log10 stops
        const logVals = values.map(v => Math.log10(v));
        const min = Math.min(...logVals);
        const max = Math.max(...logVals);
        const step = (max - min) / (colors.length - 1);

        for (let i = 0; i < colors.length; i++) {
            const lower = Math.pow(10, min + step * i);
            const upper = Math.pow(10, min + step * (i + 1));
            const label =
                i === colors.length - 1
                    ? `>${Math.round(lower).toLocaleString()}`
                    : `${Math.round(lower).toLocaleString()}–${Math.round(upper).toLocaleString()}`;

            const sw = document.createElement("div");
            sw.className = "swatch";
            sw.innerHTML = `
      <div class="color-box" style="background:${colors[i]}"></div>
      <div class="label">${label}</div>`;
            legend.appendChild(sw);
        }
    }


    // Create a Mapbox expression for color based on log scale
    function buildColorExpression(fipsList) {
        const values = fipsList.map(d => d.value);
        const logValues = values.map(v => Math.log10(v));
        const min = Math.min(...logValues);
        const max = Math.max(...logValues);
        const step = (max - min) / (COLORS.length - 1);

        const stops = [];
        for (let i = 0; i < COLORS.length; i++) {
            stops.push(min + step * i, COLORS[i]);
        }

        console.log("[SNAP] Color scale log10 min:", min.toFixed(2), "max:", max.toFixed(2));

        // Match expression: join county_fips → color by value
        const match = ["match", ["slice", ["concat", ["to-string", ["get", COUNTY_ID_PROP]]], -5]];
        fipsList.forEach(d => {
            const v = Math.log10(d.value);
            const idx = Math.min(
                COLORS.length - 1,
                Math.floor((v - min) / (step || 1e-6))
            );
            match.push(d.fips, COLORS[idx]);
        });
        match.push("#ccc"); // fallback
        updateLegend(values, COLORS);

        return match;
    }

    async function updateYear(year) {
        currentYear = year;
        const fipsList = await getFipsList(year);
        console.log(`[SNAP] Updating to FY${year}, ${fipsList.length} counties`);

        const filter = [
            "in",
            ["slice", ["concat", ["to-string", ["get", COUNTY_ID_PROP]]], -5],
            ["literal", fipsList.map(d => d.fips)]
        ];

        const colorExpr = buildColorExpression(fipsList);

        if (map.getLayer("snap-counties-fill")) {
            map.setFilter("snap-counties-fill", filter);
            map.setPaintProperty("snap-counties-fill", "fill-color", colorExpr);
        }

        // update button states
        document.querySelectorAll("#year-controls button").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.year === String(year));
        });
    }


    map.on("load", async () => {
        const res = await fetch(LOOKUP_URL);
        if (!res.ok) throw new Error(`Failed to fetch ${LOOKUP_URL}`);
        allData = await res.json();
        const years = Object.keys(allData).map(Number).sort();
        currentYear = years[years.length - 1];

        const fipsList = await getFipsList(currentYear);
        const filter = [
            "in",
            ["slice", ["concat", ["to-string", ["get", COUNTY_ID_PROP]]], -5],
            ["literal", fipsList.map(d => d.fips)]
        ];

        const colorExpr = buildColorExpression(fipsList);

        const beforeId = map.getLayer("county-boundaries") ? "county-boundaries" : undefined;
        map.addLayer(
            {
                id: "snap-counties-fill",
                type: "fill",
                source: SOURCE_ID,
                "source-layer": SOURCE_LAYER,
                filter,
                paint: { "fill-color": colorExpr, "fill-opacity": 0.85 }
            },
            beforeId
        );

        // Attach year-toggle handlers
        document.querySelectorAll("#year-controls button").forEach(btn => {
            btn.addEventListener("click", () => updateYear(btn.dataset.year));
        });

        console.log("[SNAP] Map ready, initial year:", currentYear);
    });
})();