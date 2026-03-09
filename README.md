# BergenSkoleMap

Bergen 小學互動地圖專案：
- 清洗 `educationBergen.xlsx` 學校資料
- 產生 `GeoJSON/JSON/CSV`
- 用 Leaflet 建立可搜尋、可點擊查看資訊的地圖網頁

## 1) 資料清洗
```bash
python scripts/prepare_data.py
```
輸出：
- `data/bergen_primary_schools_cleaned.csv`
- `data/bergen_primary_schools.json`
- `data/bergen_primary_schools.geojson`

> 註：清洗階段會先提供可用的 Bergen 近似座標作為安全 fallback。

## 2) 啟動網頁
```bash
python -m http.server 4173
```
開啟（兩種都可）：
- `http://localhost:4173/`（會自動轉到 `/web/`）
- `http://localhost:4173/web/`

## 3) 功能
- 搜尋學校名稱
- 點擊地圖標記後，右側詳情面板顯示完整學校資料
- 左側清單點擊可定位到學校
- 前端背景自動嘗試線上 geocoding（Nominatim）並快取結果，逐步把近似點更新成真實座標
- 前端會嘗試多個資料路徑（`../data`、`./data`、`/data`），降低 404 發生機率
