from __future__ import annotations

import io
import json
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st


ROOT = Path(__file__).resolve().parent
COUNTIES = [
    "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu",
    "Garissa", "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho",
    "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale",
    "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit", "Meru",
    "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru", "Nandi", "Narok",
    "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya", "Taita-Taveta",
    "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana", "Uasin Gishu",
    "Vihiga", "Wajir", "West Pokot",
]
ALIASES = {
    "elgeyo/marakwet": "Elgeyo-Marakwet",
    "homabay": "Homa Bay",
    "taita/taveta": "Taita-Taveta",
    "tharaka-nthi": "Tharaka-Nithi",
}
ZONES = {
    "Baringo": "mixed", "Bomet": "highland", "Bungoma": "western",
    "Busia": "western", "Elgeyo-Marakwet": "highland", "Embu": "central",
    "Garissa": "arid", "Homa Bay": "western", "Isiolo": "arid",
    "Kajiado": "arid", "Kakamega": "western", "Kericho": "highland",
    "Kiambu": "central", "Kilifi": "coastal", "Kirinyaga": "central",
    "Kisii": "highland", "Kisumu": "western", "Kitui": "arid",
    "Kwale": "coastal", "Laikipia": "mixed", "Lamu": "coastal",
    "Machakos": "arid", "Makueni": "arid", "Mandera": "arid",
    "Marsabit": "arid", "Meru": "central", "Migori": "western",
    "Mombasa": "coastal", "Murang'a": "central", "Nairobi": "central",
    "Nakuru": "highland", "Nandi": "highland", "Narok": "mixed",
    "Nyamira": "highland", "Nyandarua": "highland", "Nyeri": "central",
    "Samburu": "arid", "Siaya": "western", "Taita-Taveta": "coastal",
    "Tana River": "coastal", "Tharaka-Nithi": "central",
    "Trans Nzoia": "highland", "Turkana": "arid", "Uasin Gishu": "highland",
    "Vihiga": "western", "Wajir": "arid", "West Pokot": "mixed",
}
KMD_BULLETIN = (
    "https://meteo.go.ke/documents/5546/AGROMET_BULLETIN_DEKAD_30_2026.pdf"
)

st.set_page_config(
    page_title="ShambaScope | Kenya maize intelligence",
    page_icon="🌱",
    layout="wide",
    initial_sidebar_state="auto",
)

st.markdown(
    """
    <style>
    :root { --forest: #20583b; --leaf: #75984f; --canvas: #f5f7f2; }
    .stApp { background: var(--canvas); }
    [data-testid="stHeader"] { background: rgba(245,247,242,.88); }
    [data-testid="stSidebar"] { background: #fff; border-right: 1px solid #e8ece5; }
    h1, h2, h3 { letter-spacing: -.035em; }
    .brand { color: var(--forest); font-size: 1.15rem; font-weight: 800; }
    .brand small { display:block; color:#849181; font-size:.62rem; letter-spacing:.16em; }
    .hero { padding: 1.1rem 0 1.6rem; }
    .eyebrow { color:#71885a; font-size:.72rem; font-weight:700; letter-spacing:.14em; }
    .hero p, .subtle { color:#718076; }
    div[data-testid="stMetric"] {
      padding: 1rem 1.1rem; border: 1px solid #e6ebe2; border-radius: 14px;
      background: #fff; box-shadow: 0 5px 18px rgba(37,57,40,.035);
    }
    div[data-testid="stMetricLabel"] { color:#78847b; }
    div[data-testid="stTabs"] button { font-weight:600; }
    .source-note { padding:.85rem 1rem; border-radius:10px; background:#edf3e8;
      color:#586a57; font-size:.85rem; }
    </style>
    """,
    unsafe_allow_html=True,
)


def load_js_records(filename: str, assignment: str) -> pd.DataFrame:
    path = ROOT / filename
    if not path.is_file():
        raise FileNotFoundError(f"Required project data file was not found: {filename}")
    text = path.read_text(encoding="utf-8").strip()
    prefix = f"window.{assignment} = "
    if not text.startswith(prefix):
        raise ValueError(f"{filename} does not contain the expected data assignment.")
    records = json.loads(text[len(prefix):].rstrip(";"))
    return pd.DataFrame.from_records(records)


@st.cache_data
def load_defaults() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    production = load_js_records("production-data.js", "providedProductionRecords")
    rainfall = load_js_records("kmd-rainfall-data.js", "kmdRainfallRecords")
    soil_path = ROOT / "shambaiq-county-soil-reports.csv"
    if not soil_path.is_file():
        raise FileNotFoundError("Required project data file was not found: shambaiq-county-soil-reports.csv")
    soil = pd.read_csv(soil_path)
    return production, rainfall, soil


