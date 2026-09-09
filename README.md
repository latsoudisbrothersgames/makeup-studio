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
- Εργαλεία χωρίς εικαστικά (v2): μπογιές προσώπου (`facePaint`: γατούλα/ουράνιο τόξο, σχεδιάζονται πάνω στις περιοχές), μολύβι χειλιών, βαμβάκι ντεμακιγιάζ (`remover`: αφαιρεί το πιο πρόσφατο στρώμα στο σημείο, μπαίνει στο history), κάρτες έμπνευσης (`src/data/cards.ts`, 4×2 έλεγχοι στα στρώματα), «Φωτογράφισε» (`engine/exportImage.ts`: 1024×1180 PNG, Web Share σε αφή / λήψη σε desktop)
- `src/engine/` — compositor (blend modes + φτερωτές μάσκες), συνταγές καλλυντικών, hit-test, animator
- `src/data/faces/<id>.regions.json` — πολύγωνα περιοχών ανά πρόσωπο (χείλη, μάγουλα, βλέφαρα…) και παραλλαγές έκφρασης
- `src/assets/faces/<id>/{neutral,blink,smile,wow}.png` — PixelLab 512×512· `hair.png` = ξεχωριστό επίπεδο μαλλιών (σχεδιάζεται ΠΑΝΩ από το μακιγιάζ, ώστε οι τούφες να καλύπτουν μάσκα/μπογιές)
- `src/engine/hairColor.ts` — βαφή μαλλιών με αντικατάσταση παλέτας (ταξινόμηση τόνων κατά φωτεινότητα → ράμπα 5 τόνων)· `hairMask.ts` = alpha των μαλλιών ως στόχος drop + περίγραμμα overlay
- `tools/hair_layer.py` — εξάγει το `hair.png` από τη βάση (λίστα χρωμάτων ανά μοντέλο + αφαίρεση φρυδιών/ματιών με τα πολύγωνα)· χωρίς PixelLab
- Περιοχές μαλλιών στο JSON: `hairStreak` (πλαϊνή τούφα για δεύτερο χρώμα)· άγκυρες `accL/accR/accTop` (θέσεις αξεσουάρ, ορίζονται στον editor με ⌖)
- `tools/pl.py`, `tools/face_variants.py`, `tools/face_grid.py` — PixelLab pipeline· `#/dev/regions?face=f1` — επεξεργαστής περιοχών (πολύγωνα + άγκυρες)
- `node tools/hairshot.mjs [--ui]` — στιγμιότυπα βαφής+τούφας στα 4 πρόσωπα και του panel «Μαλλιά» (iPhone/desktop)
- `node tools/paintshot.mjs`, `node tools/step3shot.mjs` — στιγμιότυπα μπογιών/μολυβιού και καρτών/φωτογραφίας (iPhone+desktop, με έλεγχο λήψης PNG)
- `node tools/maskshot.mjs` — στιγμιότυπα μάσκας+μακιγιάζ στα 4 πρόσωπα (έλεγχος ότι τα μαλλιά καλύπτουν τη μάσκα)
- `?test=1` → `window.__studio` API για δοκιμές· `?debug=1` → εμφάνιση περιοχών
