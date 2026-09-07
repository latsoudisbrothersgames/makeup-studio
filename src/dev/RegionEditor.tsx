import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { faceById, FACES } from '../data/faces';
import { mirrorPoly, polyBBox } from '../engine/geometry';
import { resolveRegions } from '../engine/regions';
import { loadFaceImages } from '../hooks/useFaceImages';
import type { FaceImages } from '../engine/compositor';
import { EXPRESSIONS, POLYLINE_REGIONS, REGION_IDS, type Expression, type Poly, type Region, type RegionId, type RegionMap } from '../types/face';
import { MIRROR } from '../engine/geometry';

const SCALE = 2;
const AXIS_X = 256;

/**
 * Επεξεργαστής περιοχών (μόνο για ανάπτυξη): #/dev/regions?face=f1
 * Κλικ = νέα κορυφή στην επιλεγμένη περιοχή· σύρσιμο κορυφής = μετακίνηση· Backspace = αφαίρεση τελευταίας.
 * Εξαγωγή JSON → src/data/faces/<id>.regions.json και μάσκες PNG για τις παραλλαγές έκφρασης.
 */
export function RegionEditor() {
  const [params, setParams] = useSearchParams();
  const faceId = params.get('face') ?? 'f1';
  const face = faceById(faceId) ?? FACES[0];
  const [map, setMap] = useState<RegionMap>(() => structuredClone(face.regions));
  const [expr, setExpr] = useState<Expression>('neutral');
  const [sel, setSel] = useState<RegionId>('lips');
  const [images, setImages] = useState<FaceImages | null>(null);
  const [showAll, setShowAll] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragIdx = useRef<number | null>(null);

  useEffect(() => { setMap(structuredClone(face.regions)); }, [face]);
  useEffect(() => { void loadFaceImages(face).then(setImages); }, [face]);

  const regions = useMemo(() => resolveRegions(map, expr), [map, expr]);
  const current = regions[sel];
  const isVariant = expr !== 'neutral';

  const setPoints = (pts: Poly) => {
    setMap((m) => {
      const next = structuredClone(m);
      const reg: Region = { id: sel, kind: POLYLINE_REGIONS.has(sel) ? 'polyline' : 'polygon', points: pts };
      if (isVariant) {
        next.variants[expr] = { ...(next.variants[expr] ?? {}), [sel]: reg };
      } else {
        next.regions[sel] = reg;
      }
      return next;
    });
  };

  // Σχεδίαση
  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    if (images) ctx.drawImage(images[expr], 0, 0, 512 * SCALE, 512 * SCALE);
    ctx.lineWidth = 1.5;
    for (const id of REGION_IDS) {
      if (!showAll && id !== sel) continue;
      const r = regions[id];
      if (r.points.length < 1) continue;
      ctx.strokeStyle = id === sel ? '#ff2d7a' : 'rgba(0,120,255,0.55)';
      ctx.fillStyle = id === sel ? 'rgba(255,45,122,0.18)' : 'rgba(0,120,255,0.05)';
      ctx.beginPath();
      r.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * SCALE, y * SCALE) : ctx.lineTo(x * SCALE, y * SCALE)));
      if (r.kind === 'polygon') { ctx.closePath(); ctx.fill(); }
      ctx.stroke();
      if (id === sel) {
        r.points.forEach(([x, y], i) => {
          ctx.fillStyle = i === r.points.length - 1 ? '#ffd400' : '#ff2d7a';
          ctx.fillRect(x * SCALE - 3, y * SCALE - 3, 7, 7);
        });
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.moveTo(AXIS_X * SCALE, 0); ctx.lineTo(AXIS_X * SCALE, 512 * SCALE); ctx.stroke();
  }, [images, regions, sel, expr, showAll]);

  const toFace = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * 512), Math.round(((e.clientY - r.top) / r.height) * 512)];
  };

  const onDown = (e: React.PointerEvent) => {
    const [x, y] = toFace(e);
    const idx = current.points.findIndex(([px, py]) => Math.abs(px - x) <= 4 && Math.abs(py - y) <= 4);
    if (idx >= 0) {
      dragIdx.current = idx;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      setPoints([...current.points, [x, y]]);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragIdx.current === null) return;
    const p = toFace(e);
    setPoints(current.points.map((pt, i) => (i === dragIdx.current ? p : pt)));
  };
  const onUp = () => { dragIdx.current = null; };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Backspace') { e.preventDefault(); setPoints(current.points.slice(0, -1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const mirror = () => {
    const twin = MIRROR[sel];
    if (!twin) return;
    setMap((m) => {
      const next = structuredClone(m);
      const src = resolveRegions(next, expr)[sel];
      const reg: Region = { id: twin, kind: src.kind, points: mirrorPoly(src.points, AXIS_X) };
      if (isVariant) next.variants[expr] = { ...(next.variants[expr] ?? {}), [twin]: reg };
      else next.regions[twin] = reg;
      return next;
    });
  };

  const download = (name: string, blob: Blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportJson = () => download(`${face.id}.regions.json`, new Blob([JSON.stringify(map)], { type: 'application/json' }));

  const exportMask = () => {
    // Μάσκα για τη μεταβλητή έκφραση: λευκό όπου διαφέρει η επιλεγμένη περιοχή (και το ουδέτερο αντίστοιχό της).
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#fff';
    const ids = new Set<RegionId>([sel, ...(MIRROR[sel] ? [MIRROR[sel]!] : [])]);
    for (const id of ids) {
      for (const e of ['neutral', expr] as Expression[]) {
        const pts = resolveRegions(map, e)[id].points;
        if (pts.length < 3) continue;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.closePath();
        ctx.lineWidth = 8; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.fill();
      }
    }
    c.toBlob((b) => b && download(`${face.id}_${expr}_${sel}.mask.png`, b));
  };

  const bb = current.points.length ? polyBBox(current.points) : null;

  return (
    <main style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12, padding: 12, height: '100%', overflow: 'auto', fontSize: 14 }}>
      <canvas
        ref={canvasRef}
        width={512 * SCALE}
        height={512 * SCALE}
        style={{ width: '100%', maxWidth: 1024, background: '#eee', cursor: 'crosshair', touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label>Πρόσωπο{' '}
          <select value={face.id} onChange={(e) => setParams({ face: e.target.value })}>
            {FACES.map((f) => <option key={f.id} value={f.id}>{f.id} {f.nameEl}</option>)}
          </select>
        </label>
        <label>Έκφραση{' '}
          <select value={expr} onChange={(e) => setExpr(e.target.value as Expression)}>
            {EXPRESSIONS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </label>
        <label><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Όλες οι περιοχές</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {REGION_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSel(id)}
              style={{ padding: '6px 4px', borderRadius: 8, background: id === sel ? '#ff2d7a' : '#fff', color: id === sel ? '#fff' : '#333', border: '1px solid #ccc', fontSize: 12 }}
            >
              {id} {map.variants[expr]?.[id] ? '•' : ''} ({regions[id].points.length})
            </button>
          ))}
        </div>
        <div style={{ color: '#555' }}>
          {sel}: {current.points.length} σημεία{bb ? ` · bbox ${bb.w}×${bb.h}` : ''}{isVariant ? ' · παραλλαγή' : ''}
        </div>
        <Button variant="ghost" onClick={() => setPoints([])}>Καθάρισε περιοχή</Button>
        <Button variant="ghost" onClick={() => setPoints(current.points.slice(0, -1))}>Αφαίρεσε τελευταία</Button>
        <Button variant="ghost" onClick={mirror} disabled={!MIRROR[sel]}>Καθρέφτισε → {MIRROR[sel] ?? '—'}</Button>
        {isVariant && (
          <Button variant="ghost" onClick={() => setMap((m) => { const n = structuredClone(m); delete n.variants[expr]?.[sel]; return n; })}>
            Αφαίρεσε παραλλαγή (= ουδέτερη)
          </Button>
        )}
        <Button variant="mint" onClick={exportJson}>Εξαγωγή JSON</Button>
        <Button variant="secondary" onClick={exportMask} disabled={!isVariant}>Εξαγωγή μάσκας PNG</Button>
        <p style={{ color: '#777' }}>Κλικ = κορυφή, σύρσιμο = μετακίνηση, Backspace = αφαίρεση. Αποθήκευσε το JSON ως src/data/faces/{face.id}.regions.json</p>
      </div>
    </main>
  );
}
