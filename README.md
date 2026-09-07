# Στούντιο Μακιγιάζ

Παιχνίδι μακιγιάζ για παιδιά (browser, PC + κινητό). Σύρε καλλυντικά πάνω σε ένα από τα 4 pixel-art πρόσωπα,
δες το να χαμογελά/ανοιγοκλείνει τα μάτια/εκπλήσσεται, αποθήκευσε το έργο με όνομα στη γκαλερί.

## Εκτέλεση
```
npm install
npm run dev        # http://localhost:5174
npm run build      # παραγωγή στο dist/ (base /makeup-studio/)
npm run shots      # στιγμιότυπα desktop/laptop/iPad/iPhone με τον εγκατεστημένο Chrome (θέλει dev server)
```

## Δομή
- `src/engine/` — compositor (blend modes + φτερωτές μάσκες), συνταγές καλλυντικών, hit-test, animator
- `src/data/faces/<id>.regions.json` — πολύγωνα περιοχών ανά πρόσωπο (χείλη, μάγουλα, βλέφαρα…) και παραλλαγές έκφρασης
- `src/assets/faces/<id>/{neutral,blink,smile,wow}.png` — PixelLab 512×512
- `tools/pl.py`, `tools/face_variants.py`, `tools/face_grid.py` — PixelLab pipeline· `#/dev/regions?face=f1` — επεξεργαστής περιοχών
- `?test=1` → `window.__studio` API για δοκιμές· `?debug=1` → εμφάνιση περιοχών
