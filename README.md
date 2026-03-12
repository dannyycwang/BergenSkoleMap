# BergenSkoleMap


```bash
python -m http.server 4173
```
開啟：
- `http://localhost:4173/`

```bash
./scripts/rebuild_map_data.sh
```
這會依序執行：
1. `python scripts/prepare_data.py`
2. `python scripts/geocode_schools.py`

---


