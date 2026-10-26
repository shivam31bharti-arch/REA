export interface Template {
  id: string;
  name: string;
  description: string;
  title: string;
  html: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank document',
    description: 'An empty page.',
    title: 'Untitled',
    html: '',
  },
  {
    id: 'video-script',
    name: 'Video script',
    description: 'Hook, beats and outro for a recorded video.',
    title: 'Video script',
    html: `
<h1>Video script</h1>
<p>Working title, length target and the one idea a viewer should leave with.</p>
<h2>Hook</h2>
<p>The first fifteen seconds. Open on the moment that makes someone stay.</p>
<h2>Setup</h2>
<p>Why this matters now, in two or three sentences.</p>
<h2>Main beats</h2>
<ol><li><p>First point, with the example you'll show on screen.</p></li><li><p>Second point.</p></li><li><p>Third point.</p></li></ol>
<h2>Outro</h2>
<p>The takeaway, then what to watch next.</p>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Record A-roll</p></li><li data-type="taskItem" data-checked="false"><p>Capture screen footage</p></li><li data-type="taskItem" data-checked="false"><p>Write the description</p></li></ul>`,
  },
  {
    id: 'letter',
    name: 'Letter',
    description: 'A formal letter with address and sign-off.',
    title: 'Letter',
    html: `
<p>Your name<br>Street address<br>City, postcode</p>
<p>21 October 2026</p>
<p>Recipient name<br>Organisation<br>Street address<br>City, postcode</p>
<p><strong>Subject: What this letter is about</strong></p>
<p>Dear Recipient,</p>
<p>Open with the reason you are writing. Keep the first paragraph to the point.</p>
<p>Add the details the reader needs to act, one idea per paragraph.</p>
<p>Close with what you would like to happen next.</p>
<p>Yours sincerely,</p>
<p>Your name</p>`,
  },
  {
    id: 'report',
    name: 'Report',
    description: 'Summary, findings table and next steps.',
    title: 'Report',
    html: `
<h1>Report title</h1>
<p>Prepared by your name · October 2026</p>
<h2>Summary</h2>
<p>The conclusion first, in three sentences or fewer.</p>
<h2>Findings</h2>
<table><tbody>
<tr><th><p>Area</p></th><th><p>Observation</p></th><th><p>Priority</p></th></tr>
<tr><td><p>First area</p></td><td><p>What you found</p></td><td><p>High</p></td></tr>
<tr><td><p>Second area</p></td><td><p>What you found</p></td><td><p>Medium</p></td></tr>
</tbody></table>
<h2>Recommendations</h2>
<ul><li><p>The change you recommend and why.</p></li><li><p>A second recommendation.</p></li></ul>
<h2>Next steps</h2>
<p>Who does what, and by when.</p>`,
  },
  {
    id: 'meeting-notes',
    name: 'Meeting notes',
    description: 'Agenda, decisions and action items.',
    title: 'Meeting notes',
    html: `
<h1>Meeting notes</h1>
<p><strong>Date:</strong> 21 October 2026 · <strong>Attendees:</strong> names</p>
<h2>Agenda</h2>
<ol><li><p>First topic</p></li><li><p>Second topic</p></li></ol>
<h2>Decisions</h2>
<ul><li><p>What was agreed.</p></li></ul>
<h2>Action items</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Owner: the task, by the date</p></li><li data-type="taskItem" data-checked="false"><p>Owner: the task, by the date</p></li></ul>`,
  },
];
