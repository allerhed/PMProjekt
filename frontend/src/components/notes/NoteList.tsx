import { useState, useRef, useEffect } from 'react';
import { useProjectNotes, useCreateNote, useUpdateNote, useDeleteNote } from '../../hooks/useProjectNotes';
import type { ProjectNote } from '../../services/projectNote.api';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import Select from '../ui/Select';

const SORT_OPTIONS = [
  { value: 'created', label: 'Date Created' },
  { value: 'edited', label: 'Last Edited' },
  { value: 'author', label: 'Author' },
];

interface NoteListProps {
  projectId: string;
}

export default function NoteList({ projectId }: NoteListProps) {
  const [sortBy, setSortBy] = useState('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { data: notes = [], isLoading } = useProjectNotes(projectId, { sortBy, sortOrder });
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select
          options={SORT_OPTIONS}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="max-w-[160px]"
        />
        <button
          type="button"
          onClick={() => setSortOrder((o) => o === 'asc' ? 'desc' : 'asc')}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortOrder === 'asc' ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 5a.75.75 0 01.75.75v6.638l1.96-2.158a.75.75 0 111.08 1.04l-3.25 3.5a.75.75 0 01-1.08 0l-3.25-3.5a.75.75 0 111.08-1.04l1.96 2.158V5.75A.75.75 0 0110 5z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 15a.75.75 0 01-.75-.75V7.612L7.29 9.77a.75.75 0 01-1.08-1.04l3.25-3.5a.75.75 0 011.08 0l3.25 3.5a.75.75 0 11-1.08 1.04l-1.96-2.158v6.638A.75.75 0 0110 15z" clipRule="evenodd" />
            </svg>
          )}
          {sortOrder === 'asc' ? 'Asc' : 'Desc'}
        </button>
        <div className="flex-1" />
        <Button onClick={() => setShowCreate(true)}>Add Note</Button>
      </div>

      {/* Notes list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Add a note to keep track of project details."
          action={<Button onClick={() => setShowCreate(true)}>Add Note</Button>}
        />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isEditing={editingId === note.id}
              onEdit={() => setEditingId(note.id)}
              onCancelEdit={() => setEditingId(null)}
              onDelete={() => setDeleteConfirmId(note.id)}
              projectId={projectId}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateNoteModal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          projectId={projectId}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirmId && (
        <DeleteConfirmModal
          isOpen={!!deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          projectId={projectId}
          noteId={deleteConfirmId}
        />
      )}
    </div>
  );
}

function NoteCard({
  note,
  isEditing,
  onEdit,
  onCancelEdit,
  onDelete,
  projectId,
}: {
  note: ProjectNote;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  projectId: string;
}) {
  const [editContent, setEditContent] = useState(note.content);
  const updateNote = useUpdateNote(projectId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  useEffect(() => {
    setEditContent(note.content);
  }, [note.content]);

  async function handleSave() {
    if (!editContent.trim()) return;
    try {
      await updateNote.mutateAsync({ noteId: note.id, data: { content: editContent } });
      onCancelEdit();
    } catch {
      // Error handled by mutation
    }
  }

  const createdDate = new Date(note.created_at).toLocaleDateString('sv-SE');
  const updatedDate = new Date(note.updated_at).toLocaleDateString('sv-SE');
  const wasEdited = note.updated_at !== note.created_at;
  const authorName = `${note.author_first_name} ${note.author_last_name}`;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors">
      {isEditing ? (
        <div>
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => {
              setEditContent(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-primary-500 focus:ring-primary-500 resize-none"
            rows={3}
          />
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="secondary" size="sm" onClick={onCancelEdit}>Cancel</Button>
            <Button size="sm" onClick={handleSave} loading={updateNote.isPending}>Save</Button>
          </div>
        </div>
      ) : (
        <div>
          <div
            className="text-sm text-gray-900 whitespace-pre-wrap cursor-pointer"
            onClick={onEdit}
          >
            {note.content}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{authorName}</span>
              <span>Created {createdDate}</span>
              {wasEdited && <span>Edited {updatedDate}</span>}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onEdit}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Edit"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                </svg>
              </button>
              <button
                onClick={onDelete}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                title="Delete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateNoteModal({
  isOpen,
  onClose,
  projectId,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}) {
  const [content, setContent] = useState('');
  const createNote = useCreateNote(projectId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await createNote.mutateAsync({ content });
      onClose();
      setContent('');
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Note">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            placeholder="Write your note..."
            rows={4}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-primary-500 focus:ring-primary-500 resize-none"
            required
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createNote.isPending}>Add Note</Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteConfirmModal({
  isOpen,
  onClose,
  projectId,
  noteId,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  noteId: string;
}) {
  const deleteNote = useDeleteNote(projectId);

  async function handleDelete() {
    try {
      await deleteNote.mutateAsync(noteId);
      onClose();
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Note" size="sm">
      <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete this note? This action cannot be undone.</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={handleDelete} loading={deleteNote.isPending}>Delete</Button>
      </div>
    </Modal>
  );
}
