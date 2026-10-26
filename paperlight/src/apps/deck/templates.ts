import { newId, newSlide, type Deck, type ThemeId, type Slide } from './model';

export interface DeckTemplate {
  id: string;
  name: string;
  description: string;
  build: () => Deck;
}

function deck(title: string, theme: ThemeId, slides: Slide[]): Deck {
  const now = Date.now();
  return { id: newId(), title, theme, slides, createdAt: now, updatedAt: now };
}

export const DECK_TEMPLATES: DeckTemplate[] = [
  {
    id: 'blank',
    name: 'Blank deck',
    description: 'One title slide on the Paper theme.',
    build: () => deck('Untitled deck', 'paper', [newSlide('title', {}, 30)]),
  },
  {
    id: 'launch',
    name: 'Launch talk',
    description: 'Seven slides with notes and planned times for a short talk.',
    build: () =>
      deck('Paperlight launch talk', 'paper', [
        newSlide('title', { title: 'Paperlight', subtitle: 'A free office suite, built from scratch on camera' }, 30, 'Open on the Home screen. Say the name, then the promise: no account, no subscription, nothing leaves the computer.'),
        newSlide('content', { title: 'Why build an office suite', body: 'No subscription to pay\nFiles stay on your computer\nOpens and saves the formats people send you' }, 60, 'Start with the subscription receipt. Then the question every viewer asks: could one person really build this?'),
        newSlide('content', { title: 'Four apps, one quiet desk', body: 'Prose for documents\nCells for numbers\nDeck for talks\nJotbook for notes' }, 45, 'Name each app and the job it replaces. Point at the colour of each rail; that colour follows you into the app. Then say the one rule: nothing leaves the computer.'),
        newSlide('section', { number: '04', title: 'The Swiss Grid design' }, 60, 'Show the 72px columns behind every screen, the square corners and the ink lines. No ribbon, no clutter.'),
        newSlide('statement', { statement: 'Your files stay on this computer.' }, 45, 'Pause here. This is the line people remember.'),
        newSlide('two', { title: 'Live demo', body: 'Write a script in Prose\nTotal the views in Cells', caption: 'Plan the talk in Deck\nKeep notes in Jotbook' }, 60, 'Switch to the apps. Keep each step under twenty seconds.'),
        newSlide('title', { title: 'Thank you', subtitle: 'Paperlight · free and local' }, 30, 'Point to the description for the download, then end on the Home screen.'),
      ]),
  },
  {
    id: 'pitch',
    name: 'Sponsor pitch',
    description: 'Five slides to pitch a channel to a sponsor. Sample figures.',
    build: () =>
      deck('Sponsor pitch', 'ink', [
        newSlide('title', { title: 'Partner with the channel', subtitle: 'Desk setups, tools and honest reviews' }, 30),
        newSlide('statement', { statement: '523,587 views last quarter.' }, 45, 'Sample figure. Replace it with your own numbers from Cells.'),
        newSlide('two', { title: 'Who watches', body: 'Creators and students\nMostly 18 to 34', caption: 'Watch to the end\nAsk about the gear' }, 60),
        newSlide('content', { title: 'Ways to work together', body: 'A 60-second segment in one video\nA dedicated review\nA link in the description for a month' }, 60),
        newSlide('title', { title: "Let's talk", subtitle: 'Reply to the email this came with' }, 30),
      ]),
  },
];

export function templateDeck(id: string) {
  return (DECK_TEMPLATES.find((template) => template.id === id) ?? DECK_TEMPLATES[0]).build();
}
