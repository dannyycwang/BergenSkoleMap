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

> 註：目前執行環境封鎖外部 geocoding API，先使用「Bergen 區域近似座標」保證地圖可用。後續可在可連外環境把 `prepare_data.py` 改回真實 geocoding。

## 2) 啟動網頁
```bash
python -m http.server 4173
```
開啟：
- `http://localhost:4173/web/`

## 3) 功能
- 搜尋學校名稱
- 點擊地圖標記查看學校資料
- 左側清單點擊可定位到學校
