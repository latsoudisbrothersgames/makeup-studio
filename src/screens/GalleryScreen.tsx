import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playSound } from '../audio/soundManager';
import { Button } from '../components/Button/Button';
import { ConfirmDialog } from '../components/Dialog/Dialog';
import { faceById } from '../data/faces';
import { S } from '../data/strings';
import { deleteProject, loadGallery } from '../storage/gallery';
import { useSession } from '../state/SessionContext';
import type { Project } from '../types/project';
import '../styles/layout.css';
import './GalleryScreen.css';

export function GalleryScreen() {
  const nav = useNavigate();
  const session = useSession();
  const [projects, setProjects] = useState<Project[]>(() => loadGallery());
  const [toDelete, setToDelete] = useState<Project | null>(null);

  const open = (p: Project) => {
    session.setFace(p.faceId);
    session.setModelName(p.modelName);
    session.setProjectId(p.id);
    nav(`/studio?project=${encodeURIComponent(p.id)}`);
  };

  const confirmDelete = useCallback(() => {
    if (!toDelete) return;
    deleteProject(toDelete.id);
    playSound('clear');
    setProjects(loadGallery());
    setToDelete(null);
  }, [toDelete]);

  return (
    <main className="screen screen--scroll gallery">
      <div className="gallery__head">
        <Button variant="ghost" icon="←" onClick={() => nav(-1)}>{S.back}</Button>
        <h1 className="screen__title">{S.galleryTitle}</h1>
        <Button variant="primary" icon="✨" onClick={() => nav('/choose')}>{S.play}</Button>
      </div>
      {projects.length === 0 ? (
        <p className="screen__sub gallery__empty">{S.galleryEmpty}</p>
      ) : (
        <div className="gallery__grid">
          {projects.map((p) => {
            const face = faceById(p.faceId);
            return (
              <article className="pcard" key={p.id} data-project={p.id}>
                <div className="pcard__thumb-wrap">
                  {p.thumb ? <img className="pcard__thumb pixelated" src={p.thumb} alt="" /> : <div className="pcard__thumb pcard__thumb--empty">💄</div>}
                </div>
                <h2 className="pcard__title">{p.projectName}</h2>
                <p className="pcard__meta">
                  {p.kind === 'salon' ? <span className="pcard__badge" data-badge="salon">💇 {S.albumSalon}{p.stars ? ` · ${'★'.repeat(p.stars)}` : ''}</span> : null}
                  {p.kind === 'salon' ? <br /> : null}
                  {face?.nameEl}{p.modelName ? ` · ${p.modelName}` : ''}
                  <br />
                  <span className="pcard__date">{new Date(p.updatedAt).toLocaleDateString('el-GR')}</span>
                </p>
                <div className="pcard__actions">
                  <Button variant="mint" onClick={() => open(p)} data-action="open">{S.open}</Button>
                  <Button variant="ghost" onClick={() => setToDelete(p)} data-action="delete">{S.delete}</Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {toDelete && (
        <ConfirmDialog
          title={S.confirmDeleteTitle}
          body={toDelete.projectName}
          yesLabel={S.yesDelete}
          onYes={confirmDelete}
          onNo={() => setToDelete(null)}
        />
      )}
    </main>
  );
}
