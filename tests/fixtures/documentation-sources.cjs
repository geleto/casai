// Public chapters and articles share the same checked-example pipeline.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const articles = JSON.parse(fs.readFileSync(path.join(root, 'docs/matrix/articles/index.json'), 'utf8'));
module.exports = [
  'docs/matrix/documentation.md',
  ...articles.map(({ slug }) => `docs/matrix/articles/${slug}.md`),
].map(file => ({ file, text: fs.readFileSync(path.join(root, file), 'utf8') }));
