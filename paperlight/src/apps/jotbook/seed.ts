import { newId } from '../../lib/library';
import type { Library } from './store';

/** The first notebook a new install opens on: a working page that explains itself. */
export function starterLibrary(now = Date.now()): Library {
  const notebookId = newId();
  const sectionId = newId();
  const html = `
<p>Jotbook keeps your notebooks on this computer and saves as you type. There is no save button and no account.</p>
<h2>Find your way</h2>
<ul>
<li><p>Switch notebook and section from the bar at the top.</p></li>
<li><p>Pages in this section are numbered on the left. <strong>New page</strong> adds one, or press Ctrl N.</p></li>
<li><p>Press Ctrl F to search every notebook at once.</p></li>
</ul>
<h2>Write</h2>
<p>Type <code>/</code> on an empty line for checklists, headings, tables and images. Select text for bold, highlight and links. Paste or drag a picture straight in.</p>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><p>Open Jotbook</p></li>
<li data-type="taskItem" data-checked="false"><p>Make a section for your own notes</p></li>
<li data-type="taskItem" data-checked="false"><p>Delete this page when you no longer need it</p></li>
</ul>`;
  const text =
    'Jotbook keeps your notebooks on this computer and saves as you type. Find your way Switch notebook and section from the bar at the top. Pages in this section are numbered on the left. Press Ctrl F to search every notebook at once. Write Type / on an empty line for checklists, headings, tables and images. Open Jotbook Make a section for your own notes Delete this page when you no longer need it';
  return {
    notebooks: [{ id: notebookId, name: 'My notebook', order: now, createdAt: now }],
    sections: [{ id: sectionId, notebookId, name: 'Quick notes', order: now, createdAt: now }],
    pages: [
      {
        id: newId(),
        sectionId,
        title: 'Welcome to Jotbook',
        html,
        text,
        order: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}
