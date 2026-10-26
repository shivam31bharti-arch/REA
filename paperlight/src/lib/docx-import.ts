import mammoth from 'mammoth/mammoth.browser.js';

const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  'u => u',
  'strike => s',
];

export async function docxToHtml(data: Uint8Array) {
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const result = await mammoth.convertToHtml({ arrayBuffer }, { styleMap: STYLE_MAP });
  return { html: result.value, warnings: result.messages.map((message) => message.message) };
}
