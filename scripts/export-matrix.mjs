// Portable matrix data for agents, documentation builds and other consumers.
// No arguments: catalog. Component and choice IDs: one complete selection.
import { components, render } from '../docs/matrix/matrix.js';
import { concepts, describe, referenceVersions } from '../docs/matrix/reference.js';

const [name, ...options] = process.argv.slice(2);
const data = name
  ? { reference: describe(name, options), example: await render(name, options) }
  : { components, concepts, versions: referenceVersions };

process.stdout.write(JSON.stringify({ schemaVersion: 1, ...data }, null, 2) + '\n');
