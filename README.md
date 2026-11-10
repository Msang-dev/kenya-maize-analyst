# ShambaScope — Kenya maize intelligence

A Kenya maize intelligence dashboard for exploring historical production, county rankings, a trend scenario, and field context across all 47 counties. The original dependency-free browser dashboard is available at `index.html`; a native Streamlit version is available at `streamlit_app.py`.

## Run the Streamlit app

Install the requirements and start the app from this folder:

```bash
python -m pip install -r requirements.txt
python -m streamlit run streamlit_app.py
```

The Streamlit version includes the overview, searchable/exportable county rankings, a production trend chart, production CSV import, and the field advisor with rainfall/soil CSV uploads. Uploaded files are processed in the active app session and are not written to the project.

## Deploy to Streamlit Community Cloud

1. Push this project, including `streamlit_app.py`, `requirements.txt`, `.streamlit/config.toml`, and the bundled data files, to a GitHub repository you can access.
2. Sign in to [Streamlit Community Cloud](https://share.streamlit.io/) with an account that can access that repository.
3. Choose **Create app**, select the repository and branch, set the app file to `streamlit_app.py`, and deploy.

The GitHub repository must be available to the connected Streamlit account. This project folder must be pushed to GitHub before Community Cloud can deploy it.

## What it does

- Opens the national overview, full county ranking, production forecast, and field advisor as focused views from the main navigation. The selected view is reflected in the URL and supports browser back/forward navigation.
- Ranks county production, compares each county's share, searches counties, and exports rankings as CSV.
- Uses the supplied county production workbook as its starting dataset: metric tonnes for 2012–2018 and 2020. The workbook contains no 2019 records. Shows those historical observations and extends a simple linear trend to 2030; the projection is a scenario, not an official forecast.
- Accepts county production-history CSV uploads and recalculates the rankings and trend. Required headers are `county,year,production_tonnes`; `production` and `tonnes` are also accepted as production-column names. Include one row per county and year, with non-negative production in tonnes. An example:

  ```csv
  county,year,production_tonnes
  Trans Nzoia,2021,510000
  Uasin Gishu,2021,470000
  ```

- Accepts optional rainfall and soil-sample history CSVs in the field advisor. Start with the [rainfall history template](./rainfall-history-template.csv) or [soil sample history template](./soil-sample-history-template.csv). Rainfall files require `county,year,season,rainfall_mm`; add one row per county, year, and season, with observed seasonal rainfall in millimetres. Soil files require `county,sample_date,ph,nitrogen_status,phosphorus_status`; add one row per lab sample, use ISO dates (`YYYY-MM-DD`), pH values from 0 to 14 (or blank), and `low`, `adequate`, `high`, or `unknown` nutrient statuses. Templates contain headers only; replace them with verified observations before importing. The advisor displays up to four most recent records for the selected county and surfaces the latest soil sample in its field notes; these observations do not constitute a seasonal forecast or a fertilizer prescription. Uploads remain in browser memory for the current session.
- Links to official [KMD MapViewer](https://meteo.go.ke/mapviewer/), [10-day agrometeorological bulletins](https://meteo.go.ke/Services/agrometeorology/), and [Climate Data Management](https://meteo.go.ke/Services/climate-data-management/) from the field advisor. KMD describes its maprooms as offering daily/dekadal climate information by county, ward, or grid, and its agrometeorology team as issuing 10-day rainfall/soil-moisture bulletins. The rainfall outlook selector remains a manual entry, not a live forecast feed.
- Includes rainfall observed at 21 named KMD stations during 21–31 October 2026, transcribed from the [KMD Dekad 30 bulletin](https://meteo.go.ke/documents/5546/AGROMET_BULLETIN_DEKAD_30_2026.pdf), issued 2 November 2026. See [kmd-rainfall-observations-2026-10.csv](./kmd-rainfall-observations-2026-10.csv). The bulletin's Dekad 30 forecast covers 1–10 November; these saved readings are the separate October weather review in that bulletin. A station's county label identifies its locality, not a county-wide rainfall average; counties without a listed station have no observation in this file. Values are in millimetres as reported by KMD. The CSV is loaded in the advisor as a fixed snapshot and does not auto-refresh; import a newer verified CSV for updated observations.
- Imports user-provided ShambaIQ county soil estimates from [shambaiq-county-soil-reports.csv](./shambaiq-county-soil-reports.csv), separately labeled from dated farm soil samples. The pasted data has pH, nitrogen, phosphorus, and a reported score for 47 counties, but no report date or potassium values; these missing values are left blank and not inferred.
- Provides county- and rainfall-aware seed-selection prompts and soil-history-aware nutrient-planning prompts.
- Links to the selected county's [ShambaIQ maize soil report](https://shambaiq.com/soil/trans-nzoia/maize). These public county reports provide satellite/model-based estimates, not individual farm soil-sample records; they are opened on ShambaIQ and are not scraped or copied into this dashboard.

## Data and agronomy limitations

The default production history comes from the user-provided `Maize-Production-2012-2020-Combined.xlsx` workbook. The workbook does not identify its original statistical source; values are displayed as supplied and are not independently verified. Workbook production values are in metric tonnes and are used without unit conversion. The dataset includes 47 counties for 2012–2018 and 2020, but not 2019. Forecasts are simple linear extrapolations—not official forecasts or validated yield models—and do not account for planted area, weather records, policy, pests, input use, or changing climate. Imported counties without a row appear as zero in the selected year.

Imported rainfall and soil-sample histories are user-supplied records, not live feeds; the advisor does not infer a rainfall forecast from them. Its zone-level prompts are not certified seed-variety recommendations or fertilizer prescriptions. Fertilizer rates in kg/acre and lime rates cannot safely be inferred from county or nutrient categories alone. Use current farm soil-test recommendations, locally available certified seed information, seasonal forecasts, and advice from a qualified county agricultural extension officer to determine farm-specific inputs and rates.

ShambaIQ's public [county report](https://shambaiq.com/soil/kiambu/maize) describes county soil and climate estimates. Its [About page](https://shambaiq.com/about) describes the soil information as satellite-based predictions, and its [Terms of Service](https://shambaiq.com/terms) state the recommendations are advisory and prohibit scraping at scale. The supplied county summary was entered from user-provided text, not scraped from the website; the dashboard labels it as undated county estimates instead of farm soil samples and links to the current report for reference. The source text did not include potassium values, so those cells remain blank.

No uploaded data is sent to a server or saved by this page; it is processed in the browser for the current session.