def normalize_county(value: object) -> str | None:
    name = str(value).strip()
    if not name or name.lower() == "nan":
        return None
    alias = ALIASES.get(name.lower())
    if alias:
        return alias
    return next((county for county in COUNTIES if county.lower() == name.lower()), None)


def read_uploaded_csv(uploaded_file: object) -> pd.DataFrame:
    try:
        return pd.read_csv(io.BytesIO(uploaded_file.getvalue()))
    except (UnicodeDecodeError, pd.errors.ParserError, pd.errors.EmptyDataError) as error:
        raise ValueError(f"Could not read the CSV: {error}") from error


def normalize_headers(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.copy()
    frame.columns = [
        str(column).strip().lower().replace("-", "_").replace(" ", "_")
        for column in frame.columns
    ]
    return frame


def parse_production_upload(uploaded_file: object) -> pd.DataFrame:
    frame = normalize_headers(read_uploaded_csv(uploaded_file))
    production_column = next(
        (column for column in ("production_tonnes", "production", "tonnes") if column in frame),
        None,
    )
    if not {"county", "year"}.issubset(frame.columns) or not production_column:
        raise ValueError("Production CSV needs county, year, and production_tonnes columns.")
    frame["county"] = frame["county"].map(normalize_county)
    frame["year"] = pd.to_numeric(frame["year"], errors="coerce")
    frame["production"] = pd.to_numeric(frame[production_column], errors="coerce")
    valid = (
        frame["county"].notna()
        & frame["year"].notna()
        & frame["year"].between(1900, 2100)
        & (frame["year"] % 1 == 0)
        & frame["production"].notna()
        & (frame["production"] >= 0)
    )
    if not valid.all():
        raise ValueError("Production CSV has an invalid county, year, or production value.")
    result = frame[["county", "year", "production"]].copy()
    result["year"] = result["year"].astype(int)
    if result.duplicated(["county", "year"]).any():
        raise ValueError("Production CSV contains duplicate county/year rows.")
    return result


def parse_rainfall_upload(uploaded_file: object) -> pd.DataFrame:
    frame = normalize_headers(read_uploaded_csv(uploaded_file))
    period_column = "season" if "season" in frame else "period" if "period" in frame else None
    required = {"county", "year", "rainfall_mm"}
    if not required.issubset(frame.columns) or not period_column:
        raise ValueError("Rainfall CSV needs county, year, season (or period), and rainfall_mm columns.")
    frame["county"] = frame["county"].map(normalize_county)
    frame["year"] = pd.to_numeric(frame["year"], errors="coerce")
    frame["rainfall_mm"] = pd.to_numeric(frame["rainfall_mm"], errors="coerce")
    frame["period"] = frame[period_column].fillna("").astype(str).str.strip()
    if (
        frame["county"].isna().any()
        or frame["year"].isna().any()
        or (frame["year"] % 1 != 0).any()
        or frame["rainfall_mm"].isna().any()
        or (frame["rainfall_mm"] < 0).any()
        or frame["period"].eq("").any()
    ):
        raise ValueError("Rainfall CSV has an invalid county, year, period, or rainfall value.")
    return frame


def parse_soil_upload(uploaded_file: object) -> pd.DataFrame:
    frame = normalize_headers(read_uploaded_csv(uploaded_file))
    required = {"county", "ph"}
    if not required.issubset(frame.columns):
        raise ValueError("Soil CSV needs county and ph columns.")
    if not (
        {"nitrogen_status", "phosphorus_status"}.issubset(frame.columns)
        or {"nitrogen_g_kg", "phosphorus_mg_kg"}.issubset(frame.columns)
    ):
        raise ValueError(
            "Soil CSV needs nitrogen_status and phosphorus_status, or nitrogen_g_kg and phosphorus_mg_kg."
        )
    frame["county"] = frame["county"].map(normalize_county)
    if frame["county"].isna().any():
        raise ValueError("Soil CSV contains an unknown county.")
    if "sample_date" in frame:
        dates = pd.to_datetime(frame["sample_date"], errors="coerce")
        if dates.isna().any():
            raise ValueError("Soil sample dates must be valid dates in YYYY-MM-DD format.")
        frame["sample_date"] = dates.dt.strftime("%Y-%m-%d")
    if "ph" in frame:
        ph_values = pd.to_numeric(frame["ph"], errors="coerce")
        present = frame["ph"].notna() & frame["ph"].astype(str).str.strip().ne("")
        if (present & (ph_values.isna() | ~ph_values.between(0, 14))).any():
            raise ValueError("Soil pH must be from 0 to 14 or blank.")
        frame["ph"] = ph_values
    return frame


def county_totals(records: pd.DataFrame, year: int) -> pd.DataFrame:
    totals = records.loc[records["year"] == year].groupby("county")["production"].sum()
    result = pd.DataFrame({"county": COUNTIES})
    result["production"] = result["county"].map(totals).fillna(0)
    return result.sort_values(["production", "county"], ascending=[False, True]).reset_index(drop=True)


def production_history(records: pd.DataFrame) -> pd.DataFrame:
    observed = (
        records.groupby("year", as_index=False)["production"]
        .sum()
        .sort_values("year")
    )
    if len(observed) < 2:
        observed["type"] = "Historical estimate"
        return observed
    slope, intercept = np.polyfit(observed["year"], observed["production"], 1)
    last_year = int(observed["year"].max())
    forecast_years = np.arange(last_year + 1, 2031)
    projected = pd.DataFrame({
        "year": forecast_years,
        "production": np.maximum(0, intercept + slope * forecast_years),
        "type": "Linear trend scenario",
    })
    observed["type"] = "Historical estimate"
    return pd.concat([observed, projected], ignore_index=True)


def format_tonnes(value: float) -> str:
    if value >= 1_000_000:
        return f"{value / 1_000_000:.2f}M t"
    if value >= 1_000:
        return f"{value / 1_000:.0f}K t"
    return f"{value:,.0f} t"


try:
    default_production, default_rainfall, soil_estimates = load_defaults()
except (FileNotFoundError, ValueError, json.JSONDecodeError) as error:
    st.error(f"Could not load the bundled dashboard data: {error}")
    st.stop()

if "production_override" not in st.session_state:
    st.session_state.production_override = None

with st.sidebar:
    st.markdown(
        '<div class="brand">shamba<span style="color:#75984f">scope</span>'
        "<small>KENYA CROP INTELLIGENCE</small></div>",
        unsafe_allow_html=True,
    )
    st.divider()
    page = st.radio(
        "Workspace",
        ["Overview", "County ranking", "Production forecast", "Field advisor"],
        label_visibility="collapsed",
    )
    st.markdown("---")
    st.caption("YOUR DATA, YOUR DECISIONS")
    production_upload = st.file_uploader(
        "Import production history",
        type=["csv"],
        help="Columns: county, year, production_tonnes. Imported data replaces the default production history for this session.",
        key="production_upload",
    )
    if production_upload is not None:
        try:
            st.session_state.production_override = parse_production_upload(production_upload)
            st.success(f"Loaded {len(st.session_state.production_override)} county-year records.")
        except ValueError as error:
            st.error(str(error))
    st.caption("Kenya · 47 counties · Metric tonnes")

production = st.session_state.production_override
if production is None:
    production = default_production
production = production.copy()
years = sorted(production["year"].astype(int).unique().tolist())
selected_year = st.session_state.get("ranking_year", years[-1])
if selected_year not in years:
    selected_year = years[-1]

st.markdown(
    f'<div class="eyebrow">NATIONAL AGRICULTURE MONITOR · {len(COUNTIES)} COUNTIES</div>',
    unsafe_allow_html=True,
)

if page == "Overview":
    st.markdown(
        '<div class="hero"><h1>Maize production,<br><span style="color:#75984f">in perspective.</span></h1>'
        '<p>A clearer view of where Kenya grows, what comes next, and what to consider in the field.</p></div>',
        unsafe_allow_html=True,
    )
    selected_year = st.selectbox("Historical year", years, index=years.index(selected_year))
    st.session_state.ranking_year = selected_year
    ranked = county_totals(production, selected_year)
    national_total = float(ranked["production"].sum())
    top = ranked.iloc[0]
    trend = production_history(production)
    forecast_2030 = trend.loc[trend["year"] == 2030, "production"]
    baseline = float(trend.loc[trend["year"] == trend["year"].min(), "production"].iloc[0])
    outlook = float(forecast_2030.iloc[0]) if not forecast_2030.empty else national_total
    metric_columns = st.columns(4)
    metric_columns[0].metric(f"National production · {selected_year}", format_tonnes(national_total))
    metric_columns[1].metric("Counties tracked", str(production.loc[production["year"] == selected_year, "county"].nunique()))
    metric_columns[2].metric("Top producing county", top["county"], format_tonnes(float(top["production"])))
    metric_columns[3].metric(
        "2030 trend scenario",
        format_tonnes(outlook),
        f"{(outlook / baseline - 1) * 100:+.0f}% vs. {int(trend['year'].min())}" if baseline else None,
    )

    left, right = st.columns([1.2, 1])
    with left:
        st.subheader("National production trajectory")
        figure = go.Figure()
        for label, group in trend.groupby("type", sort=False):
            figure.add_trace(go.Scatter(
                x=group["year"], y=group["production"], mode="lines+markers",
                name=label, line={"color": "#245c3e" if label == "Historical estimate" else "#91b267", "width": 3},
                marker={"size": 6},
            ))
        figure.update_layout(
            height=330, margin={"l": 8, "r": 8, "t": 12, "b": 8},
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            legend={"orientation": "h", "y": 1.12}, yaxis_title="Tonnes",
        )
        st.plotly_chart(figure, width="stretch")
    with right:
        st.subheader(f"Leading counties · {selected_year}")
        leaders = ranked.head(7).sort_values("production")
        figure = go.Figure(go.Bar(
            x=leaders["production"], y=leaders["county"], orientation="h",
            marker_color="#75984f", text=leaders["production"].map(format_tonnes),
            textposition="outside",
        ))
        figure.update_layout(
            height=330, margin={"l": 8, "r": 35, "t": 12, "b": 8},
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            xaxis={"visible": False}, yaxis_title=None,
        )
        st.plotly_chart(figure, width="stretch")
    st.markdown(
        '<div class="source-note">Historical observations come from the supplied workbook. '
        "The 2019 observation is missing. The straight-line 2030 outlook is a scenario, "
        "not an official forecast.</div>",
        unsafe_allow_html=True,
    )

elif page == "County ranking":
    st.title("County production ranking")
    st.write("Compare county output and share of the national total.")
    selected_year = st.selectbox("Ranking year", years, index=years.index(selected_year))
    st.session_state.ranking_year = selected_year
    query = st.text_input("Find a county", placeholder="Type a county name")
    ranked = county_totals(production, selected_year)
    national_total = float(ranked["production"].sum())
    ranked.insert(0, "Rank", np.arange(1, len(ranked) + 1))
    ranked["Share"] = ranked["production"].div(national_total).fillna(0)
    ranked = ranked.loc[ranked["county"].str.contains(query, case=False, na=False)].copy()
    ranked["Production (tonnes)"] = ranked.pop("production").round(2)
    ranked["Share of total"] = ranked.pop("Share").map(lambda value: f"{value:.1%}")
    ranked = ranked.rename(columns={"county": "County"})
    st.dataframe(
        ranked[["Rank", "County", "Production (tonnes)", "Share of total"]],
        hide_index=True,
        width="stretch",
        height=650,
    )
    export = ranked.to_csv(index=False).encode("utf-8")
    st.download_button(
        "Download ranking CSV",
        export,
        file_name=f"kenya-maize-county-ranking-{selected_year}.csv",
        mime="text/csv",
    )

elif page == "Production forecast":
    st.title("Production forecast")
    st.write("Observed national production and a simple linear trend scenario through 2030.")
    trend = production_history(production)
    figure = go.Figure()
    for label, group in trend.groupby("type", sort=False):
        figure.add_trace(go.Scatter(
            x=group["year"], y=group["production"], mode="lines+markers",
            name=label, line={"color": "#245c3e" if label == "Historical estimate" else "#91b267", "width": 3},
            marker={"size": 7},
        ))
    figure.update_layout(
        height=500, hovermode="x unified", margin={"l": 12, "r": 12, "t": 25, "b": 12},
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        yaxis_title="Production (tonnes)", xaxis_title="Year",
        legend={"orientation": "h", "y": 1.1},
    )
    st.plotly_chart(figure, width="stretch")
    missing_years = sorted(set(range(years[0], years[-1] + 1)) - set(years))
    coverage = f"Observed {years[0]}–{years[-1]}"
    if missing_years:
        coverage += f" · {', '.join(map(str, missing_years))} not reported"
    st.caption(f"{coverage}. Historical values are as supplied; future values are linear extrapolations, not official forecasts.")

else:
    st.title("Your county field advisor")
    st.write("Use local context to explore practical starting points. Guidance is not a farm-specific prescription.")
    county = st.selectbox("County", COUNTIES, index=COUNTIES.index("Trans Nzoia"))
    rainfall_outlook = st.selectbox("Seasonal rainfall outlook", ["Below average", "Near average", "Above average"])
    soil_test = st.selectbox(
        "Soil test / history",
        ["Not available", "Low nitrogen", "Low phosphorus", "Acidic soil", "Balanced soil"],
    )

    rain_upload = st.file_uploader(
        "Import rainfall history CSV",
        type=["csv"],
        help="Required columns: county, year, season (or period), rainfall_mm.",
        key="rainfall_upload",
    )
    soil_upload = st.file_uploader(
        "Import soil sample or county report CSV",
        type=["csv"],
        help="Farm samples: county, sample_date, ph, nitrogen_status, phosphorus_status. "
        "County reports: county, ph, nitrogen_g_kg, phosphorus_mg_kg.",
        key="soil_upload",
    )

    imported_rainfall = None
    if rain_upload is not None:
        try:
            imported_rainfall = parse_rainfall_upload(rain_upload)
        except ValueError as error:
            st.error(str(error))
    imported_soil = None
    if soil_upload is not None:
        try:
            imported_soil = parse_soil_upload(soil_upload)
        except ValueError as error:
            st.error(str(error))

    seed_advice = {
        "highland": "Compare locally certified medium/long-season hybrids suited to cooler highland conditions.",
        "western": "Compare locally certified, disease-tolerant hybrids suited to the western high-rainfall zone.",
        "central": "Compare locally certified varieties matched to the county's elevation and season length.",
        "arid": "Prioritize locally certified early-maturing, drought-tolerant varieties; confirm local suitability before purchase.",
        "coastal": "Compare locally certified early-maturing varieties that fit the local rainfall window.",
        "mixed": "Choose a locally certified variety matched to altitude, rainfall window, and extension guidance.",
    }
    rainfall_advice = {
        "Below average": "Prioritize a timely planting window, moisture conservation, and early-maturing varieties.",
        "Near average": "Align planting with dependable rains and avoid waterlogged fields.",
        "Above average": "Prioritize drainage and disease-tolerant certified seed; avoid saturated fields.",
    }
    soil_advice = {
        "Not available": "Test soil before setting fertilizer rates; no dose can responsibly be inferred here.",
        "Low nitrogen": "Discuss a split nitrogen top-dress plan with an extension officer and confirm its rate from a current test.",
        "Low phosphorus": "Discuss phosphorus source and placement with an extension officer; confirm the rate from a current test.",
        "Acidic soil": "Request soil pH and lime requirement before fertilizer planning; lime rates are soil-specific.",
        "Balanced soil": "Follow the soil test recommendations and avoid adding nutrients without a diagnosed need.",
    }
    if st.button("Generate field notes", type="primary"):
        first, second = st.columns(2)
        first.info(f"**Seed to compare**\n\n{seed_advice[ZONES.get(county, 'mixed')]}")
        second.info(f"**Soil planning · {soil_test}**\n\n{soil_advice[soil_test]}")
        st.write(f"**Rainfall context · {rainfall_outlook}:** {rainfall_advice[rainfall_outlook]}")

    st.subheader(f"Local records · {county}")
    station_rows = default_rainfall.loc[default_rainfall["county"] == county]
    if not station_rows.empty:
        st.caption("KMD station observations; station readings are not county averages.")
        st.dataframe(
            station_rows[["station", "period", "rainfallMm"]].rename(
                columns={"station": "Station", "period": "Period", "rainfallMm": "Rainfall (mm)"}
            ),
            hide_index=True,
            width="stretch",
        )
        st.markdown(f"[Source: KMD Dekad 30 bulletin]({KMD_BULLETIN})")
    else:
        st.caption("No station observation for this county in the saved KMD snapshot.")

    soil_row = soil_estimates.loc[soil_estimates["county"] == county]
    if not soil_row.empty:
        row = soil_row.iloc[0]
        st.write(
            f"**Undated county soil estimate (not a farm sample):** pH {row['ph']}; "
            f"N {row['nitrogen_g_kg']} g/kg; P {row['phosphorus_mg_kg']} mg/kg; "
            f"K {row['potassium_mg_kg'] if pd.notna(row['potassium_mg_kg']) else 'not reported'}."
        )
    if imported_rainfall is not None:
        selected_rain = imported_rainfall.loc[imported_rainfall["county"] == county]
        if not selected_rain.empty:
            st.write("**Imported rainfall records**")
            st.dataframe(selected_rain, hide_index=True, width="stretch")
    if imported_soil is not None:
        selected_soil = imported_soil.loc[imported_soil["county"] == county]
        if not selected_soil.empty:
            st.write("**Imported soil records**")
            st.dataframe(selected_soil, hide_index=True, width="stretch")

    st.markdown(
        """
        <div class="source-note"><strong>Important:</strong> County estimates are not farm samples, and the saved KMD station readings are not county rainfall totals. These notes are not fertilizer or lime prescriptions. Confirm seed certification, current soil tests, seasonal forecasts, and farm-specific rates with your county agricultural extension officer.</div>
        """,
        unsafe_allow_html=True,
    )
