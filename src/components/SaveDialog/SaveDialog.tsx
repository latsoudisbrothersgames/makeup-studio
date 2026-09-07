import { useState } from 'react';
import { S } from '../../data/strings';
import { MAX_NAME_LENGTH, sanitizeName } from '../../storage/gallery';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';

interface Props {
  defaultProjectName: string;
  defaultModelName: string;
  onSave(projectName: string, modelName: string): void;
  onCancel(): void;
}

export function SaveDialog({ defaultProjectName, defaultModelName, onSave, onCancel }: Props) {
  const [projectName, setProjectName] = useState(defaultProjectName);
  const [modelName, setModelName] = useState(defaultModelName);
  const submit = () => onSave(sanitizeName(projectName) || defaultProjectName, sanitizeName(modelName));
  return (
    <Dialog
      title={S.saveTitle}
      onClose={onCancel}
      actions={
        <>
          <Button variant="ghost" size="lg" onClick={onCancel}>{S.cancel}</Button>
          <Button variant="mint" size="lg" onClick={submit} data-action="save-confirm">{S.save}</Button>
        </>
      }
    >
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <label className="field">
          <span className="field__label">{S.projectName}</span>
          <input
            className="field__input"
            value={projectName}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setProjectName(e.target.value)}
            data-autofocus
            data-field="project-name"
          />
        </label>
        <label className="field">
          <span className="field__label">{S.modelName}</span>
          <input
            className="field__input"
            value={modelName}
            maxLength={MAX_NAME_LENGTH}
            placeholder={S.namePlaceholder}
            onChange={(e) => setModelName(e.target.value)}
            data-field="model-name"
          />
        </label>
        <button type="submit" className="visually-hidden">{S.save}</button>
      </form>
    </Dialog>
  );
}
